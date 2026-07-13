import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { listen } from "@tauri-apps/api/event";
import { Bell, Calculator as CalcIcon, Clock, Minus, Plus, Settings as SettingsIcon, StickyNote, X } from "lucide-react";
import ReminderEditor from "../components/ReminderEditor";
import RemindersList from "../components/RemindersList";
import Settings from "../components/Settings";
import SwipeToDelete from "../components/SwipeToDelete";
import Timeline from "../components/Timeline";
import TodoList from "../components/TodoList";
import { ipc } from "../lib/ipc";
import { useReorder } from "../lib/useReorder";
import { startDrag, startResize, win } from "../lib/window";
import { useCategoriesStore } from "../stores/categoriesStore";
import { useNotesStore } from "../stores/notesStore";
import { useRemindersStore } from "../stores/remindersStore";
import { useApplySettings, useSettingsStore } from "../stores/settingsStore";
import { useTodosStore } from "../stores/todosStore";
import { useUiStore } from "../stores/uiStore";
import { useUndoStore } from "../stores/undoStore";
import { t, useApplyLang, useT } from "../i18n";
import { triggerEasterEgg } from "../lib/easterEgg";
import Signature from "../components/Signature";
import type { Note, Reminder, Todo } from "../types";

type View = string; // "notes" | "todos" | "reminders" | "cat:<id>"

/** 剥离 markdown 符号,供便签卡预览显示纯文本(content_md 现存真 markdown)。 */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+\[[ xX]\]\s?/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__>/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** 分类书签颜色轮转(收缩时首字带色,便于分辨)。 */
const CAT_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6"];

/** 便签卡:双击打开;SwipeToDelete 包裹(滑动删除+长按排序)。 */
function NoteCard({ n, onOpen, onDelete, reorderOffset, onReorderStart, onReorderMove, onReorderEnd }: {
  n: Note; onOpen: () => void; onDelete: () => void;
  reorderOffset?: number;
  onReorderStart?: (y: number) => void;
  onReorderMove?: (y: number) => void;
  onReorderEnd?: () => void;
}) {
  return (
    <SwipeToDelete
      onDelete={onDelete}
      reorderOffset={reorderOffset}
      onReorderStart={onReorderStart}
      onReorderMove={onReorderMove}
      onReorderEnd={onReorderEnd}
    >
      <div className="note-card" style={{ borderTopColor: n.color }} onDoubleClick={onOpen}>
        <div className="note-card-title">{n.title || t("note.untitled")}</div>
        <div className="note-card-preview">{n.content_md ? stripMarkdown(n.content_md) : t("note.empty")}</div>
      </div>
    </SwipeToDelete>
  );
}

