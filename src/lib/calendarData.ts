import { useLangStore } from "../i18n";

// 2026 年二十四节气(日期可能有±1天误差,以官方公告为准)
const SOLAR_TERMS: Record<string, { zh: string; en: string }> = {
  "01-05": { zh: "小寒", en: "Minor Cold" }, "01-20": { zh: "大寒", en: "Major Cold" },
  "02-04": { zh: "立春", en: "Start of Spring" }, "02-18": { zh: "雨水", en: "Rain Water" },
  "03-05": { zh: "惊蛰", en: "Awakening of Insects" }, "03-20": { zh: "春分", en: "Spring Equinox" },
  "04-05": { zh: "清明", en: "Pure Brightness" }, "04-20": { zh: "谷雨", en: "Grain Rain" },
  "05-05": { zh: "立夏", en: "Start of Summer" }, "05-21": { zh: "小满", en: "Grain Buds" },
  "06-05": { zh: "芒种", en: "Grain in Ear" }, "06-21": { zh: "夏至", en: "Summer Solstice" },
  "07-07": { zh: "小暑", en: "Minor Heat" }, "07-22": { zh: "大暑", en: "Major Heat" },
  "08-07": { zh: "立秋", en: "Start of Autumn" }, "08-23": { zh: "处暑", en: "End of Heat" },
  "09-07": { zh: "白露", en: "White Dew" }, "09-23": { zh: "秋分", en: "Autumn Equinox" },
  "10-08": { zh: "寒露", en: "Cold Dew" }, "10-23": { zh: "霜降", en: "Frost's Descent" },
  "11-07": { zh: "立冬", en: "Start of Winter" }, "11-22": { zh: "小雪", en: "Minor Snow" },
  "12-07": { zh: "大雪", en: "Major Snow" }, "12-22": { zh: "冬至", en: "Winter Solstice" },
};

// 2026 年法定节假日(农历节日为2026年对应公历日期)
const HOLIDAYS: Record<string, { zh: string; en: string }> = {
  "01-01": { zh: "元旦", en: "New Year's Day" },
  "02-17": { zh: "春节", en: "Spring Festival" },
  "04-05": { zh: "清明", en: "Qingming Festival" },
  "05-01": { zh: "劳动节", en: "Labour Day" },
  "06-19": { zh: "端午", en: "Dragon Boat Festival" },
  "09-25": { zh: "中秋", en: "Mid-Autumn Festival" },
  "10-01": { zh: "国庆", en: "National Day" },
};

export interface DayInfo {
  term?: string;
  holiday?: string;
  isHoliday: boolean;
}

/** 按 "MM-DD" 查节气/假期信息(按当前语言返回文案)。 */
export function getDayInfo(monthDay: string): DayInfo {
  const lang = useLangStore.getState().lang;
  const holiday = HOLIDAYS[monthDay]?.[lang];
  const term = SOLAR_TERMS[monthDay]?.[lang];
  return { holiday, term, isHoliday: !!holiday };
}
