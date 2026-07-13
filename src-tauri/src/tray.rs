use crate::i18n;
use crate::state::AppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

/// 构建系统托盘:左键切主窗可见性,右键菜单(新建/主面板/退出)。文案按当前语言。
pub fn build(app: &tauri::AppHandle) -> tauri::Result<()> {
    let lang = app.state::<AppState>().lang();
    let menu = make_menu(app, &lang)?;
    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip(i18n::brand(&lang))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "new_note" => {
                let _ = app.emit("tray:new-note", ());
            }
            "show_main" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    if win.is_visible().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

/// 语言变更时重建托盘菜单 + tooltip(菜单项事件仍走 build 时注册的 on_menu_event 处理器)。
pub fn apply_language(app: &tauri::AppHandle, lang: &str) -> tauri::Result<()> {
    let menu = make_menu(app, lang)?;
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_menu(Some(menu))?;
        tray.set_tooltip(Some(i18n::brand(lang).to_string()))?;
    }
    Ok(())
}

fn make_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>, lang: &str) -> tauri::Result<Menu<R>> {
    let new_note = MenuItem::with_id(app, "new_note", i18n::tray_new_note(lang), true, None::<&str>)?;
    let show_main = MenuItem::with_id(app, "show_main", i18n::tray_show_main(lang), true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", i18n::tray_quit(lang), true, None::<&str>)?;
    Menu::with_items(app, &[&new_note, &show_main, &quit])
}
