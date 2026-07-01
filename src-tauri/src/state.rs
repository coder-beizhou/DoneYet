use sqlx::SqlitePool;

/// 全局应用状态:持有数据库连接池。
/// 通过 `app.manage(AppState::new(pool))` 注入,命令中以 `State<'_, AppState>` 取用。
pub struct AppState {
    pub db: SqlitePool,
}

impl AppState {
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }
}
