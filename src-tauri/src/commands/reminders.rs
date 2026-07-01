use crate::db::repo::reminders::{self, Reminder, ReminderCreate, ReminderUpdate};
use crate::state::AppState;
use tauri::State;

/// 全部提醒(按下次触发时间升序)。
#[tauri::command]
pub async fn list_reminders(state: State<'_, AppState>) -> Result<Vec<Reminder>, String> {
    reminders::list(&state.db).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_reminder(
    reminder: ReminderCreate,
    state: State<'_, AppState>,
) -> Result<Reminder, String> {
    reminders::create(&state.db, &reminder)
        .await
        .map_err(|e| e.to_string())
}

/// 编辑提醒(改 title/时间/关联便签,不改重复规则)。
#[tauri::command]
pub async fn update_reminder(
    reminder: ReminderUpdate,
    state: State<'_, AppState>,
) -> Result<Reminder, String> {
    reminders::update(&state.db, &reminder)
        .await
        .map_err(|e| e.to_string())
}

/// 启用/停用提醒(前端开关用)。
#[tauri::command]
pub async fn set_reminder_enabled(
    id: String,
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    reminders::set_enabled(&state.db, &id, enabled)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_reminder(id: String, state: State<'_, AppState>) -> Result<(), String> {
    reminders::delete(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}
