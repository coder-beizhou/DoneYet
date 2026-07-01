import { getCurrentWindow } from "@tauri-apps/api/window";

export const win = getCurrentWindow();

/** 应用 Win11 原生 Mica 毛玻璃;非 Win11/失败时静默降级为半透明。 */
export async function applyMica() {
  try {
    await win.setEffects({
      effects: ["mica"],
      state: "followsWindowActive",
      radius: 12,
    } as any);
  } catch (e) {
    console.warn("[window] setEffects mica failed:", e);
  }
}

export async function startDrag() {
  try {
    await win.startDragging();
  } catch (e) {
    console.warn(e);
  }
}

/** 系统级缩放(比 setSize/setPosition 更流畅),dir 为 ResizeDirection 字符串。 */
export async function startResize(dir: string) {
  try {
    await win.startResizeDragging(dir as any);
  } catch (e) {
    console.warn(e);
  }
}

/** hex(#RRGGBB) → rgba(r,g,b,a),用于便签半透明底色让 Mica 透出。 */
export function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) || 0;
  const g = parseInt(m.slice(2, 4), 16) || 0;
  const b = parseInt(m.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
