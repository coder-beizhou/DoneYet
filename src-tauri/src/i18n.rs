//! Rust 侧 i18n:仅品牌名 + 少量窗口/托盘/通知标题文案,按 lang("zh"/"en") 取值。
//! 与前端 src/i18n/dict.ts 对应——这里只覆盖 Rust 端用到的少量字符串(品牌 + 托盘菜单 +
//! 计算器/日历/提醒/待办到期 窗口与通知标题)。

pub fn brand(lang: &str) -> &'static str {
    if lang == "en" { "DoneYet" } else { "办了么" }
}

pub fn tray_new_note(lang: &str) -> &'static str {
    if lang == "en" { "New Note" } else { "新建便签" }
}
pub fn tray_show_main(lang: &str) -> &'static str {
    if lang == "en" { "Show Main" } else { "显示主面板" }
}
pub fn tray_quit(lang: &str) -> &'static str {
    if lang == "en" { "Quit" } else { "退出" }
}

pub fn win_calculator(lang: &str) -> String {
    format!("{} · {}", brand(lang), if lang == "en" { "Calculator" } else { "计算器" })
}
pub fn win_calendar(lang: &str) -> String {
    format!("{} · {}", brand(lang), if lang == "en" { "Calendar" } else { "日历" })
}
pub fn win_reminder(lang: &str) -> String {
    format!("{} · {}", brand(lang), if lang == "en" { "Reminder" } else { "提醒" })
}
pub fn win_todo_due(lang: &str) -> String {
    format!("{} · {}", brand(lang), if lang == "en" { "Todo Due" } else { "待办到期" })
}

/// 按 webview window label 给 OS 标题(主窗/便签窗=品牌;计算器/日历=品牌·后缀)。
pub fn title_for_label(label: &str, lang: &str) -> String {
    match label {
        "calculator" => win_calculator(lang),
        "calendar" => win_calendar(lang),
        _ => brand(lang).to_string(),
    }
}
