import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ipc } from "../lib/ipc";

export type Lang = "zh" | "en";

/**
 * 语言 store:持久化到 localStorage("ssq-lang"),跨窗口经 storage 事件同步。
 * setLang 只改本地态;推送到 Rust(重建托盘/标题)由 useApplyLang 在各窗口挂载/变更时统一处理。
 */
export const useLangStore = create<{ lang: Lang; setLang: (l: Lang) => void }>()(
  persist(
    (set) => ({
      lang: "zh",
      setLang: (lang) => set({ lang }),
    }),
    { name: "ssq-lang" },
  ),
);

/** 当前语言(非响应式,适合在事件回调/纯函数里读)。 */
export function currentLang(): Lang {
  return useLangStore.getState().lang;
}

/**
 * 各窗口调用:挂载 / lang 变更时把语言同步到后端(重建托盘菜单 + 各窗口标题 + 提醒通知标题)
 * 并设 document.documentElement.lang;监听 storage 事件做跨窗口实时同步。
 */
export function useApplyLang() {
  const lang = useLangStore((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    ipc.setLanguage(lang).catch((e) => console.error("setLanguage failed", e));
  }, [lang]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ssq-lang") {
        useLangStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
