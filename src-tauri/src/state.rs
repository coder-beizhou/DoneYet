use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// 全局应用状态:持有数据库连接池 + 当前语言(zh/en,前端 set_language 推送)。
/// 通过 `app.manage(AppState::new(pool, lang))` 注入,命令中以 `State<'_, AppState>` 取用。
pub struct AppState {
    pub db: SqlitePool,
    pub language: Mutex<String>,
}

impl AppState {
    pub fn new(db: SqlitePool, language: String) -> Self {
        Self { db, language: Mutex::new(language) }
    }

    /// 当前语言(锁中毒时回退 zh)。
    pub fn lang(&self) -> String {
        self.language
            .lock()
            .map(|l| l.clone())
            .unwrap_or_else(|e| e.into_inner().clone())
    }
}

/// 持久化文件:{app_data_dir}/lang.txt。冷启动读取,使托盘/通知在第一帧即用正确语言。
pub fn lang_file(data_dir: &Path) -> PathBuf {
    data_dir.join("lang.txt")
}

/// 读取持久化语言(缺失/非法回退 zh)。
pub fn load_lang(data_dir: &Path) -> String {
    match std::fs::read_to_string(lang_file(data_dir)) {
        Ok(s) => {
            if s.trim() == "en" { "en".to_string() } else { "zh".to_string() }
        }
        Err(_) => "zh".to_string(),
    }
}

/// 写入持久化语言(异步,不阻塞 async worker;失败仅 log 不致命)。
pub async fn save_lang(data_dir: &Path, lang: &str) {
    let _ = tokio::fs::write(lang_file(data_dir), lang).await;
}
