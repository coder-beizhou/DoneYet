import { create } from "zustand";

type UndoAction = {
  label: string;       // "删除便签" / "创建待办" 等
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

interface UndoState {
  stack: UndoAction[];
  redoStack: UndoAction[];
  push: (action: UndoAction) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  peek: () => UndoAction | null;
}

/** 全局撤销/重做栈:每次增删改操作 push 一个 UndoAction,Ctrl+Z/Y 触发。 */
export const useUndoStore = create<UndoState>((set, get) => ({
  stack: [],
  redoStack: [],
  push: (action) => {
    set((s) => ({ stack: [...s.stack, action].slice(-50), redoStack: [] }));
  },
  undo: async () => {
    const { stack } = get();
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    try {
      await action.undo();
      set((s) => ({ stack: s.stack.slice(0, -1), redoStack: [...s.redoStack, action] }));
    } catch (e) {
      console.error("undo failed", e);
    }
  },
  redo: async () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    try {
      await action.redo();
      set((s) => ({ redoStack: s.redoStack.slice(0, -1), stack: [...s.stack, action] }));
    } catch (e) {
      console.error("redo failed", e);
    }
  },
  canUndo: () => get().stack.length > 0,
  canRedo: () => get().redoStack.length > 0,
  peek: () => get().stack[get().stack.length - 1] ?? null,
}));
