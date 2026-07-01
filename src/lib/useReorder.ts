import { useRef, useState, useCallback } from "react";

/**
 * 拖拽排序 hook(简化可靠版):
 * onReorderStart(index, clientY) → 记录起点
 * onReorderMove(clientY) → 算 deltaY → round(deltaY/itemH) → target index
 * getOffset(i) → 被挤开的卡片 translateY
 */
export function useReorder<T extends { id: string }>(
  items: T[],
  onReorder: (newItems: T[]) => void,
  itemHeight: number = 48,
) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const startY = useRef(0);

  const onStart = useCallback((index: number, clientY: number) => {
    setDragIndex(index);
    setTargetIndex(index);
    startY.current = clientY;
  }, []);

  const onMove = useCallback((clientY: number) => {
    if (dragIndex === null) return;
    const deltaY = clientY - startY.current;
    const steps = Math.round(deltaY / itemHeight);
    let target = dragIndex + steps;
    target = Math.max(0, Math.min(items.length - 1, target));
    setTargetIndex(target);
  }, [dragIndex, items.length, itemHeight]);

  const onEnd = useCallback(() => {
    if (dragIndex !== null && targetIndex !== null && dragIndex !== targetIndex) {
      const newItems = [...items];
      const [moved] = newItems.splice(dragIndex, 1);
      newItems.splice(targetIndex, 0, moved);
      onReorder(newItems);
    }
    setDragIndex(null);
    setTargetIndex(null);
  }, [dragIndex, targetIndex, items, onReorder]);

  const getOffset = useCallback((index: number): number => {
    if (dragIndex === null || targetIndex === null) return 0;
    if (index === dragIndex) return 0; // 拖动项自身不偏移(SwipeToDelete 内部处理)
    const dir = targetIndex > dragIndex ? 1 : -1;
    if (dir > 0 && index > dragIndex && index <= targetIndex) return -itemHeight;
    if (dir < 0 && index < dragIndex && index >= targetIndex) return itemHeight;
    return 0;
  }, [dragIndex, targetIndex, itemHeight]);

  return { dragIndex, targetIndex, getOffset, onStart, onMove, onEnd };
}
