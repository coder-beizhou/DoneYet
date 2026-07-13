use crate::db::repo::op_log;

use chrono::{Duration, Local, Months, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

/// 重复规则。kind: daily|weekly|monthly|yearly;interval: 步长(默认 1)。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repeat {
    pub id: String,
    pub kind: String,
    pub interval: i64,
    pub days_of_week: Option<String>,
    pub until_date: Option<String>,
    pub created_at: String,
}

/// 提醒。repeat_kind/repeat_interval 由 LEFT JOIN repeats 带出,供前端编辑模式预填 + 列表显示"每天/每周"。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: String,
    pub note_id: Option<String>,
    pub title: String,
    pub fire_at: String,
    pub repeat_rule_id: Option<String>,
    pub enabled: bool,
    pub last_fired_at: Option<String>,
    pub next_fire_at: Option<String>,
    pub sound: Option<String>,
    pub created_at: String,
    pub repeat_kind: Option<String>,
    pub repeat_interval: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RepeatInput {
    pub kind: String, // daily|weekly|monthly|yearly
    pub interval: Option<i64>,
    pub until_date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReminderCreate {
    pub title: String,
    pub fire_at: String,
    pub note_id: Option<String>,
    pub repeat: Option<RepeatInput>,
}

/// 编辑提醒。repeat: None=无重复(清除既有), Some=设置/替换重复规则。
#[derive(Debug, Clone, Deserialize)]
pub struct ReminderUpdate {
    pub id: String,
    pub title: String,
    pub fire_at: String,
    pub note_id: Option<String>,
    pub repeat: Option<RepeatInput>,
}

fn now_iso() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

const SELECT_COLS: &str = "r.id, r.note_id, r.title, r.fire_at, r.repeat_rule_id, r.enabled, \
    r.last_fired_at, r.next_fire_at, r.sound, r.created_at, \
    rp.kind AS repeat_kind, rp.interval AS repeat_interval";
const FROM_JOIN: &str = "FROM reminders r LEFT JOIN repeats rp ON r.repeat_rule_id = rp.id";

fn row_to_reminder(row: sqlx::sqlite::SqliteRow) -> Reminder {
    Reminder {
        id: row.get("id"),
        note_id: row.get("note_id"),
        title: row.get("title"),
        fire_at: row.get("fire_at"),
        repeat_rule_id: row.get("repeat_rule_id"),
        enabled: row.get::<i64, _>("enabled") != 0,
        last_fired_at: row.get("last_fired_at"),
        next_fire_at: row.get("next_fire_at"),
        sound: row.get("sound"),
        created_at: row.get("created_at"),
        repeat_kind: row.get("repeat_kind"),
        repeat_interval: row.get("repeat_interval"),
    }
}

pub async fn get(pool: &SqlitePool, id: &str) -> anyhow::Result<Option<Reminder>> {
    let sql = format!("SELECT {} {} WHERE r.id=?", SELECT_COLS, FROM_JOIN);
    let row = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(row_to_reminder))
}

pub async fn get_repeat(pool: &SqlitePool, id: &str) -> anyhow::Result<Option<Repeat>> {
    let row = sqlx::query(
        "SELECT id, kind, interval, days_of_week, until_date, created_at FROM repeats WHERE id=?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| Repeat {
        id: r.get("id"),
        kind: r.get("kind"),
        interval: r.get("interval"),
        days_of_week: r.get("days_of_week"),
        until_date: r.get("until_date"),
        created_at: r.get("created_at"),
    }))
}

