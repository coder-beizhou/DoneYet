use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

/// 注册全局快捷键:Ctrl+Shift+N 新建便签(emit 事件给主面板),Ctrl+Shift+M 唤起主面板。
/// v2 用法:Builder::with_handler 注册处理函数,再 register 具体快捷键。
pub fn setup(app: &tauri::AppHandle) -> tauri::Result<()> {
    let mods = Modifiers::CONTROL | Modifiers::SHIFT;

    app.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                if shortcut == &Shortcut::new(Some(mods), Code::KeyN) {
                    let _ = app.emit("shortcut:new-note", ());
                } else if shortcut == &Shortcut::new(Some(mods), Code::KeyM) {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            })
            .build(),
    )?;

    // 注册失败不致命(快捷键可能被其他应用占用):log 后继续,保证 app 总能启动。
    if let Err(e) = app
        .global_shortcut()
        .register(Shortcut::new(Some(mods), Code::KeyN))
    {
        log::warn!("register Ctrl+Shift+N failed (skipped): {e}");
    }
    if let Err(e) = app
        .global_shortcut()
        .register(Shortcut::new(Some(mods), Code::KeyM))
    {
        log::warn!("register Ctrl+Shift+M failed (skipped): {e}");
    }
    Ok(())
}
