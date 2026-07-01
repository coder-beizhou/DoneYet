use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

/// 操作日志:记录 create/edit/complete/delete 等操作,供时间轴展示。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpLog {
    pub id: String,
    pub action: String,    // created | edited | completed | uncompleted | deleted | fired
    pub item_kind: String, // note | todo | reminder | category
    pub item_id: String,
    pub item_title: String,
    pub detail: Option<String>,
    pub created_at: String,
}

fn now_iso() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn row_to_log(row: sqlx::sqlite::SqliteRow) -> OpLog {
    OpLog {
        id: row.get("id"),
        action: row.get("action"),
        item_kind: row.get("item_kind"),
        item_id: row.get("item_id"),
        item_title: row.get("item_title"),
        detail: row.get("detail"),
        created_at: row.get("created_at"),
    }
}

/// 记录一条操作日志(供各 repo/command 调用)。
pub async fn log(
    pool: &SqlitePool,
    action: &str,
    item_kind: &str,
    item_id: &str,
    item_title: &str,
    detail: Option<String>,
) {
    let id = Uuid::new_v4().to_string();
    let now = now_iso();
    let _ = sqlx::query(
        "INSERT INTO operation_log (id, action, item_kind, item_id, item_title, detail, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(action)
    .bind(item_kind)
    .bind(item_id)
    .bind(item_title)
    .bind(&detail)
    .bind(&now)
    .execute(pool)
    .await;
}

/// 查询最近 N 条操作日志(按时间倒序)。
pub async fn recent(pool: &SqlitePool, limit: i64) -> anyhow::Result<Vec<OpLog>> {
    let rows = sqlx::query(
        "SELECT id, action, item_kind, item_id, item_title, detail, created_at \
         FROM operation_log ORDER BY created_at DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(row_to_log).collect())
}
