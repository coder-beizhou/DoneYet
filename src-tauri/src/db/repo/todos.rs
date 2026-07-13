use crate::db::repo::op_log;

use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

/// 待办事项。note_id 可空(独立待办,不归属便签);content 为正文。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub note_id: Option<String>,
    pub title: String,
    pub content: String,
    pub done: bool,
    pub done_at: Option<String>,
    pub sort_order: i64,
    pub due_date: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TodoCreate {
    pub note_id: Option<String>, // 可空:独立待办
    pub title: String,
    pub content: Option<String>,
    pub due_date: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TodoUpdate {
    pub id: String,
    pub title: String,
    pub content: String,
    pub done: bool,
    pub due_date: Option<String>,
    pub sort_order: i64,
}

fn now_iso() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

const SELECT_COLS: &str = "id, note_id, title, content, done, done_at, sort_order, due_date, created_at";

fn row_to_todo(row: sqlx::sqlite::SqliteRow) -> Todo {
    Todo {
        id: row.get("id"),
        note_id: row.get("note_id"),
        title: row.get("title"),
        content: row.get("content"),
        done: row.get::<i64, _>("done") != 0,
        done_at: row.get("done_at"),
        sort_order: row.get("sort_order"),
        due_date: row.get("due_date"),
        created_at: row.get("created_at"),
    }
}

pub async fn get(pool: &SqlitePool, id: &str) -> anyhow::Result<Option<Todo>> {
    let sql = format!("SELECT {} FROM todos WHERE id=?", SELECT_COLS);
    let row = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(row_to_todo))
}

pub async fn create(pool: &SqlitePool, c: &TodoCreate) -> anyhow::Result<Todo> {
    let id = Uuid::new_v4().to_string();
    let now = now_iso();
    sqlx::query(
        "INSERT INTO todos (id, note_id, title, content, done, done_at, sort_order, due_date, created_at) \
         VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&c.note_id)
    .bind(&c.title)
    .bind(c.content.as_deref().unwrap_or(""))
    .bind(c.sort_order.unwrap_or(0))
    .bind(&c.due_date)
    .bind(&now)
    .execute(pool)
    .await?;
    op_log::log(pool, "created", "todo", &id, &c.title, None).await;
    get(pool, &id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("todo not found after insert"))
}

pub async fn list_by_note(pool: &SqlitePool, note_id: &str) -> anyhow::Result<Vec<Todo>> {
    let sql = format!(
        "SELECT {} FROM todos WHERE note_id=? \
         AND note_id IN (SELECT id FROM sticky_notes WHERE deleted_at IS NULL) \
         ORDER BY sort_order ASC, created_at ASC",
        SELECT_COLS
    );
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(note_id)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(row_to_todo).collect())
}

pub async fn list_all(pool: &SqlitePool) -> anyhow::Result<Vec<Todo>> {
    let sql = format!(
        "SELECT {} FROM todos \
         WHERE (note_id IS NULL OR note_id IN (SELECT id FROM sticky_notes WHERE deleted_at IS NULL)) \
         ORDER BY done ASC, (due_date IS NULL) ASC, due_date ASC, sort_order ASC",
        SELECT_COLS
    );
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql)).fetch_all(pool).await?;
    Ok(rows.into_iter().map(row_to_todo).collect())
}

/// 日历聚合:due_date 落在 [from,to] 的待办(含已完成,日历里始终显示直到删除)。
pub async fn list_due_in_range(
    pool: &SqlitePool,
    from: &str,
    to: &str,
) -> anyhow::Result<Vec<Todo>> {
    let sql = format!(
        "SELECT {} FROM todos WHERE due_date IS NOT NULL AND due_date BETWEEN ? AND ? \
         AND (note_id IS NULL OR note_id IN (SELECT id FROM sticky_notes WHERE deleted_at IS NULL)) \
         ORDER BY due_date ASC",
        SELECT_COLS
    );
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(from)
        .bind(to)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(row_to_todo).collect())
}

pub async fn list_overdue(pool: &SqlitePool, now_iso: &str) -> anyhow::Result<Vec<Todo>> {
    let sql = format!(
        "SELECT {} FROM todos WHERE done=0 AND due_date IS NOT NULL AND due_date <= ? \
         AND (note_id IS NULL OR note_id IN (SELECT id FROM sticky_notes WHERE deleted_at IS NULL))",
        SELECT_COLS
    );
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(now_iso)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(row_to_todo).collect())
}

pub async fn update(pool: &SqlitePool, u: &TodoUpdate) -> anyhow::Result<Todo> {
    let done_at = if u.done { Some(now_iso()) } else { None };
    sqlx::query(
        "UPDATE todos SET title=?, content=?, done=?, done_at=?, due_date=?, sort_order=? WHERE id=?",
    )
    .bind(&u.title)
    .bind(&u.content)
    .bind(u.done as i64)
    .bind(&done_at)
    .bind(&u.due_date)
    .bind(u.sort_order)
    .bind(&u.id)
    .execute(pool)
    .await?;
    op_log::log(pool, "edited", "todo", &u.id, &u.title, None).await;
    get(pool, &u.id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("todo not found after update"))
}

pub async fn toggle(pool: &SqlitePool, id: &str, done: bool) -> anyhow::Result<Todo> {
    let done_at = if done { Some(now_iso()) } else { None };
    sqlx::query("UPDATE todos SET done=?, done_at=? WHERE id=?")
        .bind(done as i64)
        .bind(&done_at)
        .bind(id)
        .execute(pool)
        .await?;
    let t = get(pool, id).await?.ok_or_else(|| anyhow::anyhow!("todo not found after toggle"))?;
    op_log::log(pool, if done { "completed" } else { "uncompleted" }, "todo", id, &t.title, None).await;
    Ok(t)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM todos WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?;
    op_log::log(pool, "deleted", "todo", id, "", None).await;
    Ok(())
}
