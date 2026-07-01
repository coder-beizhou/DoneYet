import { type FormEvent, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { emit } from "@tauri-apps/api/event";
import { ipc } from "../lib/ipc";
import { useReorder } from "../lib/useReorder";
import { useNotesStore } from "../stores/notesStore";
import { useTodosStore } from "../stores/todosStore";
import { useUiStore } from "../stores/uiStore";
import SwipeToDelete from "./SwipeToDelete";
import type { Note, Todo } from "../types";

function noteLabel(n: Note): string {
  const t = n.title?.trim();
  if (t) return t;
  if (n.content_md) return n.content_md.replace(/\s+/g, " ").slice(0, 14);
  return "空便签";
}

/** 待办面板:独立待办(不强制归属便签)+标题/正文/截止时间。勾选/行内编辑/删除/清除已完成。 */
export default function TodoList() {
  const { todos, load, create, update, toggle, remove, loading: todosLoading } = useTodosStore();
  const { notes, load: loadNotes } = useNotesStore();
  const { push: pushToast } = useUiStore();

  const { getOffset, onStart, onMove, onEnd } = useReorder<Todo>(todos, async (newTodos) => {
    // 保存新顺序到后端(更新 sort_order)
    for (let i = 0; i < newTodos.length; i++) {
      await ipc.updateTodo({
        id: newTodos[i].id, title: newTodos[i].title, content: newTodos[i].content,
        done: newTodos[i].done, due_date: newTodos[i].due_date, sort_order: i,
      });
    }
    emit("data:changed", null);
    load();
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
      pushToast("添加待办失败：" + String(err));
    }
  }

  function startEdit(t: Todo) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditContent(t.content);
    setEditDue(t.due_date ? t.due_date.slice(0, 16) : "");
  }

  async function saveEdit(t: Todo) {
    try {
      const due_date = editDue ? editDue + ":00" : null;
      await update({
        id: t.id,
        title: editTitle.trim() || t.title,
        content: editContent.trim(),
        done: t.done,
        due_date,
        sort_order: t.sort_order,
      });
      setEditingId(null);
    } catch (err) {
      pushToast("保存待办失败：" + String(err));
    }
  }

  async function clearCompleted() {
    const done = todos.filter((t) => t.done);
    await Promise.all(done.map((t) => remove(t.id).catch(() => {})));
  }

  const doneCount = todos.filter((t) => t.done).length;
  const nowStr = dayjs().format("YYYY-MM-DDTHH:mm:ss");

  return (
    <div className="todo-panel">
      <form className="todo-add-box" onSubmit={add}>
        <textarea
          className="todo-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="待办标题…"
          spellCheck={false}
          rows={1}
        />
        <textarea
          className="todo-content-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="正文(可选)…"
          spellCheck={false}
          rows={1}
        />
        <div className="todo-add-bottom">
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            title="截止时间(可选,到点提醒)"
          />
          <button type="submit" className="btn-primary" disabled={!title.trim()}>
            添加
          </button>
        </div>
      </form>

      <button className="btn-ghost todo-clear-btn" onClick={clearCompleted}>
        清除已完成{doneCount > 0 ? `(${doneCount})` : ""}
      </button>

      <div className="todo-list">
        {todosLoading && todos.length === 0 && <div className="empty">加载中…</div>}
        {!todosLoading && todos.length === 0 && <div className="empty">还没有待办</div>}
        {todos.map((t, idx) => {
          if (editingId === t.id) {
            return (
              <div key={t.id} className="todo-row editing" ref={editRef}>
                <textarea className="todo-edit-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="标题" spellCheck={false} autoFocus rows={1} />
                <textarea className="todo-edit-input" value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="正文…" spellCheck={false} rows={1} />
                <div className="todo-edit-actions">
                  <input type="datetime-local" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                  <button className="note-icon-btn" onClick={() => void saveEdit(t)} title="保存">✓</button>
                  <button className="note-icon-btn" onClick={() => setEditingId(null)} title="取消">✗</button>
                </div>
              </div>
            );
          }
          const note = t.note_id ? notes.find((n) => n.id === t.note_id) : undefined;
          const overdue = !t.done && t.due_date ? t.due_date.localeCompare(nowStr) < 0 : false;
          return (
            <SwipeToDelete
              key={t.id}
              onDelete={() => void remove(t.id).catch((err) => pushToast("删除失败：" + String(err)))}
              reorderOffset={getOffset(idx)}
              onReorderStart={(y) => onStart(idx, y)}
              onReorderMove={onMove}
              onReorderEnd={onEnd}
            >
              <div className={"todo-row" + (t.done ? " done" : "")} onDoubleClick={() => startEdit(t)}>
                <input type="checkbox" checked={t.done} onChange={(e) => void toggle(t.id, e.target.checked).catch((err) => pushToast("切换失败：" + String(err)))} title="完成" />
                <div className="todo-main">
                  <div className="todo-title">{t.title}</div>
                  {t.content && <div className="todo-content">{t.content}</div>}
                  <div className="todo-meta">
                    {note && t.note_id && (<span className="todo-note" onClick={() => ipc.openNoteWindow(t.note_id!).catch(console.error)}>📝 {noteLabel(note)}</span>)}
                    {t.due_date && (<span className={"todo-due" + (overdue ? " overdue" : "")}>⏰ {dayjs(t.due_date).format("MM-DD HH:mm")}</span>)}
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
