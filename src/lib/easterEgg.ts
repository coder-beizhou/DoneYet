import { useUiStore } from "../stores/uiStore";
import { applySettingsCss, useSettingsStore } from "../stores/settingsStore";
import { t } from "../i18n";

const RAINBOW = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

/**
 * 彩蛋触发:彩纸喷射 + 彩蛋 toast + 彩虹强调色闪烁约 2.5s,结束后恢复主题。
 * 由 Signature 连点 5 次或 Konami 码调用。
 */
export function triggerEasterEgg() {
  useUiStore.getState().push(t("egg.message"));
  confetti();
  const root = document.documentElement;
  let i = 0;
  const iv = window.setInterval(() => {
    root.style.setProperty("--accent", RAINBOW[i % RAINBOW.length]);
    i++;
    if (i > 14) {
      window.clearInterval(iv);
      // 恢复:按当前设置重应用 --accent/--bg(覆盖闪烁期间的临时值)
      applySettingsCss(useSettingsStore.getState());
    }
  }, 180);
}

/** 60 片彩纸,随机色/位置/旋转,~3s 后清理。纯 DOM,无依赖。 */
function confetti() {
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#fbbf24", "#34d399"];
  const root = document.createElement("div");
  root.className = "confetti-root";
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.3 + "s";
    p.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
    p.style.width = 6 + Math.random() * 6 + "px";
    p.style.height = 8 + Math.random() * 8 + "px";
    root.appendChild(p);
  }
  document.body.appendChild(root);
  window.setTimeout(() => root.remove(), 3200);
}
