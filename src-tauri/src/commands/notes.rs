use crate::db::repo::notes::{self, Note, NoteUpdate};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn create_note(
    title: Option<String>,
    color: Option<String>,
    category_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Note, String> {
    notes::create(
        &state.db,
        title.unwrap_or_default(),
        color.unwrap_or_else(|| "#2a2a2e".into()),
        category_id,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_note(id: String, state: State<'_, AppState>) -> Result<Option<Note>, String> {
    notes::get(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    notes::list(&state.db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_note(update: NoteUpdate, state: State<'_, AppState>) -> Result<Note, String> {
    notes::update(&state.db, &update)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_note(id: String, state: State<'_, AppState>) -> Result<(), String> {
    notes::soft_delete(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn undelete_note(id: String, state: State<'_, AppState>) -> Result<(), String> {
    notes::undelete(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reorder_notes(ids: Vec<String>, state: State<'_, AppState>) -> Result<(), String> {
    notes::reorder(&state.db, &ids)
        .await
        .map_err(|e| e.to_string())
}
