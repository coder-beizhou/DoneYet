import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { ipc } from "../lib/ipc";
import { useT } from "../i18n";
import type { OpLog } from "../types";

// action → 图标/颜色/翻译 key(未知 action 回退显示原始 log.action)。
const ACTION_META: Record<string, { icon: string; color: string; labelKey: string }> = {
  created: { icon: "✚", color: "#10b981", labelKey: "timeline.action.created" },
  edited: { icon: "✎", color: "#3b82f6", labelKey: "timeline.action.edited" },
  completed: { icon: "✓", color: "#10b981", labelKey: "timeline.action.completed" },
  uncompleted: { icon: "○", color: "#f59e0b", labelKey: "timeline.action.uncompleted" },
  deleted: { icon: "✕", color: "#ef4444", labelKey: "timeline.action.deleted" },
  enabled: { icon: "🔔", color: "#8b5cf6", labelKey: "timeline.action.enabled" },
  disabled: { icon: "🔕", color: "#6b7280", labelKey: "timeline.action.disabled" },
  fired: { icon: "⚡", color: "#ec4899", labelKey: "timeline.action.fired" },
};

const KIND_ICON: Record<string, string> = {
  note: "📝",
  todo: "◯",
  reminder: "🔔",
  category: "🔖",
};

/** 时间轴弹窗:从操作日志加载,按时间倒序;不同操作有不同颜色/符号;可滚轮查看。 */
export default function Timeline({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<OpLog[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    (async () => {
      try {
        const data = await ipc.listOpLogs(100);
        setLogs(data);
      } catch (e) {
        console.error("timeline load failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="floating-panel-overlay" onClick={onClose}>
      <div className="floating-panel tl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-header">
          <span className="modal-title">{t("timeline.title")}</span>
          <button className="icon-btn" onMouseDown={(e) => e.stopPropagation()} onClick={onClose} title={t("action.close")}>
            <X size={14} />
          </button>
        </div>
        <div className="timeline-scroll">
          {loading && <div className="empty">{t("timeline.loading")}</div>}
          {!loading && logs.length === 0 && <div className="empty">{t("timeline.empty")}</div>}
          {logs.map((log) => {
            const meta = ACTION_META[log.action];
            const icon = meta?.icon ?? "•";
            const color = meta?.color ?? "#6b7280";
            const label = meta ? t(meta.labelKey) : log.action;
            const kindIcon = KIND_ICON[log.item_kind] ?? "•";
            const title = log.item_title || log.item_kind;
            return (
              <div key={log.id} className="tl-log-item">
                <span className="tl-log-action-icon" style={{ color }}>{icon}</span>
                <div className="tl-log-body">
                  <div className="tl-log-title">
                    <span className="tl-log-kind">{kindIcon}</span>
                    <span className="tl-log-text" style={{ color }}>{label}</span>
                    <span className="tl-log-name">{title}</span>
                  </div>
                  <div className="tl-log-time">{dayjs(log.created_at).format("MM-DD HH:mm:ss")}</div>
                  {log.detail && <div className="tl-detail">{log.detail}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
