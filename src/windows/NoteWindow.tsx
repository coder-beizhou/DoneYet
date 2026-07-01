import { useCallback, useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { Pin, X } from "lucide-react";
import TipTapEditor from "../components/editor/TipTapEditor";
import { ipc } from "../lib/ipc";
import { applyMica, hexToRgba, startDrag, startResize, win } from "../lib/window";
import { useApplySettings, useSettingsStore } from "../stores/settingsStore";
import type { Note } from "../types";

const SWATCHES = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#2a2a2e"];

export default function NoteWindow() {
  const noteId = win.label.startsWith("note-") ? win.label.slice(5) : "";
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [json, setJson] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [onTop, setOnTop] = useState(false);
  const [color, setColor] = useState("#2a2a2e");
  const [showSaved, setShowSaved] = useState(false);
  const [geoVer, setGeoVer] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const [date, setDate] = useState("");

  // stateRef 持有最新 state 供稳定回调;dirtyRef 仅用户编辑置 true,避免开便签加载就触发保存+置顶跳动。
  const stateRef = useRef({ note, title, json, text, onTop, color, date });
  stateRef.current = { note, title, json, text, onTop, color, date };
  const dirtyRef = useRef(false);

  useEffect(() => {
    applyMica();
  }, []);

  // 主题/字号应用到本窗口 + 跨窗口同步。
  useApplySettings();

  // 窗口 resize/移动即时标脏,触发防抖保存几何(防崩溃/强杀丢几何)。
  useEffect(() => {
    let u1: (() => void) | null = null;
    let u2: (() => void) | null = null;
    win.onResized(() => {
      dirtyRef.current = true;
      setGeoVer((v) => v + 1);
    }).then((f) => (u1 = f));
    win.onMoved(() => {
      dirtyRef.current = true;
      setGeoVer((v) => v + 1);
    }).then((f) => (u2 = f));
    return () => {
      u1?.();
      u2?.();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const n = await ipc.getNote(noteId);
      if (n) {
        setNote(n);
        setTitle(n.title);
        setJson(n.content_json);
        setText(n.content_md);
        setOnTop(n.is_always_on_top);
        setColor(n.color);
        setDate(n.date ? n.date.slice(0, 10) : "");
        dirtyRef.current = false;
        await win.setAlwaysOnTop(n.is_always_on_top);
      }
    })();
  }, [noteId]);

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;
    const { note, title, json, text, onTop, color, date } = stateRef.current;
    if (!note) return;
    try {
      const size = await win.outerSize();
      const pos = await win.outerPosition();
      const factor = await win.scaleFactor();
      const updated = await ipc.updateNote({
        id: note.id,
        title,
        content_md: text,
        content_json: json,
        color,
        category_id: note.category_id,
        is_pinned_desktop: note.is_pinned_desktop, // 保留原值,不再硬编码 true
        is_always_on_top: onTop,
        x: pos.x / factor,
        y: pos.y / factor,
        w: size.width / factor,
        h: size.height / factor,
        date: date || null,
      });
      setNote(updated);
      dirtyRef.current = false;
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
      // 通知主界面刷新便签列表(预览/排序),避免编辑后主界面卡片预览不及时。
      emit("note:updated", updated.id);
      emit("data:changed", null);
    } catch (e) {
      console.error("save failed", e);
    }
  }, []);

  // 自动保存(800ms 防抖),仅用户编辑(dirtyRef)后触发。
  useEffect(() => {
    if (!stateRef.current.note || !dirtyRef.current) return;
    const t = setTimeout(() => void save(), 800);
    return () => clearTimeout(t);
  }, [title, json, text, onTop, color, date, geoVer, save]);

  // 关窗:空便签(无标题无正文)自动删除,避免空便签堆积;否则保存后销毁。
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    win.onCloseRequested(async (e) => {
      e.preventDefault();
      const { note, title, text } = stateRef.current;
      if (note && title.trim() === "" && text.trim() === "") {
        try {
          await ipc.deleteNote(note.id);
        } catch (err) {
          console.error("delete empty note failed", err);
        }
      } else {
        await save();
      }
      await win.destroy();
    }).then((f) => (unlisten = f));
    return () => {
      unlisten?.();
    };
  }, [save]);

  async function toggleOnTop() {
    const next = !onTop;
    setOnTop(next);
    dirtyRef.current = true;
    await win.setAlwaysOnTop(next);
  }

  function pickColor(c: string) {
    setColor(c);
    dirtyRef.current = true;
  }

  const opacity = useSettingsStore((s) => s.opacity);
  const bg = note ? hexToRgba(color, opacity) : hexToRgba(color, opacity);

  return (
    <div className="note-shell" style={{ background: bg, visibility: note ? "visible" : "hidden" }}>
      <div className="note-titlebar" onMouseDown={startDrag}>
        <button
          className="note-icon-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setCollapsed((c) => !c)}
          data-active={!collapsed}
          title="格式工具栏"
        >
          Aa
        </button>
        <div className="color-swatches" onMouseDown={(e) => e.stopPropagation()}>
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{ background: c }}
              data-active={color === c ? "true" : undefined}
              onClick={() => pickColor(c)}
              title="便签颜色"
            />
          ))}
        </div>
        <span className={"save-indicator" + (showSaved ? " show" : "")}>已保存 ✓</span>
        <div className="titlebar-spacer" />
        <button
          className="note-icon-btn"
          onClick={toggleOnTop}
          onMouseDown={(e) => e.stopPropagation()}
          data-active={onTop}
          title="置顶"
        >
          <Pin size={14} />
        </button>
        <button
          className="note-icon-btn"
          onClick={() => win.close()}
          onMouseDown={(e) => e.stopPropagation()}
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
      <div className="note-title-row">
        <input
          className="note-title-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            dirtyRef.current = true;
          }}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="标题"
          spellCheck={false}
        />
        <input
          type="date"
          className="note-date-input"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            dirtyRef.current = true;
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="日期(可选,加入日历)"
        />
      </div>
      <div className="note-body">
        {note && (
          <TipTapEditor
            collapsed={collapsed}
            initialJson={json}
            onChange={(j, t) => {
              setJson(j);
              setText(t);
              dirtyRef.current = true;
            }}
          />
        )}
      </div>
      <div className="resize-handle n" onMouseDown={() => startResize("North")} />
      <div className="resize-handle s" onMouseDown={() => startResize("South")} />
      <div className="resize-handle e" onMouseDown={() => startResize("East")} />
      <div className="resize-handle w" onMouseDown={() => startResize("West")} />
      <div className="resize-handle ne" onMouseDown={() => startResize("NorthEast")} />
      <div className="resize-handle nw" onMouseDown={() => startResize("NorthWest")} />
      <div className="resize-handle se" onMouseDown={() => startResize("SouthEast")} />
      <div className="resize-handle sw" onMouseDown={() => startResize("SouthWest")} />
    </div>
  );
}
