import { create } from "zustand";
import { emit } from "@tauri-apps/api/event";
import type { Reminder, ReminderCreate, ReminderUpdate } from "../types";
import { ipc } from "../lib/ipc";

interface RemindersState {
  reminders: Reminder[];
  loading: boolean;
  load: () => Promise<void>;
  create: (input: ReminderCreate) => Promise<Reminder>;
  update: (input: ReminderUpdate) => Promise<Reminder>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (newReminders: Reminder[]) => void;
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      set({ reminders: await ipc.listReminders() });
    } finally {
      set({ loading: false });
    }
  },
  create: async (input) => {
    const r = await ipc.createReminder(input);
    set({ reminders: [...get().reminders, r] });
    emit("data:changed", null);
    return r;
  },
  update: async (input) => {
    const r = await ipc.updateReminder(input);
    set({
      reminders: get().reminders.map((x) => (x.id === r.id ? r : x)),
    });
    emit("data:changed", null);
    return r;
  },
  setEnabled: async (id, enabled) => {
    await ipc.setReminderEnabled(id, enabled);
    set({
      reminders: get().reminders.map((r) =>
        r.id === id ? { ...r, enabled } : r,
      ),
    });
    emit("data:changed", null);
  },
  remove: async (id) => {
    await ipc.deleteReminder(id);
    set({ reminders: get().reminders.filter((r) => r.id !== id) });
    emit("data:changed", null);
  },
  reorder: (newReminders: Reminder[]) => {
    set({ reminders: newReminders });
  },
}));
