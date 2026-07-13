import { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import dayjs from "dayjs";
import { Plus } from "lucide-react";
import Calendar from "../components/Calendar";
import ReminderEditor from "../components/ReminderEditor";
import { ipc } from "../lib/ipc";
import { applyMica, startDrag, startResize, win } from "../lib/window";
import { useApplySettings, useSettingsStore } from "../stores/settingsStore";
import { useRemindersStore } from "../stores/remindersStore";
import { useApplyLang, useLangStore, useT } from "../i18n";
import { fmtMD } from "../i18n/format";
import Signature from "../components/Signature";
import type { AgendaItem, NoteUpdate, Reminder } from "../types";

/** 日历大窗口:点格子=选中(展开);选中态再点=新建选择(便签/待办/提醒)。 */
export default function CalendarWindow() {
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [createAt, setCreateAt] = useState<string | null>(null);
  const [todoCreate, setTodoCreate] = useState<string | null>(null);
  const [todoTitle, setTodoTitle] = useState("");
  const [todoContent, setTodoContent] = useState("");
  const [todoDue, setTodoDue] = useState("");
  const { reminders, load: loadReminders } = useRemindersStore();
  const t = useT();
  const lang = useLangStore((s) => s.lang);

  useEffect(() => {
    applyMica();
    loadReminders();
  }, [loadReminders]);

  useApplySettings();
  useApplyLang();

  const pinToDesktop = useSettingsStore((s) => s.pinToDesktop);
  useEffect(() => {
    win.setAlwaysOnBottom(pinToDesktop).catch(() => {});
  }, [pinToDesktop]);

  useEffect(() => {
    const un: Array<() => void> = [];
    listen("data:changed", () => setRefreshSignal((x) => x + 1)).then((f) => un.push(f));
    listen("reminder:fired", () => setRefreshSignal((x) => x + 1)).then((f) => un.push(f));
    // 便签窗保存后(仅发 note:updated)也刷新日历 agenda。
    listen("note:updated", () => setRefreshSignal((x) => x + 1)).then((f) => un.push(f));
    return () => un.forEach((f) => f());
  }, []);

  function openReminder(dateStr?: string) {
    setEditingReminder(null);
    setReminderDate(dateStr ?? dayjs().format("YYYY-MM-DD"));
    setReminderOpen(true);
  }

  function openEditReminder(r: Reminder) {
    setEditingReminder(r);
    setReminderOpen(true);
  }

  function handleItemClick(item: AgendaItem) {
    if (item.kind === "reminder") {
      const r = reminders.find((x) => x.id === item.id);
      if (r) openEditReminder(r);
    } else if (item.kind === "todo") {
      ipc.toggleTodo(item.id, !item.done)
        .then(() => { setRefreshSignal((x) => x + 1); emit("data:changed", null); })
        .catch((e) => console.error("toggle todo in calendar failed", e));
    } else if (item.note_id) {
      ipc.openNoteWindow(item.note_id).catch(console.error);
    }
  }

  // 新建选择器:便签(带日期→进日历)/待办(due_date=该日)/提醒(打开编辑器)
  async function createNoteAt(dateStr: string) {
    setCreateAt(null);
    try {
      const color = useSettingsStore.getState().defaultNoteColor;
      const n = await ipc.createNote("", color, null);
      const update: NoteUpdate = {
        id: n.id, title: "", content_md: "", content_json: null, color: n.color,
        category_id: null, is_pinned_desktop: false, is_always_on_top: false,
        x: null, y: null, w: null, h: null, date: dateStr,
      };
      await ipc.updateNote(update);
      await ipc.openNoteWindow(n.id);
      emit("data:changed", null);
    } catch (e) { console.error("create note at date failed", e); }
  }

  // 打开待办创建表单(预填日期,先编辑再创建)
  function openTodoCreate(dateStr: string) {
    setCreateAt(null);
    setTodoTitle("");
    setTodoContent("");
    setTodoDue(dateStr + "T09:00");
    setTodoCreate(dateStr);
  }

  async function saveTodoCreate() {
    if (!todoTitle.trim() || !todoCreate) return;
    const due_date = todoDue ? (todoDue.length === 16 ? todoDue + ":00" : todoDue) : null;
    try {
      await ipc.createTodo({ note_id: null, title: todoTitle.trim(), content: todoContent, due_date });
      emit("data:changed", null);
      setRefreshSignal((x) => x + 1);
      setTodoCreate(null);
    } catch (e) {
      console.error("create todo failed", e);
    }
  }

  return (
    <div className="cal-win">
      <div className="titlebar" onMouseDown={startDrag}>
        <span className="title">{t("app.brand")} · {t("cal.title")}</span>
        <div className="titlebar-spacer" />
        <Signature variant="inline" style={{ opacity: 0.5 }} />
        <button className="btn-primary" onMouseDown={(e) => e.stopPropagation()} onClick={() => openReminder()}>
          <Plus size={14} /> {t("action.newReminder")}
        </button>
        <button className="icon-btn" onMouseDown={(e) => e.stopPropagation()} onClick={() => win.minimize()} title={t("action.minimize")}>—</button>
        <button className="icon-btn" onMouseDown={(e) => e.stopPropagation()} onClick={() => win.close()} title={t("action.close")}>×</button>
      </div>
      <Calendar
        refreshSignal={refreshSignal}
        onCreateAt={(d) => setCreateAt(d)}
        onItemClick={handleItemClick}
      />

      {/* 新建选择器 */}
      {createAt && (
        <div className="modal-overlay" onClick={() => setCreateAt(null)}>
          <div className="modal create-chooser" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{t("cal.createAt", { date: fmtMD(createAt, lang) })}</div>
            <div className="create-choices">
              <button className="btn-primary" onClick={() => void createNoteAt(createAt)}>{t("nav.notes")}</button>
              <button className="btn-primary" onClick={() => openTodoCreate(createAt)}>{t("nav.todos")}</button>
              <button className="btn-primary" onClick={() => { setCreateAt(null); openReminder(createAt); }}>{t("nav.reminders")}</button>
            </div>
          </div>
        </div>
      )}

      {/* 待办创建表单(先编辑再创建) */}
      {todoCreate && (
        <div className="modal-overlay" onClick={() => setTodoCreate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{t("cal.newTodoTitle", { date: fmtMD(todoCreate, lang) })}</div>
            <div className="todo-add-box" style={{ marginBottom: 0 }}>
              <textarea className="todo-edit-input" value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder={t("todo.titlePlaceholder")} autoFocus rows={1} />
              <textarea className="todo-edit-input" value={todoContent} onChange={(e) => setTodoContent(e.target.value)} placeholder={t("todo.bodyPlaceholder")} rows={1} />
              <div className="todo-add-bottom">
                <input type="datetime-local" value={todoDue} onChange={(e) => setTodoDue(e.target.value)} />
                <button className="btn-primary" onClick={() => void saveTodoCreate()} disabled={!todoTitle.trim()}>{t("action.create")}</button>
              </div>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-spacer" />
              <button className="btn-ghost" onClick={() => setTodoCreate(null)}>{t("action.cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {reminderOpen && (
        <ReminderEditor
          initialDate={reminderDate || dayjs().format("YYYY-MM-DD")}
          editing={editingReminder}
          onClose={() => { setReminderOpen(false); setEditingReminder(null); }}
          onSaved={() => { loadReminders(); setRefreshSignal((x) => x + 1); }}
        />
      )}
      <div className="resize-handle-s" onMouseDown={() => startResize("South")} title={t("action.dragResize")} />
    </div>
  );
}
