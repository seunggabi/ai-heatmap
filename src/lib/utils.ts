import type { Activity } from "./constants";

export function formatUSD(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseNum(v: string | string[] | undefined | null, def: number): number {
  if (v == null || v === "") return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

export function toLevel(cost: number, maxCost: number): number {
  if (cost <= 0 || maxCost <= 0) return 0;
  const ratio = cost / maxCost;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function groupByWeeks(data: Activity[]): Activity[][] {
  const weeks: Activity[][] = [];
  let currentWeek: Activity[] = [];
  for (const d of data) {
    const dow = new Date(d.date).getDay();
    if (dow === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(d);
  }
  if (currentWeek.length) weeks.push(currentWeek);
  return weeks;
}

export function calcWeekdayStats(data: Activity[]): {
  weekdayAvgs: number[];
  maxWeekdayAvg: number;
} {
  const weekdayTotals = Array(7).fill(0) as number[];
  const weekdayCounts = Array(7).fill(0) as number[];
  for (const d of data) {
    if (d.count > 0) {
      const dow = new Date(d.date).getDay();
      weekdayTotals[dow] += d.count;
      weekdayCounts[dow]++;
    }
  }
  const weekdayAvgs = weekdayTotals.map((t, i) =>
    weekdayCounts[i] ? t / weekdayCounts[i] : 0,
  );
  const maxWeekdayAvg = Math.max(...weekdayAvgs);
  return { weekdayAvgs, maxWeekdayAvg };
}

export function calcStats(
  data: Activity[],
  weeks: Activity[][],
): {
  totalCost: number;
  dailyAvg: number;
  weeklyAvg: number;
  peak: { count: number; date: string };
  activeDays: number;
  totalDays: number;
} {
  const totalCost = data.reduce((s, d) => s + d.count, 0);
  const activeDaysData = data.filter((d) => d.count > 0);
  const dailyAvg = activeDaysData.length ? totalCost / activeDaysData.length : 0;
  const peak = activeDaysData.reduce(
    (max, d) => (d.count > max.count ? d : max),
    { count: 0, date: "-" },
  );
  const weeklyTotals = weeks.map((w) => w.reduce((s, d) => s + d.count, 0));
  const activeWeeks = weeklyTotals.filter((t) => t > 0);
  const weeklyAvg = activeWeeks.length
    ? activeWeeks.reduce((s, t) => s + t, 0) / activeWeeks.length
    : 0;
  return {
    totalCost,
    dailyAvg,
    weeklyAvg,
    peak,
    activeDays: activeDaysData.length,
    totalDays: data.length,
  };
}

export function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}
