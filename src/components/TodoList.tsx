import { type FormEvent, useEffect, useRef, useState } from "react";
import { ListTodo } from "lucide-react";
import dayjs from "dayjs";
import { ipc } from "../lib/ipc";
import { useReorder } from "../lib/useReorder";
import { useNotesStore } from "../stores/notesStore";
import { useTodosStore } from "../stores/todosStore";
import { useUiStore } from "../stores/uiStore";
import { t, useT } from "../i18n";
import SwipeToDelete from "./SwipeToDelete";
import type { Note, Todo } from "../types";

function noteLabel(n: Note): string {
  const title = n.title?.trim();
  if (title) return title;
  if (n.content_md) return n.content_md.replace(/\s+/g, " ").slice(0, 14);
  return t("note.empty");
}

/** 待办面板:独立待办(不强制归属便签)+标题/正文/截止时间。勾选/行内编辑/删除/清除已完成。 */
export default function TodoList() {
  const { todos, load, create, update, toggle, remove, reorder, loading: todosLoading } = useTodosStore();
  const { notes, load: loadNotes } = useNotesStore();
  const { push: pushToast } = useUiStore();
  const t = useT();

  const { getOffset, onStart, onMove, onEnd } = useReorder<Todo>(todos, (newTodos) => {
    // 乐观更新 + 批量持久化(单次 IPC,替代旧 N+1 顺序 updateTodo)。
    reorder(newTodos);
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [due, setDue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editDue, setEditDue] = useState("");

  useEffect(() => {
    load();
    loadNotes();
  }, [load, loadNotes]);

  // 编辑中点外部→取消(与 SwipeToDelete 一致)
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

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const due_date = due ? due + ":00" : null;
      await create({ note_id: null, title: title.trim(), content: content.trim(), due_date });
      setTitle("");
      setContent("");
      setDue("");
    } catch (err) {
      pushToast(t("todo.addFail") + String(err));
    }
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditContent(todo.content);
    setEditDue(todo.due_date ? todo.due_date.slice(0, 16) : "");
  }

  async function saveEdit(todo: Todo) {
    try {
      const due_date = editDue ? editDue + ":00" : null;
      await update({
        id: todo.id,
        title: editTitle.trim() || todo.title,
        content: editContent.trim(),
        done: todo.done,
        due_date,
        sort_order: todo.sort_order,
      });
      setEditingId(null);
    } catch (err) {
      pushToast(t("todo.saveFail") + String(err));
    }
  }

  async function clearCompleted() {
    const done = todos.filter((todo) => todo.done);
    await Promise.all(done.map((todo) => remove(todo.id).catch(() => {})));
  }

  const doneCount = todos.filter((todo) => todo.done).length;
  const nowStr = dayjs().format("YYYY-MM-DDTHH:mm:ss");

  return (
    <div className="todo-panel">
      <form className="todo-add-box" onSubmit={add}>
        <textarea
          className="todo-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("todo.titlePlaceholder")}
          spellCheck={false}
          rows={1}
        />
        <textarea
          className="todo-content-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("todo.bodyPlaceholder")}
          spellCheck={false}
          rows={1}
        />
        <div className="todo-add-bottom">
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            title={t("todo.dueTooltip")}
          />
          <button type="submit" className="btn-primary" disabled={!title.trim()}>
            {t("action.add")}
          </button>
        </div>
      </form>

      <button className="btn-ghost todo-clear-btn" onClick={clearCompleted}>
        {t("todo.clearCompleted")}{doneCount > 0 ? `(${doneCount})` : ""}
      </button>

      <div className="todo-list">
        {todosLoading && todos.length === 0 && <div className="empty">{t("todo.loading")}</div>}
        {!todosLoading && todos.length === 0 && <div className="empty"><ListTodo size={28} style={{ opacity: 0.4 }} /><span>{t("todo.empty")}</span></div>}
        {todos.map((todo, idx) => {
          if (editingId === todo.id) {
            return (
              <div key={todo.id} className="todo-row editing" ref={editRef}>
                <textarea className="todo-edit-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t("note.title")} spellCheck={false} autoFocus rows={1} />
                <textarea className="todo-edit-input" value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder={t("todo.bodyPlaceholderEdit")} spellCheck={false} rows={1} />
                <div className="todo-edit-actions">
                  <input type="datetime-local" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                  <button className="note-icon-btn" onClick={() => void saveEdit(todo)} title={t("action.save")}>✓</button>
                  <button className="note-icon-btn" onClick={() => setEditingId(null)} title={t("action.cancel")}>✗</button>
                </div>
              </div>
            );
          }
          const note = todo.note_id ? notes.find((n) => n.id === todo.note_id) : undefined;
          const overdue = !todo.done && todo.due_date ? todo.due_date.localeCompare(nowStr) < 0 : false;
          return (
            <SwipeToDelete
              key={todo.id}
              onDelete={() => void remove(todo.id).catch((err) => pushToast(t("todo.delFail") + String(err)))}
              reorderOffset={getOffset(idx)}
              onReorderStart={(y) => onStart(idx, y)}
              onReorderMove={onMove}
              onReorderEnd={onEnd}
            >
              <div className={"todo-row" + (todo.done ? " done" : "")} onDoubleClick={() => startEdit(todo)}>
                <input type="checkbox" checked={todo.done} onChange={(e) => void toggle(todo.id, e.target.checked).catch((err) => pushToast(t("todo.toggleFail") + String(err)))} title={t("action.complete")} />
                <div className="todo-main">
                  <div className="todo-title">{todo.title}</div>
                  {todo.content && <div className="todo-content">{todo.content}</div>}
                  <div className="todo-meta">
                    {note && todo.note_id && (<span className="todo-note" onClick={() => ipc.openNoteWindow(todo.note_id!).catch(console.error)}>📝 {noteLabel(note)}</span>)}
                    {todo.due_date && (<span className={"todo-due" + (overdue ? " overdue" : "")}>⏰ {dayjs(todo.due_date).format("MM-DD HH:mm")}</span>)}
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
