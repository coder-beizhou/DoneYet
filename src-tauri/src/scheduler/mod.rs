use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::db::repo::{reminders, todos};
use crate::db::repo::todos::Todo;
use crate::i18n;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

/// 启动提醒调度器:每 30s 一次,处理到期 reminders 与过期待办。
/// - 每个 tick 独立 spawn,panic 隔离不杀整个调度任务(supervisor 捕获 JoinError 继续)。
/// - reminders:先 mark_fired(推进 next_fire_at)再通知,防 mark_fired 失败致下轮重复通知。
/// - 通知/emit 失败仅 log 不中断。首 tick 延迟 2s 让主面板挂载并 attach 事件监听。
pub fn start(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let notified: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));
        tokio::time::sleep(Duration::from_secs(2)).await;
        loop {
            let app2 = app.clone();
            let notified2 = notified.clone();
            let join = tokio::task::spawn(async move { tick(&app2, &notified2).await }).await;
            if let Err(e) = join {
                log::error!("reminder scheduler tick panicked (isolated, will continue): {e}");
            }
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });
}

async fn tick(app: &AppHandle, notified: &Arc<Mutex<HashSet<String>>>) -> anyhow::Result<()> {
    let pool = app.state::<AppState>().db.clone();
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let lang = app.state::<AppState>().lang();

    // 1) 到期提醒:先 mark_fired 再通知(失败则跳过通知,下轮重试,不重复通知)
    let due = reminders::list_due(&pool, &now).await?;
    for r in due {
        if let Err(e) = reminders::mark_fired(&pool, &r.id, &now).await {
            log::error!("mark_fired {} failed (skip notify this round): {e}", r.id);
            continue;
        }
        if let Err(e) = app
            .notification()
            .builder()
            .title(i18n::win_reminder(&lang))
            .body(&r.title)
            .show()
        {
            log::warn!("reminder notification show failed: {e}");
        }
        let _ = app.emit("reminder:fired", &r);
    }

    // 2) 过期待办(内存去重,同 id 只通知一次;重启后重置——已知限制)
    let overdue = todos::list_overdue(&pool, &now).await?;
    let to_notify: Vec<Todo> = {
        let mut set = notified.lock().unwrap_or_else(|e| e.into_inner());
        overdue
            .into_iter()
            .filter(|t| set.insert(t.id.clone()))
            .collect()
    };
    for t in to_notify {
        if let Err(e) = app
            .notification()
            .builder()
            .title(i18n::win_todo_due(&lang))
            .body(&t.title)
            .show()
        {
            log::warn!("todo notification show failed: {e}");
        }
        let _ = app.emit("todo:overdue", &t);
    }

    Ok(())
}
