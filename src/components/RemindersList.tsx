import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { useReorder } from "../lib/useReorder";
import { useRemindersStore } from "../stores/remindersStore";
import SwipeToDelete from "./SwipeToDelete";
import type { Reminder, RepeatInput } from "../types";

const REPEAT_LABEL: Record<string, string> = {
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
};

type RepeatKind = "none" | "daily" | "weekly" | "monthly" | "yearly";

/** 提醒管理面板:双击行内编辑(标题/时间/重复),滑动删除,启用/停用。 */
export default function RemindersList() {
  const { reminders, load, update, setEnabled, remove, reorder, loading: remindersLoading } = useRemindersStore();

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
        {remindersLoading && reminders.length === 0 && <div className="empty">加载中…</div>}
        {!remindersLoading && reminders.length === 0 && (
          <div className="empty">还没有提醒,点右上角"新建提醒",或在日历点某日期</div>
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
                  placeholder="提醒内容"
                  spellCheck={false}
                  autoFocus
                  rows={1}
                />
                <div className="todo-edit-actions">
                  <input type="datetime-local" value={editDt} onChange={(e) => setEditDt(e.target.value)} />
                  <select value={editRepeat} onChange={(e) => setEditRepeat(e.target.value as RepeatKind)}>
                    <option value="none">不重复</option>
                    <option value="daily">每天</option>
                    <option value="weekly">每周</option>
                    <option value="monthly">每月</option>
                    <option value="yearly">每年</option>
                  </select>
                  <button className="note-icon-btn" onClick={() => void saveInlineEdit(r)} title="保存">✓</button>
                  <button className="note-icon-btn" onClick={() => setEditingId(null)} title="取消">✗</button>
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
                  title="启用/停用"
                />
                <div className="todo-main">
                  <div className="todo-title">{r.title}</div>
                  <div className="todo-meta">
                    <span className={"todo-due" + (past ? " overdue" : "")}>
                      ⏰ {dayjs(at).format("MM-DD HH:mm")}
                    </span>
                    {r.repeat_kind && (
                      <span className="todo-repeat">🔁 {REPEAT_LABEL[r.repeat_kind] ?? "重复"}</span>
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
