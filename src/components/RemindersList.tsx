import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import dayjs from "dayjs";
import { useReorder } from "../lib/useReorder";
import { useRemindersStore } from "../stores/remindersStore";
import { useT } from "../i18n";
import SwipeToDelete from "./SwipeToDelete";
import type { Reminder, RepeatInput } from "../types";

// repeat_kind → 翻译 key(未知 kind 回退 reminder.repeatFallback)。
const REPEAT_LABEL: Record<string, string> = {
  daily: "reminder.daily",
  weekly: "reminder.weekly",
  monthly: "reminder.monthly",
  yearly: "reminder.yearly",
};

type RepeatKind = "none" | "daily" | "weekly" | "monthly" | "yearly";

/** 提醒管理面板:双击行内编辑(标题/时间/重复),滑动删除,启用/停用。 */
export default function RemindersList() {
  const { reminders, load, update, setEnabled, remove, reorder, loading: remindersLoading } = useRemindersStore();
  const t = useT();

  const { getOffset, onStart, onMove, onEnd } = useReorder<Reminder>(reminders, (newRems) => {
    reorder(newRems);
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDt, setEditDt] = useState("");
  const [editRepeat, setEditRepeat] = useState<RepeatKind>("none");
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load();
  }, [load]);

  // 编辑中点外部→取消(与 SwipeToDelete/TodoList 一致)
  useEffect(() => {
    if (!editingId) return;
    function onDocClick(e: MouseEvent) {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditingId(null);
      }
    }
    const timer = setTimeout(() => document.addEventListener("click", onDocClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", onDocClick);
    };
  }, [editingId]);

  const nowStr = dayjs().format("YYYY-MM-DDTHH:mm:ss");

  function startInlineEdit(r: Reminder) {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditDt((r.next_fire_at ?? r.fire_at).slice(0, 16));
    setEditRepeat((r.repeat_kind as RepeatKind) ?? "none");
  }

  async function saveInlineEdit(r: Reminder) {
    const fire_at = editDt.length === 16 ? editDt + ":00" : editDt;
    const rep: RepeatInput | null =
      editRepeat === "none" ? null : { kind: editRepeat, interval: 1 };
    try {
      await update({
        id: r.id,
        title: editTitle.trim() || r.title,
        fire_at,
        note_id: r.note_id,
        repeat: rep,
      });
      setEditingId(null);
    } catch (e) {
      console.error("save reminder failed", e);
    }
  }

  return (
    <div className="todo-panel">
      <div className="todo-list">
        {remindersLoading && reminders.length === 0 && <div className="empty">{t("todo.loading")}</div>}
        {!remindersLoading && reminders.length === 0 && (
          <div className="empty"><Bell size={28} style={{ opacity: 0.4 }} /><span>{t("reminder.empty")}</span></div>
        )}
        {reminders.map((r, idx) => {
          const at = r.next_fire_at ?? r.fire_at;
          const past = r.enabled && at.localeCompare(nowStr) < 0;

          if (editingId === r.id) {
            return (
              <div key={r.id} className="todo-row editing" ref={editRef}>
                <textarea
                  className="todo-edit-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t("reminder.content")}
                  spellCheck={false}
                  autoFocus
                  rows={1}
                />
                <div className="todo-edit-actions">
                  <input type="datetime-local" value={editDt} onChange={(e) => setEditDt(e.target.value)} />
                  <select value={editRepeat} onChange={(e) => setEditRepeat(e.target.value as RepeatKind)}>
                    <option value="none">{t("reminder.none")}</option>
                    <option value="daily">{t("reminder.daily")}</option>
                    <option value="weekly">{t("reminder.weekly")}</option>
                    <option value="monthly">{t("reminder.monthly")}</option>
                    <option value="yearly">{t("reminder.yearly")}</option>
                  </select>
                  <button className="note-icon-btn" onClick={() => void saveInlineEdit(r)} title={t("action.save")}>✓</button>
                  <button className="note-icon-btn" onClick={() => setEditingId(null)} title={t("action.cancel")}>✗</button>
                </div>
              </div>
            );
          }

          return (
            <SwipeToDelete
              key={r.id}
              onDelete={() => void remove(r.id)}
              reorderOffset={getOffset(idx)}
              onReorderStart={(y) => onStart(idx, y)}
              onReorderMove={onMove}
              onReorderEnd={onEnd}
            >
              <div
                className={"todo-row" + (r.enabled ? "" : " disabled")}
                onDoubleClick={() => startInlineEdit(r)}
              >
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => void setEnabled(r.id, e.target.checked)}
                  title={t("reminder.enableToggle")}
                />
                <div className="todo-main">
                  <div className="todo-title">{r.title}</div>
                  <div className="todo-meta">
                    <span className={"todo-due" + (past ? " overdue" : "")}>
                      ⏰ {dayjs(at).format("MM-DD HH:mm")}
                    </span>
                    {r.repeat_kind && (
                      <span className="todo-repeat">🔁 {t(REPEAT_LABEL[r.repeat_kind] ?? "reminder.repeatFallback")}</span>
                    )}
                  </div>
                </div>
              </div>
            </SwipeToDelete>
          );
        })}
      </div>
    </div>
  );
}
