import {
  NOTE_COLOR_PRESETS,
  THEME_PRESETS,
  useSettingsStore,
} from "../stores/settingsStore";
import { useLangStore, useT } from "../i18n";
import type { Lang } from "../i18n";
import { ipc } from "../lib/ipc";
import Signature from "./Signature";

/** 设置面板:语言、主题风格(8 套预设)、不透明度、关闭按钮行为、便签默认颜色、字号、开机自启、固定桌面。persist 到 localStorage,跨窗口共享。 */
export default function Settings({ onClose }: { onClose: () => void }) {
  const { closeBehavior, theme, defaultNoteColor, fontSize, pinToDesktop, autostart, opacity, set } = useSettingsStore();
  const t = useT();
  const { lang, setLang } = useLangStore();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t("settings.title")}</div>
        <div className="settings-body">
          <div className="setting-row">
            <div className="setting-label">{t("settings.language")}</div>
            <div className="setting-control">
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                <option value="zh">{t("settings.langZh")}</option>
                <option value="en">{t("settings.langEn")}</option>
              </select>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">{t("settings.theme")}</div>
            <div className="theme-grid">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={"theme-chip" + (theme === p.key ? " active" : "")}
                  style={{ background: p.bg, borderColor: p.accent }}
                  onClick={() => set({ theme: p.key })}
                >
                  <span className="theme-chip-dot" style={{ background: p.accent }} />
                  {lang === "en" ? p.nameEn : p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">{t("settings.opacity")}</div>
            <div className="setting-control">
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.02}
                value={opacity}
                onChange={(e) => set({ opacity: parseFloat(e.target.value) })}
              />
              <span style={{ marginLeft: 8 }}>{Math.round(opacity * 100)}%</span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">{t("settings.closeBehavior")}</div>
            <div className="setting-control setting-radio">
              <label>
                <input
                  type="radio"
                  checked={closeBehavior === "quit"}
                  onChange={() => set({ closeBehavior: "quit" })}
                />
                {t("settings.closeQuit")}
              </label>
              <label>
                <input
                  type="radio"
                  checked={closeBehavior === "tray"}
                  onChange={() => set({ closeBehavior: "tray" })}
                />
                {t("settings.closeTray")}
              </label>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">{t("settings.defaultColor")}</div>
            <div className="setting-control color-swatches">
              {NOTE_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  style={{ background: c }}
                  data-active={defaultNoteColor === c ? "true" : undefined}
                  onClick={() => set({ defaultNoteColor: c })}
                />
              ))}
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">{t("settings.pinDesktop")}</div>
            <div className="setting-control">
              <label>
                <input
                  type="checkbox"
                  checked={pinToDesktop}
                  onChange={(e) => set({ pinToDesktop: e.target.checked })}
                />
                {t("settings.pinDesktopHint")}
              </label>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">{t("settings.autostart")}</div>
            <div className="setting-control">
              <label>
                <input
                  type="checkbox"
                  checked={autostart}
                  onChange={async (e) => {
                    const en = e.target.checked;
                    set({ autostart: en });
                    try {
                      const actual = await ipc.setAutostart(en);
                      set({ autostart: actual });
                    } catch (err) {
                      console.error("set autostart failed", err);
                    }
                  }}
                />
                {t("settings.autostartHint", { brand: t("app.brand") })}
              </label>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">{t("settings.fontSize")}</div>
            <div className="setting-control">
              <select
                value={fontSize}
                onChange={(e) => set({ fontSize: e.target.value as "sm" | "md" | "lg" })}
              >
                <option value="sm">{t("settings.fontSizeSm")}</option>
                <option value="md">{t("settings.fontSizeMd")}</option>
                <option value="lg">{t("settings.fontSizeLg")}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <Signature />
          <div className="modal-actions-spacer" />
          <button type="button" className="btn-primary" onClick={onClose}>
            {t("settings.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
