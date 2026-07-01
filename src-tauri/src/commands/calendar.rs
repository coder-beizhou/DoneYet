use crate::db::repo::{notes, reminders, todos};
use crate::state::AppState;
use serde::Serialize;
use tauri::State;

/// 日历上的一项(提醒/到期待办/有日期便签),统一形态供前端按日期格子渲染。
#[derive(Debug, Clone, Serialize)]
pub struct AgendaItem {
    pub kind: String, // "reminder" | "todo" | "note"
    pub id: String,
    pub title: String,
    /// ISO 时间:提醒的某个 occurrence、待办的 due_date,或便签的 date。
    pub at: String,
    pub note_id: Option<String>,
    /// 仅 todo 有:是否已完成。
    pub done: Option<bool>,
}

/// 取 [from,to] 时间段内的日历项。提醒按重复规则展开为每个 occurrence;待办取 due_date 落在区间且未完成;
/// 便签取 date 落在区间。按时间升序。
#[tauri::command]
pub async fn agenda(
    from: String,
    to: String,
    state: State<'_, AppState>,
) -> Result<Vec<AgendaItem>, String> {
    let pool = &state.db;
    let rems = reminders::list(pool).await.map_err(|e| e.to_string())?;
    let tds = todos::list_due_in_range(pool, &from, &to)
        .await
        .map_err(|e| e.to_string())?;
    let notes_list = notes::list(pool).await.map_err(|e| e.to_string())?;

    let mut items: Vec<AgendaItem> = Vec::new();
    for r in rems.iter().filter(|r| r.enabled) {
        let rep = match &r.repeat_rule_id {
            Some(rid) => reminders::get_repeat(pool, rid).await.ok().flatten(),
            None => None,
        };
        for at in reminders::expand_occurrences(r, rep.as_ref(), &from, &to) {
            items.push(AgendaItem {
                kind: "reminder".into(),
                id: r.id.clone(),
                title: r.title.clone(),
                at,
                note_id: r.note_id.clone(),
                done: None,
            });
        }
    }
    for t in tds {
        items.push(AgendaItem {
            kind: "todo".into(),
            id: t.id,
            title: t.title,
            at: t.due_date.unwrap_or_default(),
            note_id: t.note_id,
            done: Some(t.done),
        });
    }
    // 有日期的便签也进日历
    for n in notes_list.iter().filter(|n| {
        n.date.as_ref().map_or(false, |d| d.as_str() >= from.as_str() && d.as_str() <= to.as_str())
    }) {
        items.push(AgendaItem {
            kind: "note".into(),
            id: n.id.clone(),
            title: if n.title.is_empty() {
                n.content_md.chars().take(12).collect()
            } else {
                n.title.clone()
            },
            at: n.date.clone().unwrap_or_default(),
            note_id: Some(n.id.clone()),
            done: None,
        });
    }
    items.sort_by(|a, b| a.at.cmp(&b.at));
    Ok(items)
}
