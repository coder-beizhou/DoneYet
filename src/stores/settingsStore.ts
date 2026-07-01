import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ThemePreset {
  key: string;
  name: string;
  accent: string;
  bg: string;
}

/** 主题风格预设:每套含强调色 + 主背景(rgb 三元组,叠 opacity 透明度)。 */
export const THEME_PRESETS: ThemePreset[] = [
  { key: "indigo", name: "深空", accent: "#6366f1", bg: "26,26,30" },
  { key: "blue", name: "碧海", accent: "#3b82f6", bg: "18,26,40" },
  { key: "teal", name: "青瓷", accent: "#14b8a6", bg: "18,32,32" },
  { key: "green", name: "薄荷", accent: "#10b981", bg: "20,32,26" },
  { key: "amber", name: "暖阳", accent: "#f59e0b", bg: "34,28,18" },
  { key: "pink", name: "樱粉", accent: "#ec4899", bg: "36,22,30" },
  { key: "purple", name: "葡紫", accent: "#8b5cf6", bg: "28,22,38" },
  { key: "slate", name: "岩灰", accent: "#64748b", bg: "26,28,32" },
];

export const NOTE_COLOR_PRESETS = ["#2a2a2e", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6"];

export interface Settings {
  /** 关闭按钮行为:tray=最小化到托盘(提醒后台仍触发), quit=直接退出程序。 */
  closeBehavior: "tray" | "quit";
  /** 主题风格预设 key(THEME_PRESETS)。 */
  theme: string;
  /** 新建便签默认颜色。 */
  defaultNoteColor: string;
  /** 基础字号。 */
  fontSize: "sm" | "md" | "lg";
  /** 主界面+日历固定到桌面最底层(始终在其他窗口之下,像桌面小部件)。 */
  pinToDesktop: boolean;
  /** 开机自启。 */
  autostart: boolean;
  /** 整体背景透明度(0.4-1)。 */
  opacity: number;
  set: (patch: Partial<Settings>) => void;
}

export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      closeBehavior: "quit",
      theme: "indigo",
      defaultNoteColor: "#2a2a2e",
      fontSize: "md",
      pinToDesktop: false,
      autostart: false,
      opacity: 0.82,
      set: (patch) => set(patch),
    }),
    { name: "ssq-settings" },
  ),
);

/** 把设置应用到 CSS 变量(--accent / --bg / --font-base)。 */
export function applySettingsCss(s: Settings) {
  const root = document.documentElement;
  const preset = THEME_PRESETS.find((p) => p.key === s.theme) ?? THEME_PRESETS[0];
  root.style.setProperty("--accent", preset.accent);
  root.style.setProperty("--bg", `rgba(${preset.bg}, ${s.opacity})`);
  const fs = s.fontSize === "sm" ? "12px" : s.fontSize === "lg" ? "16px" : "14px";
  root.style.setProperty("--font-base", fs);
}

// 模块加载时(首绘前)同步应用一次持久化的设置,避免主题首帧闪现默认 indigo。
applySettingsCss(useSettingsStore.getState());

/** 各窗口调用:挂载/设置变更时应用 CSS 变量;监听 storage 事件做跨窗口实时同步。 */
export function useApplySettings() {
  const settings = useSettingsStore();
  useEffect(() => {
    applySettingsCss(settings);
  }, [settings]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ssq-settings") {
        useSettingsStore.persist.rehydrate();
        applySettingsCss(useSettingsStore.getState());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