pub async fn create(pool: &SqlitePool, c: &ReminderCreate) -> anyhow::Result<Reminder> {
    let id = Uuid::new_v4().to_string();
    let now = now_iso();

    // 先纯计算 repeat 行(含 id)与 next_fire_at(不入库),再把 repeats+reminders 两条写入事务化,
    // 避免"repeats 插了但 reminders 没插"的孤儿行。
    let rep_row: Option<Repeat> = c.repeat.as_ref().map(|rep| {
        let rid = Uuid::new_v4().to_string();
        let interval = rep.interval.unwrap_or(1);
        Repeat {
            id: rid,
            kind: rep.kind.clone(),
            interval,
            days_of_week: None,
            until_date: rep.until_date.clone(),
            created_at: now.clone(),
        }
    });
    // 若 fire_at 在过去,推进到第一个未来 occurrence,避免一创建就触发风暴。
    let (repeat_rule_id, next_fire_at) = match &rep_row {
        Some(rp) => (Some(rp.id.clone()), advance_from(&c.fire_at, rp, &now)),
        None => (None, Some(c.fire_at.clone())),
    };

    let mut tx = pool.begin().await?;
    if let Some(rp) = &rep_row {
        sqlx::query(
            "INSERT INTO repeats (id, kind, interval, days_of_week, until_date, created_at) \
             VALUES (?, ?, ?, NULL, ?, ?)",
        )
        .bind(&rp.id)
        .bind(&rp.kind)
        .bind(rp.interval)
        .bind(&rp.until_date)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }
    sqlx::query(
        "INSERT INTO reminders \
         (id, note_id, title, fire_at, repeat_rule_id, enabled, last_fired_at, next_fire_at, sound, created_at) \
         VALUES (?, ?, ?, ?, ?, 1, NULL, ?, NULL, ?)",
    )
    .bind(&id)
    .bind(&c.note_id)
    .bind(&c.title)
    .bind(&c.fire_at)
    .bind(&repeat_rule_id)
    .bind(&next_fire_at)
    .bind(&now)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    op_log::log(pool, "created", "reminder", &id, &c.title, None).await;
    get(pool, &id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("reminder not found after insert"))
}

pub async fn list(pool: &SqlitePool) -> anyhow::Result<Vec<Reminder>> {
    let sql = format!(
        "SELECT {} {} \
         WHERE (r.note_id IS NULL OR r.note_id IN (SELECT id FROM sticky_notes WHERE deleted_at IS NULL)) \
         ORDER BY COALESCE(r.next_fire_at, r.fire_at) ASC",
        SELECT_COLS, FROM_JOIN
    );
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql)).fetch_all(pool).await?;
    Ok(rows.into_iter().map(row_to_reminder).collect())
}

pub async fn list_due(pool: &SqlitePool, now_iso: &str) -> anyhow::Result<Vec<Reminder>> {
    let sql = format!(
        "SELECT {} {} WHERE r.enabled=1 AND r.next_fire_at IS NOT NULL AND r.next_fire_at <= ? \
         AND (r.note_id IS NULL OR r.note_id IN (SELECT id FROM sticky_notes WHERE deleted_at IS NULL))",
        SELECT_COLS, FROM_JOIN
    );
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(now_iso)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(row_to_reminder).collect())
}

fn compute_next_fire(last: &str, rep: &Repeat) -> Option<String> {
    let dt = match NaiveDateTime::parse_from_str(last, "%Y-%m-%dT%H:%M:%S") {
        Ok(d) => d,
        Err(e) => {
            log::warn!("compute_next_fire: parse '{last}' failed: {e}");
            return None;
        }
    };
    let step = rep.interval.max(1);
    let next = match rep.kind.as_str() {
        "daily" => dt.checked_add_signed(Duration::days(step))?,
        "weekly" => dt.checked_add_signed(Duration::days(step.checked_mul(7)?))?,
        "monthly" => dt.checked_add_months(Months::new(step as u32))?,
        "yearly" => dt.checked_add_months(Months::new((12 * step) as u32))?,
        other => {
            log::warn!("compute_next_fire: unknown kind '{other}'");
            return None;
        }
    };
    if let Some(until) = &rep.until_date {
        match NaiveDateTime::parse_from_str(until, "%Y-%m-%dT%H:%M:%S") {
            Ok(u) => {
                if next > u {
                    return None;
                }
            }
            Err(e) => log::warn!("compute_next_fire: bad until_date '{until}': {e}"),
        }
    }
    Some(next.format("%Y-%m-%dT%H:%M:%S").to_string())
}

fn advance_from(start: &str, rep: &Repeat, now: &str) -> Option<String> {
    if start > now {
        return Some(start.to_string());
    }
    let mut cur = start.to_string();
    for _ in 0..365 {
        match compute_next_fire(&cur, rep) {
            Some(n) => {
                if n.as_str() > now {
                    return Some(n);
                }
                cur = n;
            }
            None => return None,
        }
    }
    None
}

pub fn expand_occurrences(
    r: &Reminder,
    rep: Option<&Repeat>,
    from: &str,
    to: &str,
) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = r.fire_at.clone();
    match rep {
        None => {
            if cur.as_str() >= from && cur.as_str() <= to {
                out.push(cur);
            }
            return out;
        }
        Some(rp) => {
            for _ in 0..2000 {
                if cur.as_str() > to {
                    break;
                }
                if cur.as_str() >= from {
                    out.push(cur.clone());
                }
                match compute_next_fire(&cur, rp) {
                    Some(n) if n.as_str() > cur.as_str() => cur = n,
                    _ => break,
                }
            }
        }
    }
    out
}

