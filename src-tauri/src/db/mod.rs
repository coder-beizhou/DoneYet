pub mod repo;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::fs;
use std::path::Path;

/// 初始化 SQLite 连接池:建数据目录、连接(创库+开启 WAL/外键)、跑迁移。
/// 用 SqliteConnectOptions::filename 而非 URL 字符串,避开 Windows 路径含冒号的解析坑。
pub async fn init_pool(app_data_dir: &Path) -> anyhow::Result<SqlitePool> {
    fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("shangshangqian.db");
    let opts = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true)
        .busy_timeout(std::time::Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;
    migrate(&pool).await?;
    Ok(pool)
}

/// 迁移:schema_migrations 表追踪已应用版本;用单一连接跑(PRAGMA 是连接级),
/// 重建表时临时关外键(否则 RENAME 会因外键检查失败)。
async fn migrate(pool: &SqlitePool) -> anyhow::Result<()> {
    let mut conn = pool.acquire().await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    )
    .execute(&mut *conn)
    .await?;

    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let migrations: &[(&str, &str)] = &[
        ("0001_init", include_str!("../../migrations/0001_init.sql")),
        ("0002_schema_v2", include_str!("../../migrations/0002_schema_v2.sql")),
        ("0003_operation_log", include_str!("../../migrations/0003_operation_log.sql")),
    ];
    for (ver, sql) in migrations {
        let applied = sqlx::query("SELECT 1 FROM schema_migrations WHERE version=?")
            .bind(ver)
            .fetch_optional(&mut *conn)
            .await?
            .is_some();
        if applied {
            continue;
        }
        // 迁移期间关外键(重建表/RENAME 需要),完成后恢复
        let _ = sqlx::query("PRAGMA foreign_keys=OFF").execute(&mut *conn).await;
        for stmt in sql.split(';') {
            let s = stmt.trim();
            if s.is_empty() || s.starts_with("--") {
                continue;
            }
            sqlx::query(s).execute(&mut *conn).await?;
        }
        let _ = sqlx::query("PRAGMA foreign_keys=ON").execute(&mut *conn).await;
        sqlx::query("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
            .bind(ver)
            .bind(&now)
            .execute(&mut *conn)
            .await?;
    }
    Ok(())
}
