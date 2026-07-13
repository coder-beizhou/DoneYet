import dayjs from "dayjs";
import type { Lang } from "./langStore";

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const EN_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** M月D日(zh) / Jul 13(en)。用于"在 {date} 新建"等日期插值。 */
export function fmtMD(date: string | dayjs.Dayjs, lang: Lang): string {
  const d = dayjs(date);
  if (lang === "en") return `${EN_MONTHS_SHORT[d.month()]} ${d.date()}`;
  return `${d.month() + 1}月${d.date()}日`;
}

/** YYYY 年 M 月(zh) / July 2026(en)。日历月标题。month0 为 0-based。 */
export function fmtMonthTitle(year: number, month0: number, lang: Lang): string {
  if (lang === "en") return `${EN_MONTHS[month0]} ${year}`;
  return `${year} 年 ${month0 + 1} 月`;
}

/** 周几短标签:一/二/…/日(zh) / Mon…Sun(en)。日历表头。 */
export function weekdays(lang: Lang): string[] {
  return lang === "en" ? EN_WEEKDAYS : ["一", "二", "三", "四", "五", "六", "日"];
}