export default function Dashboard() {
  const { notes, load, create, remove, reorder: reorderNotes, loading: notesLoading } = useNotesStore();
  const { load: loadTodos } = useTodosStore();
  const { load: loadReminders } = useRemindersStore();
  const { categories, load: loadCategories, create: createCategory, remove: removeCategory } =
    useCategoriesStore();
  const { toast, push: pushToast, clear: clearToast } = useUiStore();
  const undoStore = useUndoStore();
  const t = useT();


  const [view, setView] = useState<View>("notes");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<"timeline" | "calc" | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [removingCatId, setRemovingCatId] = useState<string | null>(null);

  // viewRef 持有最新 view,供一次性注册的事件监听(tray/shortcut:new-note)读取,
  // 否则闭包捕获首次渲染的 view('notes'),在分类书签下用快捷键建便签会归错类。
  const viewRef = useRef(view);
  viewRef.current = view;

  // 主界面彩蛋入口:左上角品牌名连点 5 次 → 触发(与 Konami 码、署名连点同效果)。
  const brandClicks = useRef(0);
  function onBrandClick() {
    const n = ++brandClicks.current;
    if (n >= 5) {
      brandClicks.current = 0;
      triggerEasterEgg();
    } else if (n >= 3) {
      pushToast(t("egg.hint", { n: 5 - n }));
    }
  }

  useEffect(() => {
    load();
    loadTodos();
    loadReminders();
    loadCategories();
  }, [load, loadTodos, loadReminders, loadCategories]);

  // 主题/字号应用 + 跨窗口同步。
  useApplySettings();
  // 语言同步到后端(托盘/标题)+ document.lang + 跨窗口同步。
  useApplyLang();

  // Ctrl+Z 撤销 / Ctrl+Y 或 Ctrl+Shift+Z 重做
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const peek = undoStore.peek();
        if (peek) {
          void undoStore.undo();
          pushToast(t("dash.undo", { label: peek.label }));
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (undoStore.canRedo()) {
          void undoStore.redo();
          pushToast(t("dash.redo"));
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoStore, pushToast]);

  // 固定到桌面最底层(主界面)。
  const pinToDesktop = useSettingsStore((s) => s.pinToDesktop);
  useEffect(() => {
    win.setAlwaysOnBottom(pinToDesktop).catch(() => {});
  }, [pinToDesktop]);

  async function handleClose() {
    if (useSettingsStore.getState().closeBehavior === "tray") {
      await win.hide();
      pushToast(t("dash.minToTrayToast"));
    } else {
      await ipc.quitApp();
    }
  }

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    win.onCloseRequested(async (e) => {
      e.preventDefault();
      await handleClose();
    }).then((f) => (unlisten = f));
    return () => {
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function newNote() {
    try {
      const v = viewRef.current;
      const catId = v.startsWith("cat:") ? v.slice(4) : null;
      const n = await create(catId);
      await ipc.openNoteWindow(n.id);
    } catch (e) {
      pushToast(t("dash.newNoteFail") + String(e));
    }
  }

  function openReminder(dateStr?: string) {
    setEditingReminder(null);
    setReminderDate(dateStr ?? dayjs().format("YYYY-MM-DD"));
    setReminderOpen(true);
  }

  async function removeNote(id: string) {
    const note = notes.find((n) => n.id === id);
    try {
      await remove(id);
      await ipc.closeNoteWindow(id);
      // 推入撤销栈:撤销=重新创建(restore via createNote + updateNote),重做=再删
      if (note) {
        undoStore.push({
          label: t("dash.delNoteLabel", { title: note.title || t("note.untitled") }),
          undo: async () => {
            // 方案B:undelete 清 deleted_at,便签连同子表(todos/reminders/repeats,因 soft_delete 仅墓碑未删)完整恢复。
            await ipc.undeleteNote(note.id);
            load();
            loadTodos();
            loadReminders();
          },
          redo: async () => {
            await remove(note.id);
            await ipc.closeNoteWindow(note.id);
          },
        });
      }
    } catch (e) {
      pushToast(t("dash.delFail") + String(e));
    }
  }

  // + 书签:内联输入框(回车建,Esc 取消),无原生 prompt 弹窗。
  async function createBookmark() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    if (trimmed.length > 7) {
      pushToast(t("dash.nameTooLong"));
      return;
    }
    try {
      const color = CAT_COLORS[categories.length % CAT_COLORS.length];
      const c = await createCategory({ name: trimmed, color });
      setView("cat:" + c.id);
    } catch (e) {
      pushToast(t("dash.newBookmarkFail") + String(e));
    }
    setAdding(false);
    setNewName("");
  }

  // 右键 → 滑出动画后删除(无 confirm 弹窗)。
  async function deleteBookmark(id: string, name: string) {
    setRemovingCatId(id);
    setTimeout(async () => {
      try {
        await removeCategory(id);
        if (viewRef.current === "cat:" + id) setView("notes");
        load();
        pushToast(t("dash.delBookmarkToast", { name }));
      } catch (e) {
        pushToast(t("dash.delBookmarkFail") + String(e));
      }
      setRemovingCatId(null);
    }, 220);
  }

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    listen("tray:new-note", () => void newNote()).then((f) => unlisteners.push(f));
    listen("shortcut:new-note", () => void newNote()).then((f) => unlisteners.push(f));
    // 日历/其他窗口创建/删除/修改了数据 → 刷新全部 store(便签/待办/提醒)
    listen("data:changed", () => {
      load();
      loadTodos();
      loadReminders();
    }).then((f) => unlisteners.push(f));
    listen<Reminder>("reminder:fired", async (e) => {
      pushToast(t("dash.reminderToast", { title: e.payload.title }));
      loadReminders();
      try {
        await win.show();
        await win.setFocus();
      } catch (err) {
        console.error("show main on reminder failed", err);
      }
    }).then((f) => unlisteners.push(f));
    listen<Todo>("todo:overdue", (e) => pushToast(t("dash.todoOverdueToast", { title: e.payload.title }))).then((f) =>
      unlisteners.push(f),
    );
    // 便签窗编辑保存 → 刷新主界面便签列表(预览/排序及时);data:changed 已由上面的全量监听处理,不重复注册。
    listen("note:updated", () => void load()).then((f) => unlisteners.push(f));
    return () => unlisteners.forEach((f) => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => clearToast(), 4000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  // Konami 彩蛋:↑↑↓↓←→←→BA → 触发(与署名连点 5 次同效果)。
  useEffect(() => {
    const SEQ = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
    let pos = 0;
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === SEQ[pos]) {
        pos++;
        if (pos === SEQ.length) {
          pos = 0;
          triggerEasterEgg();
        }
      } else {
        pos = k === SEQ[0] ? 1 : 0;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleNotes = view.startsWith("cat:") ? notes.filter((n) => n.category_id === view.slice(4)) : notes;

  // 便签拖拽排序(和待办/提醒统一:直接更新 store state)
  const { getOffset: noteGetOffset, onStart: noteOnStart, onMove: noteOnMove, onEnd: noteOnEnd } =
    useReorder<Note>(visibleNotes, (newNotes) => {
      // 如果在看全量便签,直接替换;如果在看分类,需要合并回全量
      if (view === "notes") {
        reorderNotes(newNotes);
      } else {
        const catId = view.slice(4);
        const other = notes.filter((n) => n.category_id !== catId);
        reorderNotes([...newNotes, ...other]);
      }
    }, 95);

  return (
    <div className="dashboard">
      <div className="bookmark-strip">
        <button className={"bookmark" + (view === "notes" ? " active" : "")} onClick={() => setView("notes")} title={t("nav.notes")}>
          <span className="bm-text">{t("nav.notes")}</span>
        </button>
        <button className={"bookmark" + (view === "todos" ? " active" : "")} onClick={() => setView("todos")} title={t("nav.todos")}>
          <span className="bm-text">{t("nav.todos")}</span>
        </button>
        <button
          className="bookmark"
          onClick={() => ipc.openCalendarWindow().catch((e) => pushToast(t("dash.openCalFail") + String(e)))}
          title={t("nav.calendar")}
        >
          <span className="bm-text">{t("nav.calendar")}</span>
        </button>
        <button className={"bookmark" + (view === "reminders" ? " active" : "")} onClick={() => setView("reminders")} title={t("nav.reminders")}>
          <span className="bm-text">{t("nav.reminders")}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={
              "bookmark" +
              (view === "cat:" + c.id ? " active" : "") +
              (removingCatId === c.id ? " removing" : "")
            }
            onClick={() => setView("cat:" + c.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              void deleteBookmark(c.id, c.name);
            }}
            title={t("dash.bookmarkCtx", { name: c.name })}
          >
            <span className="bm-text" style={{ color: c.color }}>
              {c.name}
            </span>
          </button>
        ))}
        {adding ? (
          <input
            className="bookmark-input"
            autoFocus
            value={newName}
            placeholder={t("dash.bookmarkPlaceholder")}
            maxLength={7}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createBookmark();
              else if (e.key === "Escape") {
                setAdding(false);
                setNewName("");
              }
            }}
            onBlur={() => {
              if (newName.trim()) void createBookmark();
              else setAdding(false);
            }}
          />
        ) : (
          <button
            className="bookmark bm-add"
            onClick={() => {
              setAdding(true);
              setNewName("");
            }}
            title={t("dash.newBookmarkTip")}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="dashboard-content">
        <div className="titlebar" onMouseDown={startDrag}>
          <StickyNote size={16} />
          <span
            className="title"
            onClick={onBrandClick}
            onMouseDown={(e) => e.stopPropagation()}
            title={t("signature.tip")}
            style={{ cursor: "pointer" }}
          >
            {t("app.brand")}
          </span>
          <div className="titlebar-spacer" />
          <button
            className="icon-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setSettingsOpen(true)}
            title={t("settings.title")}
          >
            <SettingsIcon size={14} />
          </button>
          <button
            className="icon-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => win.minimize()}
            title={t("action.minimize")}
          >
            <Minus size={14} />
          </button>
          <button
            className="icon-btn close"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => void handleClose()}
            title={t("action.close")}
          >
            <X size={14} />
          </button>
        </div>

        <div className="action-row">
          <button className="btn-primary" onClick={newNote}>
            <Plus size={14} /> {t("action.newNote")}
          </button>
          <button className="btn-ghost" onClick={() => openReminder()}>
            <Bell size={14} /> {t("action.newReminder")}
          </button>
        </div>

        <div className="tab-content">
          {(view === "notes" || view.startsWith("cat:")) && (
            <>
              <div className="notes-grid">
                {notesLoading && visibleNotes.length === 0 &&
                  Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
                {visibleNotes.map((n, idx) => (
                  <NoteCard
                    key={n.id}
                    n={n}
                    onOpen={() => ipc.openNoteWindow(n.id)}
                    onDelete={() => void removeNote(n.id)}
                    reorderOffset={noteGetOffset(idx)}
                    onReorderStart={(y) => noteOnStart(idx, y)}
                    onReorderMove={noteOnMove}
                    onReorderEnd={noteOnEnd}
                  />
                ))}
                {!notesLoading && visibleNotes.length === 0 && (
                  <div className="empty">
                    <StickyNote size={28} style={{ opacity: 0.4 }} />
                    <span>{view.startsWith("cat:") ? t("dash.emptyNotesCat") : t("dash.emptyNotes")}</span>
                  </div>
                )}
              </div>
              <div className="statusbar">
                <span>{t("dash.noteCount", { n: visibleNotes.length })}</span>
                <Signature variant="inline" style={{ marginLeft: "auto" }} />
              </div>
            </>
          )}

          {view === "todos" && <TodoList />}

          {view === "reminders" && <RemindersList />}
        </div>

        {/* 底部栏:时间轴 / 计算器(弹窗) */}
        <div className="bottom-bar">
          <div className="bottom-tabs">
            <button
              className={"bottom-tab" + (bottomTab === "timeline" ? " active" : "")}
              onClick={() => setBottomTab("timeline")}
              title={t("timeline.title")}
            >
              <Clock size={13} />
            </button>
            <button
              className={"bottom-tab" + (bottomTab === "calc" ? " active" : "")}
              onClick={() => ipc.openCalculatorWindow().catch(() => {})}
              title={t("calc.title")}
            >
              <CalcIcon size={13} />
            </button>
          </div>
        </div>

        {reminderOpen && (
          <ReminderEditor
            initialDate={reminderDate || dayjs().format("YYYY-MM-DD")}
            editing={editingReminder}
            onClose={() => {
              setReminderOpen(false);
              setEditingReminder(null);
            }}
            onSaved={() => loadReminders()}
          />
        )}

        {toast && <div className="toast" onClick={clearToast}>{toast}</div>}

        {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}

        {bottomTab === "timeline" && <Timeline onClose={() => setBottomTab(null)} />}

        <div className="resize-handle-s" onMouseDown={() => startResize("South")} title={t("action.dragResize")} />
      </div>
    </div>
  );
}
