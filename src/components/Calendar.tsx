import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { getDayInfo } from "../lib/calendarData";
import { ipc } from "../lib/ipc";
import { t, useLangStore } from "../i18n";
import { fmtMonthTitle, weekdays } from "../i18n/format";
import type { AgendaItem } from "../types";

/** 月历:点格子=选中(展开全部事项可滚);选中态再点=触发新建(onCreateAt)。 */
export default function Calendar({
  refreshSignal,
  onCreateAt,
  onItemClick,
}: {
  refreshSignal: number;
  onCreateAt: (dateStr: string) => void;
  onItemClick: (item: AgendaItem) => void;
}) {
  const lang = useLangStore((s) => s.lang);
  const [cursor, setCursor] = useState(() => dayjs());
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { from, to, cells } = useMemo(() => {
    const first = cursor.date(1);
    const offset = (first.day() + 6) % 7;
    const start = first.subtract(offset, "day");
    const end = start.add(41, "day");
    const cells: dayjs.Dayjs[] = [];
    for (let i = 0; i < 42; i++) cells.push(start.add(i, "day"));
    return {
      from: start.format("YYYY-MM-DD") + "T00:00:00",
      to: end.format("YYYY-MM-DD") + "T23:59:59",
      cells,
    };
  }, [cursor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await ipc.agenda(from, to);
        if (!cancelled) setItems(data);
      } catch (e) {
        console.error("agenda", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, refreshSignal]);

  const byDay = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const it of items) {
      const key = (it.at || "").slice(0, 10);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(it);
      m.set(key, arr);
    }
    return m;
  }, [items]);

  const today = dayjs();
  const currentMonth = cursor.month();

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="cal-nav" onClick={() => setCursor(cursor.subtract(1, "month"))} title={t("action.prevMonth")}>‹</button>
        <span className="cal-title">{fmtMonthTitle(cursor.year(), cursor.month(), lang)}</span>
        <button className="cal-nav" onClick={() => setCursor(cursor.add(1, "month"))} title={t("action.nextMonth")}>›</button>
        <button className="cal-today" onClick={() => setCursor(dayjs())}>{t("action.today")}</button>
      </div>
      <div className="cal-week">
        {weekdays(lang).map((w, i) => (
          <div key={w + i} className={"cal-wk" + (i >= 5 ? " weekend" : "")}>{w}</div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((d) => {
          const key = d.format("YYYY-MM-DD");
          const dayItems = byDay.get(key) ?? [];
          const inMonth = d.month() === currentMonth;
          const isToday = d.isSame(today, "day");
          const dayInfo = getDayInfo(d.format("MM-DD"));
          const isSelected = selectedDay === key;
          const shown = isSelected ? dayItems : dayItems.slice(0, 3);
          return (
            <div
              key={key}
              className={
                "cal-cell" +
                (inMonth ? "" : " out") +
                (isToday ? " today" : "") +
                (d.day() === 0 || d.day() === 6 ? " weekend" : "") +
                (dayInfo.isHoliday ? " holiday" : "") +
                (isSelected ? " selected" : "")
              }
              onClick={() => {
                if (isSelected) onCreateAt(key);
                else setSelectedDay(key);
              }}
              title={isSelected ? t("cal.cellTipSelected") : t("cal.cellTip")}
            >
              <div className="cal-day">{d.date()}</div>
              {dayInfo.holiday ? (
                <div className="cal-holiday">{dayInfo.holiday}</div>
              ) : dayInfo.term ? (
                <div className="cal-term">{dayInfo.term}</div>
              ) : null}
              <div className={"cal-items" + (isSelected ? " expanded" : "")}>
                {shown.map((it) => {
                  const icon = it.kind === "todo" ? "◯" : it.kind === "note" ? "📝" : "🔔";
                  return (
                    <div
                      key={it.id}
                      className={"cal-item " + it.kind + (it.done ? " done" : "")}
                      title={it.title + " " + (it.kind === "todo" ? t("cal.itemTodo") : it.kind === "note" ? t("cal.itemNote") : t("cal.itemReminder"))}
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemClick(it);
                      }}
                    >
                      <span className="cal-item-icon">{icon}</span>
                      <span className="cal-item-text">{it.title}</span>
                    </div>
                  );
                })}
                {!isSelected && dayItems.length > 3 && (
                  <div className="cal-more" onClick={(e) => e.stopPropagation()} title={dayItems.length === 1 ? t("cal.dayCountOne") : t("cal.dayCount", { n: dayItems.length })}>
                    +{dayItems.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