pub async fn mark_fired(pool: &SqlitePool, id: &str, now_iso: &str) -> anyhow::Result<()> {
    let r = match get(pool, id).await? {
        Some(r) => r,
        None => return Ok(()),
    };
    let next = match &r.repeat_rule_id {
        Some(rid) => match get_repeat(pool, rid).await? {
            Some(rep) => advance_from(r.next_fire_at.as_deref().unwrap_or(&r.fire_at), &rep, now_iso),
            None => None,
        },
        None => None,
    };
    sqlx::query("UPDATE reminders SET last_fired_at=?, next_fire_at=? WHERE id=?")
        .bind(now_iso)
        .bind(&next)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 编辑提醒:title + fire_at + note_id + repeat(None=清除,Some=设置/替换)。
/// 总是按新 fire_at + 新 repeat 重算 next_fire_at(推进到第一个未来,防过去触发风暴)。
pub async fn update(pool: &SqlitePool, u: &ReminderUpdate) -> anyhow::Result<Reminder> {
    let old = get(pool, &u.id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("reminder not found"))?;
    let now = now_iso();

    // 先算新 repeat 行(含新 id)与 next_fire_at(纯计算),再事务化:删旧 repeats + 插新 + 更新 reminders,
    // 避免"旧 repeats 删了、新 repeats 没插"或"reminders 指向已删 repeats"的不一致。
    let new_rep_row: Option<Repeat> = u.repeat.as_ref().map(|rep| {
        let rid = Uuid::new_v4().to_string();
        let interval = rep.interval.unwrap_or(1);
        Repeat {
            id: rid,
            kind: rep.kind.clone(),
            interval,
            days_of_week: None,
            until_date: rep.until_date.clone(),
            created_at: now.clone(),
        }
    });
    let (repeat_rule_id, next_fire_at) = match &new_rep_row {
        Some(rp) => (Some(rp.id.clone()), advance_from(&u.fire_at, rp, &now)),
        None => (None, Some(u.fire_at.clone())),
    };

    let mut tx = pool.begin().await?;
    // 删旧 repeats 行(若有)
    if let Some(old_rid) = &old.repeat_rule_id {
        sqlx::query("DELETE FROM repeats WHERE id=?")
            .bind(old_rid)
            .execute(&mut *tx)
            .await?;
    }
    // 插新 repeats 行(若有)
    if let Some(rp) = &new_rep_row {
        sqlx::query(
            "INSERT INTO repeats (id, kind, interval, days_of_week, until_date, created_at) \
             VALUES (?, ?, ?, NULL, ?, ?)",
        )
        .bind(&rp.id)
        .bind(&rp.kind)
        .bind(rp.interval)
        .bind(&rp.until_date)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }
    sqlx::query(
        "UPDATE reminders SET title=?, fire_at=?, next_fire_at=?, note_id=?, repeat_rule_id=? WHERE id=?",
    )
    .bind(&u.title)
    .bind(&u.fire_at)
    .bind(&next_fire_at)
    .bind(&u.note_id)
    .bind(&repeat_rule_id)
    .bind(&u.id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    op_log::log(pool, "edited", "reminder", &u.id, &u.title, None).await;
    get(pool, &u.id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("reminder not found after update"))
}

pub async fn set_enabled(pool: &SqlitePool, id: &str, enabled: bool) -> anyhow::Result<()> {
    sqlx::query("UPDATE reminders SET enabled=? WHERE id=?")
        .bind(enabled as i64)
        .bind(id)
        .execute(pool)
        .await?;
    op_log::log(pool, if enabled { "enabled" } else { "disabled" }, "reminder", id, "", None).await;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    let rid = get(pool, id).await?.and_then(|r| r.repeat_rule_id);
    // 事务:删 reminders + 删其 repeats,避免 reminders 删了但 repeats 孤儿。
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM reminders WHERE id=?")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    if let Some(rid) = &rid {
        sqlx::query("DELETE FROM repeats WHERE id=?")
            .bind(rid)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    op_log::log(pool, "deleted", "reminder", id, "", None).await;
    Ok(())
}
