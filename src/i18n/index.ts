import { useLangStore } from "./langStore";
import { dict } from "./dict";

export type { Lang } from "./langStore";
export { useApplyLang, currentLang, useLangStore } from "./langStore";

/**
 * 翻译:按 key 取当前语言文案,{var} 占位替换为 vars。
 * 读 useLangStore 当前 lang(非响应式)——可在任意处调用(组件内、事件回调、纯函数)。
 * 组件渲染需配合 useT() 才能在 lang 变更时重渲染。
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const lang = useLangStore.getState().lang;
  const entry = dict[key];
  let s: string = entry ? entry[lang] : key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split(`{${k}}`).join(String(vars[k]));
    }
  }
  return s;
}

/**
 * 组件内用:订阅 lang 变更触发本组件重渲染,返回稳定的 t(读最新 lang)。
 * 用法:const t = useT(); … t("note.title")
 */
export function useT(): typeof t {
  useLangStore((s) => s.lang); // 订阅 → lang 变更时重渲染
  return t;
}
