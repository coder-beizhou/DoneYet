import {
  NOTE_COLOR_PRESETS,
  THEME_PRESETS,
  useSettingsStore,
} from "../stores/settingsStore";
import { ipc } from "../lib/ipc";

/** 设置面板:主题风格(8 套预设)、关闭按钮行为、便签默认颜色、字号。persist 到 localStorage,跨窗口共享。 */
export default function Settings({ onClose }: { onClose: () => void }) {
  const { closeBehavior, theme, defaultNoteColor, fontSize, pinToDesktop, autostart, opacity, set } = useSettingsStore();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">设置</div>
        <div className="settings-body">
          <div className="setting-row">
            <div className="setting-label">主题风格</div>
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
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">不透明度</div>
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
            <div className="setting-label">关闭按钮 ×</div>
            <div className="setting-control setting-radio">
              <label>
                <input
                  type="radio"
                  checked={closeBehavior === "quit"}
                  onChange={() => set({ closeBehavior: "quit" })}
                />
                直接退出程序
              </label>
              <label>
                <input
                  type="radio"
                  checked={closeBehavior === "tray"}
                  onChange={() => set({ closeBehavior: "tray" })}
                />
                最小化到托盘(提醒后台仍触发)
              </label>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">便签默认颜色</div>
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
            <div className="setting-label">固定到桌面底层</div>
            <div className="setting-control">
              <label>
                <input
                  type="checkbox"
                  checked={pinToDesktop}
                  onChange={(e) => set({ pinToDesktop: e.target.checked })}
                />
                主界面与日历始终置于其他窗口之下(桌面小部件模式)
              </label>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">开机自启</div>
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
                开机时自动启动上上签
              </label>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-label">字号</div>
            <div className="setting-control">
              <select
                value={fontSize}
                onChange={(e) => set({ fontSize: e.target.value as "sm" | "md" | "lg" })}
              >
                <option value="sm">小</option>
                <option value="md">中</option>
                <option value="lg">大</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <div className="modal-actions-spacer" />
          <button type="button" className="btn-primary" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
