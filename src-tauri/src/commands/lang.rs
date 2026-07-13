use crate::i18n;
use crate::state::AppState;
use crate::tray;
use tauri::{Manager, State};

/// 前端切换语言时调用:写入 AppState.language、持久化到 lang.txt、重建托盘菜单/tooltip、
/// 更新各窗口 OS 标题(borderless 下不可见,仍更新以保正确)。提醒/通知标题在触发时即时读取 lang。
#[tauri::command]
pub async fn set_language(
    lang: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let lang = if lang == "en" { "en" } else { "zh" }.to_string();
    {
        let mut guard = state.language.lock().map_err(|e| e.to_string())?;
        *guard = lang.clone();
    }
    if let Ok(data_dir) = app.path().app_data_dir() {
        crate::state::save_lang(&data_dir, &lang).await;
    }
    tray::apply_language(&app, &lang).map_err(|e| e.to_string())?;
    for (_, win) in app.webview_windows() {
        let _ = win.set_title(&i18n::title_for_label(win.label(), &lang));
    }
    Ok(())
}
