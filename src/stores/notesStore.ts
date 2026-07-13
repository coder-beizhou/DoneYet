import { create } from "zustand";
import { emit } from "@tauri-apps/api/event";
import type { Note } from "../types";
import { ipc } from "../lib/ipc";
import { useSettingsStore } from "./settingsStore";

interface NotesState {
  notes: Note[];
  loading: boolean;
  load: () => Promise<void>;
  create: (categoryId?: string | null) => Promise<Note>;
  remove: (id: string) => Promise<void>;
  reorder: (newNotes: Note[]) => void;
}

// load 序号:并发 load() 时丢弃旧响应,防后到先到覆盖成旧数据。
let loadSeq = 0;
export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  loading: false,
  load: async () => {
    const seq = ++loadSeq;
    set({ loading: true });
    try {
      const notes = await ipc.listNotes();
      if (seq !== loadSeq) return; // 被更新的 load 盖过,丢弃旧响应
      set({ notes });
    } finally {
      if (seq === loadSeq) set({ loading: false });
    }
  },
  create: async (categoryId?: string | null) => {
    const color = useSettingsStore.getState().defaultNoteColor;
    const note = await ipc.createNote("", color, categoryId ?? null);
    set({ notes: [note, ...get().notes] });
    emit("data:changed", null);
    return note;
  },
  remove: async (id) => {
    await ipc.deleteNote(id);
    set({ notes: get().notes.filter((n) => n.id !== id) });
    emit("data:changed", null);
  },
  reorder: (newNotes: Note[]) => {
    set({ notes: newNotes });
  },
}));
