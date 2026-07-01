use crate::db::repo::notes;
use crate::state::AppState;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

/// 打开(或聚焦)一张便签的独立窗口。
/// 已存在则 show + focus;否则按 DB 中的几何/置顶创建无边框透明窗口。
#[tauri::command]
pub async fn open_note_window(
    id: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let label = format!("note-{}", id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let note = notes::get(&state.db, &id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "note not found".to_string())?;

    let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("/".into()))
        .title("上上签")
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .skip_taskbar(true)
        .resizable(true)
        .always_on_top(note.is_always_on_top)
        .min_inner_size(180.0, 160.0);

    let w = note.w.unwrap_or(320.0);
    let h = note.h.unwrap_or(320.0);
    builder = builder.inner_size(w, h);
    builder = match (note.x, note.y) {
        (Some(x), Some(y)) => builder.position(x, y),
        _ => builder.center(),
    };

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn close_note_window(id: String, app: tauri::AppHandle) -> Result<(), String> {
    let label = format!("note-{}", id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn focus_note(id: String, app: tauri::AppHandle) -> Result<(), String> {
    let label = format!("note-{}", id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}

/// 退出整个程序(含托盘)。前端 X 按钮"直接退出"模式 / 设置选退出时调用。
#[tauri::command]
pub async fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 打开(或聚焦)计算器独立窗口。
#[tauri::command]
pub async fn open_calculator_window(app: tauri::AppHandle) -> Result<(), String> {
    let label = "calculator";
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("/calculator".into()))
        .title("上上签 · 计算器")
        .inner_size(300.0, 460.0)
        .min_inner_size(260.0, 380.0)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .resizable(true)
        .position(200.0, 200.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 设置开机自启(enabled=true 注册,false 取消),返回当前实际启用状态。
#[tauri::command]
pub async fn set_autostart(enabled: bool, app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let mgr = app.autolaunch();
    if enabled {
        mgr.enable().map_err(|e| e.to_string())?;
    } else {
        mgr.disable().map_err(|e| e.to_string())?;
    }
    mgr.is_enabled().map_err(|e| e.to_string())
}

/// 打开(或聚焦)日历大窗口:平铺覆盖约 80% 桌面,居中,纯大月历(无右侧栏)。
#[tauri::command]
pub async fn open_calendar_window(app: tauri::AppHandle) -> Result<(), String> {
    let label = "calendar";
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    // 取主显示器,按 72% 尺寸居中(逻辑像素)
    let (w, h, x, y) = match app.primary_monitor() {
        Ok(Some(m)) => {
            let s = m.size();
            let p = m.position();
            let sc = m.scale_factor();
            let w = s.width as f64 / sc * 0.72;
            let h = s.height as f64 / sc * 0.72;
            let x = p.x as f64 / sc + (s.width as f64 / sc - w) / 2.0;
            let y = p.y as f64 / sc + (s.height as f64 / sc - h) / 2.0;
            (w, h, x, y)
        }
        _ => (1000.0, 680.0, 80.0, 60.0),
    };
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("/".into()))
        .title("上上签 · 日历")
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .inner_size(w, h)
        .min_inner_size(640.0, 480.0)
        .position(x, y)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}
