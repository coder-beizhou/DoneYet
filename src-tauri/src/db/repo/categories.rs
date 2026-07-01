use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

/// 分类(书签/便签页):sticky_notes.category_id 引用此表。UI 上表现为左侧书签。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CategoryCreate {
    pub name: String,
    pub color: Option<String>,
}

fn now_iso() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn row_to_category(row: sqlx::sqlite::SqliteRow) -> Category {
    Category {
        id: row.get("id"),
        name: row.get("name"),
        color: row.get("color"),
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
    }
}

pub async fn list(pool: &SqlitePool) -> anyhow::Result<Vec<Category>> {
    let rows = sqlx::query(
        "SELECT id, name, color, sort_order, created_at FROM categories \
         ORDER BY sort_order ASC, created_at ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(row_to_category).collect())
}

pub async fn create(pool: &SqlitePool, c: &CategoryCreate) -> anyhow::Result<Category> {
    let name = c.name.trim();
    if name.is_empty() {
        anyhow::bail!("标签名不能为空");
    }
    if name.chars().count() > 7 {
        anyhow::bail!("标签名不超过 7 个字");
    }
    let id = Uuid::new_v4().to_string();
    let now = now_iso();
    sqlx::query(
        "INSERT INTO categories (id, name, color, sort_order, created_at) VALUES (?, ?, ?, 0, ?)",
    )
    .bind(&id)
    .bind(name)
    .bind(c.color.as_deref().unwrap_or("#6366f1"))
    .bind(&now)
    .execute(pool)
    .await?;
    get(pool, &id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("category not found after insert"))
}

pub async fn get(pool: &SqlitePool, id: &str) -> anyhow::Result<Option<Category>> {
    let row = sqlx::query(
        "SELECT id, name, color, sort_order, created_at FROM categories WHERE id=?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(row_to_category))
}

pub async fn rename(pool: &SqlitePool, id: &str, name: String) -> anyhow::Result<()> {
    sqlx::query("UPDATE categories SET name=? WHERE id=?")
        .bind(&name)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 删除分类:sticky_notes.category_id ON DELETE SET NULL,引用此分类的便签自动归未分类。
pub async fn delete(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM categories WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
