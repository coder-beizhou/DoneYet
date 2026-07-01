// 2026 年二十四节气(日期可能有±1天误差,以官方公告为准)
const SOLAR_TERMS: Record<string, string> = {
  "01-05": "小寒", "01-20": "大寒",
  "02-04": "立春", "02-18": "雨水",
  "03-05": "惊蛰", "03-20": "春分",
  "04-05": "清明", "04-20": "谷雨",
  "05-05": "立夏", "05-21": "小满",
  "06-05": "芒种", "06-21": "夏至",
  "07-07": "小暑", "07-22": "大暑",
  "08-07": "立秋", "08-23": "处暑",
  "09-07": "白露", "09-23": "秋分",
  "10-08": "寒露", "10-23": "霜降",
  "11-07": "立冬", "11-22": "小雪",
  "12-07": "大雪", "12-22": "冬至",
};

// 2026 年法定节假日(农历节日为2026年对应公历日期)
const HOLIDAYS: Record<string, string> = {
  "01-01": "元旦",
  "02-17": "春节",
  "04-05": "清明",
  "05-01": "劳动节",
  "06-19": "端午",
  "09-25": "中秋",
  "10-01": "国庆",
};

export interface DayInfo {
  term?: string;
  holiday?: string;
  isHoliday: boolean;
}

/** 按 "MM-DD" 查节气/假期信息。 */
export function getDayInfo(monthDay: string): DayInfo {
  const holiday = HOLIDAYS[monthDay];
  const term = SOLAR_TERMS[monthDay];
  return { holiday, term, isHoliday: !!holiday };
}
