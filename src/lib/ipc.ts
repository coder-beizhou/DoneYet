import { invoke } from "@tauri-apps/api/core";
import type {
  AgendaItem,
  Category,
  CategoryCreate,
  Note,
  NoteUpdate,
  OpLog,
  Reminder,
  ReminderCreate,
  ReminderUpdate,
  Todo,
  TodoCreate,
  TodoUpdate,
} from "../types";

// 前端 IPC 封装:命令名与 Rust #[tauri::command] 对应,参数 camelCase 自动转 snake_case。
export const ipc = {
  // 便签
  createNote: (title?: string, color?: string, categoryId?: string | null) =>
    invoke<Note>("create_note", { title, color, categoryId }),
  getNote: (id: string) => invoke<Note | null>("get_note", { id }),
  listNotes: () => invoke<Note[]>("list_notes"),
  updateNote: (update: NoteUpdate) => invoke<Note>("update_note", { update }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),
  undeleteNote: (id: string) => invoke<void>("undelete_note", { id }),
  reorderNotes: (ids: string[]) => invoke<void>("reorder_notes", { ids }),
  openNoteWindow: (id: string) => invoke<void>("open_note_window", { id }),
  closeNoteWindow: (id: string) => invoke<void>("close_note_window", { id }),
  focusNote: (id: string) => invoke<void>("focus_note", { id }),
  openCalendarWindow: () => invoke<void>("open_calendar_window"),
  openCalculatorWindow: () => invoke<void>("open_calculator_window"),
  quitApp: () => invoke<void>("quit_app"),
  setAutostart: (enabled: boolean) => invoke<boolean>("set_autostart", { enabled }),
  setLanguage: (lang: string) => invoke<void>("set_language", { lang }),

  // 待办
  listTodos: () => invoke<Todo[]>("list_todos"),
  listTodosByNote: (noteId: string) => invoke<Todo[]>("list_todos_by_note", { noteId }),
  createTodo: (todo: TodoCreate) => invoke<Todo>("create_todo", { todo }),
  updateTodo: (todo: TodoUpdate) => invoke<Todo>("update_todo", { todo }),
  toggleTodo: (id: string, done: boolean) => invoke<Todo>("toggle_todo", { id, done }),
  deleteTodo: (id: string) => invoke<void>("delete_todo", { id }),
  reorderTodos: (ids: string[]) => invoke<void>("reorder_todos", { ids }),

  // 提醒
  listReminders: () => invoke<Reminder[]>("list_reminders"),
  createReminder: (reminder: ReminderCreate) =>
    invoke<Reminder>("create_reminder", { reminder }),
  updateReminder: (reminder: ReminderUpdate) =>
    invoke<Reminder>("update_reminder", { reminder }),
  setReminderEnabled: (id: string, enabled: boolean) =>
    invoke<void>("set_reminder_enabled", { id, enabled }),
  deleteReminder: (id: string) => invoke<void>("delete_reminder", { id }),

  // 日历
  agenda: (from: string, to: string) => invoke<AgendaItem[]>("agenda", { from, to }),

  // 分类(书签)
  listCategories: () => invoke<Category[]>("list_categories"),
  createCategory: (category: CategoryCreate) => invoke<Category>("create_category", { category }),
  renameCategory: (id: string, name: string) => invoke<void>("rename_category", { id, name }),
  deleteCategory: (id: string) => invoke<void>("delete_category", { id }),

  // 操作日志(时间轴)
  listOpLogs: (limit?: number) => invoke<OpLog[]>("list_op_logs", { limit }),
};
