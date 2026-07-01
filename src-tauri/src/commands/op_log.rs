use crate::db::repo::op_log::{self, OpLog};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_op_logs(limit: Option<i64>, state: State<'_, AppState>) -> Result<Vec<OpLog>, String> {
    op_log::recent(&state.db, limit.unwrap_or(50))
        .await
        .map_err(|e| e.to_string())
}
