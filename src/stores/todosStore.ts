import { create } from "zustand";
import { emit } from "@tauri-apps/api/event";
import type { Todo, TodoCreate, TodoUpdate } from "../types";
import { ipc } from "../lib/ipc";

interface TodosState {
  todos: Todo[];
  loading: boolean;
  load: () => Promise<void>;
  create: (input: TodoCreate) => Promise<Todo>;
  update: (input: TodoUpdate) => Promise<Todo>;
  toggle: (id: string, done: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (newTodos: Todo[]) => Promise<void>;
}

let loadSeq = 0;
export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  loading: false,
  load: async () => {
    const seq = ++loadSeq;
    set({ loading: true });
    try {
      const todos = await ipc.listTodos();
      if (seq !== loadSeq) return;
      set({ todos });
    } finally {
      if (seq === loadSeq) set({ loading: false });
    }
  },
  create: async (input) => {
    const todo = await ipc.createTodo(input);
    set({ todos: [todo, ...get().todos] });
    emit("data:changed", null);
    return todo;
  },
  update: async (input) => {
    const t = await ipc.updateTodo(input);
    set({ todos: get().todos.map((x) => (x.id === t.id ? t : x)) });
    emit("data:changed", null);
    return t;
  },
  toggle: async (id, done) => {
    const updated = await ipc.toggleTodo(id, done);
    set({ todos: get().todos.map((t) => (t.id === id ? updated : t)) });
    emit("data:changed", null);
  },
  remove: async (id) => {
    await ipc.deleteTodo(id);
    set({ todos: get().todos.filter((t) => t.id !== id) });
    emit("data:changed", null);
  },
  reorder: async (newTodos: Todo[]) => {
    // 乐观更新(立即反映新顺序)+ 批量持久化(单次 IPC,替代旧 N+1 顺序 updateTodo)。
    set({ todos: newTodos.map((t, i) => ({ ...t, sort_order: i })) });
    try {
      await ipc.reorderTodos(newTodos.map((t) => t.id));
    } catch (e) {
      console.error("reorder todos failed", e);
    }
  },
}));
