mod commands;
mod db;
mod i18n;
mod scheduler;
mod shortcut;
mod state;
mod tray;

use commands::calendar::agenda;
use commands::categories::{create_category, delete_category, list_categories, rename_category};
use commands::notes::{create_note, delete_note, get_note, list_notes, reorder_notes, undelete_note, update_note};
use commands::op_log::list_op_logs;
use commands::reminders::{
    create_reminder, delete_reminder, list_reminders, set_reminder_enabled, update_reminder,
};
use commands::todos::{
    create_todo, delete_todo, list_todos, list_todos_by_note, reorder_todos, toggle_todo,
    update_todo,
};
use commands::window_mgr::{close_note_window, focus_note, open_calendar_window, open_calculator_window, open_note_window, quit_app, set_autostart};
use commands::lang::set_language;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // 已有实例时,第二实例启动会聚焦已有主窗(单例)。
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // 数据库:连接池 + WAL + 迁移
            let data_dir = handle.path().app_data_dir()?;
            let pool =
                tauri::async_runtime::block_on(async { db::init_pool(&data_dir).await })?;
            let lang = state::load_lang(&data_dir);
            app.manage(AppState::new(pool, lang));

            // 系统托盘(失败不致命:log 后继续,无托盘也能跑)
            if let Err(e) = tray::build(&handle) {
                log::warn!("tray build failed: {e}");
            }
            // 全局快捷键(Ctrl+Shift+N 新建 / Ctrl+Shift+M 唤主面板;内部 register 已非致命)
            if let Err(e) = shortcut::setup(&handle) {
                log::warn!("shortcut setup failed: {e}");
            }

            // 提醒调度器(常驻:每 30s 轮询到期提醒 → OS 通知 + 前端事件 + 推进下次)
            scheduler::start(&handle);

            // 主界面:贴屏幕右边的细长条(320 逻辑宽 × 80% 桌面高),垂直居中。
            if let Ok(Some(monitor)) = handle.primary_monitor() {
                let s = monitor.size();
                let p = monitor.position();
                let sc = monitor.scale_factor();
                let win_w = (470.0 * sc) as i32; // 320 内容 + 150 书签悬挑
                let win_h = (s.height as f64 * 0.8) as i32;
                if let Some(main) = handle.get_webview_window("main") {
                    let _ = main.set_size(tauri::PhysicalSize::new(win_w as u32, win_h as u32));
                    let _ = main.set_position(tauri::PhysicalPosition::new(
                        p.x + s.width as i32 - win_w,
                        p.y + (s.height as i32 - win_h) / 2,
                    ));
                }
            }
            // 主窗 visible:false 起步(防启动闪现/跳变);几何定好后才显示。
            if let Some(main) = handle.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }

            // 主窗关闭行为由前端按设置决定(最小化到托盘 / 直接退出),不在 Rust 侧强制拦截。
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 便签
            create_note,
            get_note,
            list_notes,
            update_note,
            delete_note,
            undelete_note,
            reorder_notes,
            open_note_window,
            close_note_window,
            focus_note,
            open_calendar_window,
            open_calculator_window,
            quit_app,
            set_autostart,
            set_language,
            // 待办
            list_todos,
            list_todos_by_note,
            create_todo,
            update_todo,
            toggle_todo,
            delete_todo,
            reorder_todos,
            // 提醒
            list_reminders,
            create_reminder,
            update_reminder,
            set_reminder_enabled,
            delete_reminder,
            // 日历
            agenda,
            // 操作日志
            list_op_logs,
            // 分类(书签)
            list_categories,
            create_category,
            rename_category,
            delete_category,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
