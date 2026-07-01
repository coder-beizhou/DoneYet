use crate::db::repo::op_log;

use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

/// 便签领域模型,序列化给前端(JSON 字段保持 snake_case,与 TS 类型一致)。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content_md: String,
    pub content_json: Option<String>,
    pub category_id: Option<String>,
    pub color: String,
    pub is_pinned_desktop: bool,
    pub is_always_on_top: bool,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub w: Option<f64>,
    pub h: Option<f64>,
    pub date: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// 便签全量更新载荷(前端组装完整 Note 传入)。
#[derive(Debug, Clone, Deserialize)]
pub struct NoteUpdate {
    pub id: String,
    pub title: String,
    pub content_md: String,
    pub content_json: Option<String>,
    pub color: String,
    pub category_id: Option<String>,
    pub is_pinned_desktop: bool,
    pub is_always_on_top: bool,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub w: Option<f64>,
    pub h: Option<f64>,
    pub date: Option<String>,
}

fn now_iso() -> String {
    // 本地 naive(YYYY-MM-DDTHH:mm:ss),与 todos/reminders/scheduler 一致,保证跨表字符串比较可靠。
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

const SELECT_COLS: &str = "id, title, content_md, content_json, category_id, color, \
    is_pinned_desktop, is_always_on_top, x, y, w, h, date, sort_order, created_at, updated_at";

fn row_to_note(row: sqlx::sqlite::SqliteRow) -> Note {
    Note {
        id: row.get("id"),
        title: row.get("title"),
        content_md: row.get("content_md"),
        content_json: row.get("content_json"),
        category_id: row.get("category_id"),
        color: row.get("color"),
        is_pinned_desktop: row.get::<i64, _>("is_pinned_desktop") != 0,
        is_always_on_top: row.get::<i64, _>("is_always_on_top") != 0,
        x: row.get("x"),
        y: row.get("y"),
        w: row.get("w"),
        h: row.get("h"),
        date: row.get("date"),
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub async fn create(
    pool: &SqlitePool,
    title: String,
    color: String,
    category_id: Option<String>,
) -> anyhow::Result<Note> {
    let id = Uuid::new_v4().to_string();
    let now = now_iso();
    sqlx::query(
        "INSERT INTO sticky_notes \
         (id, title, content_md, content_json, category_id, color, \
          is_pinned_desktop, is_always_on_top, sort_order, created_at, updated_at) \
         VALUES (?, ?, '', NULL, ?, ?, 0, 0, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(&category_id)
    .bind(&color)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;
    op_log::log(pool, "created", "note", &id, &title, None).await;
    get(pool, &id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("note not found after insert"))
}

pub async fn get(pool: &SqlitePool, id: &str) -> anyhow::Result<Option<Note>> {
    // SQL 仅含静态片段(列名常量 + 字面量表名/WHERE),id 走 bind 参数,无注入风险。
    // sqlx 0.9 的 SqlSafeStr 只认 &'static str,动态 String 须显式 AssertSqlSafe 标记已审计安全。
    let sql = format!("SELECT {} FROM sticky_notes WHERE id=? AND deleted_at IS NULL", SELECT_COLS);
    let row = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(row_to_note))
}

pub async fn list(pool: &SqlitePool) -> anyhow::Result<Vec<Note>> {
    let sql = format!(
        "SELECT {} FROM sticky_notes WHERE deleted_at IS NULL \
         ORDER BY is_pinned_desktop DESC, updated_at DESC",
        SELECT_COLS
    );
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql)).fetch_all(pool).await?;
    Ok(rows.into_iter().map(row_to_note).collect())
}

pub async fn update(pool: &SqlitePool, u: &NoteUpdate) -> anyhow::Result<Note> {
    let now = now_iso();
    sqlx::query(
        "UPDATE sticky_notes SET title=?, content_md=?, content_json=?, category_id=?, \
         color=?, is_pinned_desktop=?, is_always_on_top=?, x=?, y=?, w=?, h=?, date=?, updated_at=? \
         WHERE id=? AND deleted_at IS NULL",
    )
    .bind(&u.title)
    .bind(&u.content_md)
    .bind(&u.content_json)
    .bind(&u.category_id)
    .bind(&u.color)
    .bind(u.is_pinned_desktop as i64)
    .bind(u.is_always_on_top as i64)
    .bind(u.x)
    .bind(u.y)
    .bind(u.w)
    .bind(u.h)
    .bind(&u.date)
    .bind(&now)
    .bind(&u.id)
    .execute(pool)
    .await?;
    op_log::log(pool, "edited", "note", &u.id, &u.title, None).await;
    get(pool, &u.id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("note not found after update"))
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    // FK ON DELETE CASCADE 不会因 UPDATE 触发,故手动硬删子表:避免软删便签后其 todos/reminders
    // 仍存活(仍触发通知、仍出现在待办/提醒/日历),这是最大的用户可见数据 bug。
    let now = now_iso();
    // 先删该便签 reminders 引用的 repeats 行(FK SET NULL 会置空,但行会孤儿累积)
    sqlx::query(
        "DELETE FROM repeats WHERE id IN \
         (SELECT repeat_rule_id FROM reminders WHERE note_id=? AND repeat_rule_id IS NOT NULL)",
    )
    .bind(id)
    .execute(pool)
    .await?;
    sqlx::query("DELETE FROM reminders WHERE note_id=?")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM todos WHERE note_id=?")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM history_versions WHERE note_id=?")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("UPDATE sticky_notes SET deleted_at=? WHERE id=? AND deleted_at IS NULL")
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;
    op_log::log(pool, "deleted", "note", id, "", None).await;
    Ok(())
}
