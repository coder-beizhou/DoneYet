import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Trash2, X } from "lucide-react";
import { useT } from "../i18n";

type SwipeState = "idle" | "dragging" | "revealed" | "removing" | "reordering";

/**
 * 滑动删除 + 长按排序(v5 彻底重写):
 * - mousedown → 启动 300ms 计时器 + checkMove(横移>5px→dragging)
 * - 300ms 到 + 横移<5px → 移除 checkMove → reordering(竖拖排序,只跟 Y)
 * - reordering 时 onReorderMove(clientY) → 父算 offset → 其他卡让位
 * - 松手 → onReorderEnd → idle; wasReordering 拦截后续 click
 */
export default function SwipeToDelete({
  children,
  onDelete,
  onReorderStart,
  onReorderMove,
  onReorderEnd,
  reorderOffset,
}: {
  children: ReactNode;
  onDelete: () => void;
  onReorderStart?: (clientY: number) => void;
  onReorderMove?: (clientY: number) => void;
  onReorderEnd?: () => void;
  reorderOffset?: number;
}) {
  const [state, setState] = useState<SwipeState>("idle");
  const [dragX, setDragX] = useState(0);
  const [reorderY, setReorderY] = useState(0);
  const startRef = useRef(0);
  const startYRef = useRef(0);
  const movedRef = useRef(false);
  const dragXRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const wasReorderingRef = useRef(false); // 排序结束后拦截 click
  const t = useT();

  // 用 ref 持有最新回调,避免 useEffect 闭包捕获旧值(onEnd 拿不到更新后的 targetIndex)
  const onReorderMoveRef = useRef(onReorderMove);
  const onReorderEndRef = useRef(onReorderEnd);
  onReorderMoveRef.current = onReorderMove;
  onReorderEndRef.current = onReorderEnd;

  dragXRef.current = dragX;

  const dragging = state === "dragging";
  const revealed = state === "revealed";
  const removing = state === "removing";
  const reordering = state === "reordering";
  const bgVisible = dragX < -5 || revealed || removing;

  // --- 横滑删除:window 级 mousemove/mouseup ---
  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const dx = e.clientX - startRef.current;
      if (Math.abs(dx) > 5) movedRef.current = true;
      setDragX(Math.min(0, Math.max(-150, dx)));
    }
    function onUp() {
      if (dragXRef.current < -40) { setState("revealed"); setDragX(-56); }
      else { setState("idle"); setDragX(0); }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  // --- 竖拖排序:window 级 mousemove/mouseup(只跟 Y) ---
  useEffect(() => {
    if (!reordering) return;
    function onMove(e: MouseEvent) {
      const dy = e.clientY - startYRef.current;
      setReorderY(dy);
      onReorderMoveRef.current?.(e.clientY);
    }
    function onUp() {
      onReorderEndRef.current?.();
      setReorderY(0);
      wasReorderingRef.current = true;
      setState("idle");
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reordering]);

  // --- 展开时点外部=收回 ---
  useEffect(() => {
    if (!revealed) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        cancelDelete();
      }
    }
    const timer = setTimeout(() => document.addEventListener("click", onDocClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", onDocClick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  // --- mousedown:启动 hold timer + checkMove ---
  function onMouseDown(e: React.MouseEvent) {
    if (state !== "idle") return;
    startRef.current = e.clientX;
    startYRef.current = e.clientY;
    movedRef.current = false;
    wasReorderingRef.current = false;

    // checkMove:横移>5px → 取消 timer → 进 dragging
    function checkMove(ev: MouseEvent) {
      const dx = Math.abs(ev.clientX - startRef.current);
      if (dx > 5) {
        movedRef.current = true;
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        window.removeEventListener("mousemove", checkMove);
        window.removeEventListener("mouseup", onEarlyUp);
        setState("dragging");
      }
    }
    // 提前松手(未到 300ms)→ 清理
    function onEarlyUp() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      window.removeEventListener("mousemove", checkMove);
      window.removeEventListener("mouseup", onEarlyUp);
    }

    var holdTimer: ReturnType<typeof setTimeout> | null = setTimeout(function() {
      if (!movedRef.current) {
        // 进入排序:移除 checkMove/onEarlyUp(不再响应横移)
        window.removeEventListener("mousemove", checkMove);
        window.removeEventListener("mouseup", onEarlyUp);
        setState("reordering");
        if (onReorderStart) onReorderStart(startYRef.current);
      }
    }, 300);

    window.addEventListener("mousemove", checkMove);
    window.addEventListener("mouseup", onEarlyUp);
  }

  // --- click 拦截:拖动后/排序后不触发卡片自身点击 ---
  function onClickCapture(e: React.MouseEvent) {
    if (movedRef.current || wasReorderingRef.current) {
      e.stopPropagation();
      e.preventDefault();
      movedRef.current = false;
      wasReorderingRef.current = false;
    } else if (revealed) {
      e.stopPropagation();
      e.preventDefault();
      setState("idle");
      setDragX(0);
    }
  }

  function confirmDelete() {
    setState("removing");
    setTimeout(() => onDelete(), 280);
  }
  function cancelDelete() { setState("idle"); setDragX(0); }
  function autoReveal() { setState("revealed"); setDragX(-56); }

  const showConfirm = revealed && !removing;

  // 被拖卡跟鼠标;其他卡用 reorderOffset 让位
  const wrapStyle = reordering
    ? { transform: `translateY(${reorderY}px)`, zIndex: 100, opacity: 0.85, transition: "none" as const }
    : reorderOffset !== undefined && reorderOffset !== 0
      ? { transform: `translateY(${reorderOffset}px)`, transition: "transform 0.2s ease" as const }
      : undefined;

  return (
    <div className="swipe-wrap" ref={wrapRef} style={wrapStyle}>
      <div className="swipe-delete-bg" style={{ opacity: bgVisible ? 1 : 0 }}>
        {showConfirm ? (
          <>
            <button className="swipe-btn" onClick={cancelDelete} title={t("swipe.cancel")}><X size={16} /></button>
            <button className="swipe-btn swipe-btn-confirm" onClick={confirmDelete} title={t("swipe.confirm")}><Check size={16} /></button>
          </>
        ) : (
          <Trash2 size={16} className="swipe-trash-icon" />
        )}
      </div>
      {!showConfirm && !removing && !reordering && (
        <button className="swipe-trigger-btn" onClick={autoReveal} title={t("swipe.delete")}><Trash2 size={16} /></button>
      )}
      <div
        className={"swipe-content" + (removing ? " removing" : "") + (reordering ? " reordering" : "")}
        style={
          removing ? undefined :
          reordering ? { transition: "none" } :
          dragging ? { transform: `translateX(${dragX}px)`, transition: "none" } :
          revealed ? { transform: "translateX(-56px)" } :
          undefined
        }
        onMouseDown={onMouseDown}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
