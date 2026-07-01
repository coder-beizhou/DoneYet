import { create } from "zustand";
import type { Category, CategoryCreate } from "../types";
import { ipc } from "../lib/ipc";

interface CategoriesState {
  categories: Category[];
  loading: boolean;
  load: () => Promise<void>;
  create: (input: CategoryCreate) => Promise<Category>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: [],
  loading: false,
  load: async () => {
    set({ loading: true });
    try {
      set({ categories: await ipc.listCategories() });
    } finally {
      set({ loading: false });
    }
  },
  create: async (input) => {
    const c = await ipc.createCategory(input);
    set({ categories: [...get().categories, c] });
    return c;
  },
  rename: async (id, name) => {
    await ipc.renameCategory(id, name);
    set({
      categories: get().categories.map((c) => (c.id === id ? { ...c, name } : c)),
    });
  },
  remove: async (id) => {
    await ipc.deleteCategory(id);
    set({ categories: get().categories.filter((c) => c.id !== id) });
  },
}));
