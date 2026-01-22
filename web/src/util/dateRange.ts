export type RangeKey =
  | "allTime"
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "thisYear"
  | "lastYear";

export const rangeLabels: Record<RangeKey, string> = {
  allTime: "记录以来",
  today: "今天",
  yesterday: "昨天",
  thisWeek: "本周",
  lastWeek: "上周",
  thisMonth: "本月",
  lastMonth: "上月",
  thisQuarter: "本季度",
  lastQuarter: "上季度",
  thisYear: "今年",
  lastYear: "去年"
};

export const rangeKeys: RangeKey[] = [
  "allTime",
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisQuarter",
  "lastQuarter",
  "thisYear",
  "lastYear"
];

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// 返回 [startMs, endMs] 毫秒时间戳，endMs 是范围最后一天的 23:59:59.999
export function getRange(key: RangeKey): [number, number] {
  const now = new Date();
  const today = startOfDay(now);

  switch (key) {
    case "allTime": {
      const start = new Date(2026, 0, 1, 0, 0, 0, 0);
      return [start.getTime(), Date.now()];
    }

    case "today":
      return [today.getTime(), addDays(today, 1).getTime() - 1];

    case "yesterday": {
      const start = addDays(today, -1);
      return [start.getTime(), today.getTime() - 1];
    }

    case "thisWeek": {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1; // 周一为起点
      const start = addDays(today, -diff);
      return [start.getTime(), addDays(start, 7).getTime() - 1];
    }

    case "lastWeek": {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const thisWeekStart = addDays(today, -diff);
      const start = addDays(thisWeekStart, -7);
      return [start.getTime(), thisWeekStart.getTime() - 1];
    }

    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return [start.getTime(), end.getTime() - 1];
    }

    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 1);
      return [start.getTime(), end.getTime() - 1];
    }

    case "thisQuarter": {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      const end = new Date(today.getFullYear(), q * 3 + 3, 1);
      return [start.getTime(), end.getTime() - 1];
    }

    case "lastQuarter": {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3 - 3, 1);
      const end = new Date(today.getFullYear(), q * 3, 1);
      return [start.getTime(), end.getTime() - 1];
    }

    case "thisYear": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear() + 1, 0, 1);
      return [start.getTime(), end.getTime() - 1];
    }

    case "lastYear": {
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear(), 0, 1);
      return [start.getTime(), end.getTime() - 1];
    }
  }
}
