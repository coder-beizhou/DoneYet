use crate::db::repo::todos::{self, Todo, TodoCreate, TodoUpdate};
use crate::state::AppState;
use tauri::State;

/// 全部待办(跨便签),供"待办"面板。
#[tauri::command]
pub async fn list_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    todos::list_all(&state.db).await.map_err(|e| e.to_string())
}

/// 某便签下的待办(便签窗口内 checklist 用)。
#[tauri::command]
pub async fn list_todos_by_note(
    note_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Todo>, String> {
    todos::list_by_note(&state.db, &note_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_todo(todo: TodoCreate, state: State<'_, AppState>) -> Result<Todo, String> {
    todos::create(&state.db, &todo)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_todo(todo: TodoUpdate, state: State<'_, AppState>) -> Result<Todo, String> {
    todos::update(&state.db, &todo)
        .await
        .map_err(|e| e.to_string())
}

/// 翻转完成状态(前端勾选时用,避免全量 update)。
#[tauri::command]
pub async fn toggle_todo(
    id: String,
    done: bool,
    state: State<'_, AppState>,
) -> Result<Todo, String> {
    todos::toggle(&state.db, &id, done)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_todo(id: String, state: State<'_, AppState>) -> Result<(), String> {
    todos::delete(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}
