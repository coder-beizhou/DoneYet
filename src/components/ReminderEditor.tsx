import { type FormEvent, useEffect, useState } from "react";
import { useNotesStore } from "../stores/notesStore";
import { useRemindersStore } from "../stores/remindersStore";
import type { Reminder, RepeatInput } from "../types";

type RepeatKind = "none" | "daily" | "weekly" | "monthly" | "yearly";

/**
 * 提醒编辑器(模态)。新建与编辑共用:都可选重复规则。
 * 编辑模式预填 title/时间(从 next_fire_at)/关联便签/重复(从 repeat_kind),并显示删除按钮。
 */
export default function ReminderEditor({
  initialDate,
  editing,
  onClose,
  onSaved,
}: {
  initialDate: string; // YYYY-MM-DD(新建模式默认日期)
  editing?: Reminder | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notes } = useNotesStore();
  const { create, update, remove } = useRemindersStore();
  const [title, setTitle] = useState(editing?.title ?? "");
  // 编辑模式从 next_fire_at(实际下次触发)预填,而非 fire_at(原始首次,可能早已过去)。
  const [dt, setDt] = useState(
    (editing?.next_fire_at ?? editing?.fire_at ?? `${initialDate}T09:00`).slice(0, 16),
  );
  const [repeat, setRepeat] = useState<RepeatKind>(
    (editing?.repeat_kind as RepeatKind) ?? "none",
  );
  const [noteId, setNoteId] = useState(editing?.note_id ?? "");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dt) return;
    const fire_at = dt.length === 16 ? dt + ":00" : dt;
    const rep: RepeatInput | null =
      repeat === "none" ? null : { kind: repeat, interval: 1 };
    try {
      if (editing) {
        await update({
          id: editing.id,
          title: title.trim(),
          fire_at,
          note_id: noteId || null,
          repeat: rep,
        });
      } else {
        await create({
          title: title.trim(),
          fire_at,
          note_id: noteId || null,
          repeat: rep,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("save reminder failed", err);
    }
  }

  async function del() {
    if (!editing) return;
    if (!confirmDel) {
      // 两步内联确认(无弹窗):首次点击变"确认删除?",3s 内再点才删。
      setConfirmDel(true);
      setTimeout(() => setConfirmDel(false), 3000);
      return;
    }
    try {
      await remove(editing.id);
      onSaved();
      onClose();
    } catch (e) {
      console.error("delete reminder failed", e);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{editing ? "编辑提醒" : "新建提醒"}</div>
        <form className="reminder-form" onSubmit={submit}>
          <input
            className="reminder-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="提醒内容"
            autoFocus
            spellCheck={false}
          />
          <label className="field">
            <span>时间</span>
            <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} />
          </label>
          <label className="field">
            <span>重复</span>
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
              <option value="none">不重复</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
            </select>
          </label>
          <label className="field">
            <span>关联便签</span>
            <select value={noteId} onChange={(e) => setNoteId(e.target.value)}>
              <option value="">(无)</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title || "无标题"}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            {editing && (
              <button type="button" className={"btn-danger" + (confirmDel ? " confirming" : "")} onClick={del}>
                {confirmDel ? "确认删除?" : "删除"}
              </button>
            )}
            <div className="modal-actions-spacer" />
            <button type="button" className="btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
