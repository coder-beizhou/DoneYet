use crate::db::repo::categories::{self, Category, CategoryCreate};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    categories::list(&state.db).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_category(
    category: CategoryCreate,
    state: State<'_, AppState>,
) -> Result<Category, String> {
    categories::create(&state.db, &category)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_category(
    id: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    categories::rename(&state.db, &id, name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_category(id: String, state: State<'_, AppState>) -> Result<(), String> {
    categories::delete(&state.db, &id)
        .await
        .map_err(|e| e.to_string())
}
