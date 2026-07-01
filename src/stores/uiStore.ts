import { create } from "zustand";

// 全局 UI 状态:toast 供任意组件推送(主要给 IPC 失败/提醒事件用)。
interface UiState {
  toast: string | null;
  push: (msg: string) => void;
  clear: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  push: (msg) => set({ toast: msg }),
  clear: () => set({ toast: null }),
}));
