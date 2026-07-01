import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { ipc } from "../lib/ipc";
import type { OpLog } from "../types";

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  created: { icon: "✚", color: "#10b981", label: "创建" },
  edited: { icon: "✎", color: "#3b82f6", label: "编辑" },
  completed: { icon: "✓", color: "#10b981", label: "完成" },
  uncompleted: { icon: "○", color: "#f59e0b", label: "取消完成" },
  deleted: { icon: "✕", color: "#ef4444", label: "删除" },
  enabled: { icon: "🔔", color: "#8b5cf6", label: "启用" },
  disabled: { icon: "🔕", color: "#6b7280", label: "停用" },
  fired: { icon: "⚡", color: "#ec4899", label: "触发" },
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
          <span className="modal-title">时间轴</span>
          <button className="icon-btn" onMouseDown={(e) => e.stopPropagation()} onClick={onClose} title="关闭">
            <X size={14} />
          </button>
        </div>
        <div className="timeline-scroll">
          {loading && <div className="empty">加载中…</div>}
          {!loading && logs.length === 0 && <div className="empty">暂无操作记录</div>}
          {logs.map((log) => {
            const meta = ACTION_META[log.action] ?? { icon: "•", color: "#6b7280", label: log.action };
            const kindIcon = KIND_ICON[log.item_kind] ?? "•";
            const title = log.item_title || log.item_kind;
            return (
              <div key={log.id} className="tl-log-item">
                <span className="tl-log-action-icon" style={{ color: meta.color }}>{meta.icon}</span>
                <div className="tl-log-body">
                  <div className="tl-log-title">
                    <span className="tl-log-kind">{kindIcon}</span>
                    <span className="tl-log-text" style={{ color: meta.color }}>{meta.label}</span>
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
