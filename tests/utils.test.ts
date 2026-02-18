import { describe, it, expect } from "vitest";
import {
  formatUSD,
  parseNum,
  toLevel,
  groupByWeeks,
  calcWeekdayStats,
  calcStats,
  formatTokens,
} from "../src/lib/utils";
import type { Activity } from "../src/lib/constants";

function makeActivity(date: string, count: number, level = 0): Activity {
  return { date, count, level };
}

describe("formatUSD", () => {
  it("should format zero", () => {
    expect(formatUSD(0)).toBe("$0.00");
  });

  it("should format with 2 decimal places", () => {
    expect(formatUSD(1.5)).toBe("$1.50");
    expect(formatUSD(10.123)).toBe("$10.12");
  });

  it("should format large numbers with commas", () => {
    expect(formatUSD(1234.56)).toBe("$1,234.56");
    expect(formatUSD(1000000)).toBe("$1,000,000.00");
  });
});

describe("parseNum", () => {
  it("should return default for null/undefined/empty", () => {
    expect(parseNum(null, 10)).toBe(10);
    expect(parseNum(undefined, 5)).toBe(5);
    expect(parseNum("", 3)).toBe(3);
  });

  it("should parse valid numbers", () => {
    expect(parseNum("42", 0)).toBe(42);
    expect(parseNum("3.14", 0)).toBe(3.14);
  });

  it("should return default for NaN", () => {
    expect(parseNum("abc", 7)).toBe(7);
    expect(parseNum("not-a-number", 99)).toBe(99);
  });
});

describe("toLevel", () => {
  it("should return 0 for zero cost", () => {
    expect(toLevel(0, 100)).toBe(0);
  });

  it("should return 0 for zero maxCost", () => {
    expect(toLevel(50, 0)).toBe(0);
  });

  it("should return 0 for negative values", () => {
    expect(toLevel(-1, 100)).toBe(0);
    expect(toLevel(50, -1)).toBe(0);
  });

  it("should return correct levels based on ratio", () => {
    expect(toLevel(25, 100)).toBe(1);   // 0.25
    expect(toLevel(50, 100)).toBe(2);   // 0.50
    expect(toLevel(75, 100)).toBe(3);   // 0.75
    expect(toLevel(100, 100)).toBe(4);  // 1.00
  });

  it("should handle boundary values", () => {
    expect(toLevel(1, 100)).toBe(1);    // 0.01 <= 0.25
    expect(toLevel(26, 100)).toBe(2);   // 0.26 <= 0.50
    expect(toLevel(51, 100)).toBe(3);   // 0.51 <= 0.75
    expect(toLevel(76, 100)).toBe(4);   // 0.76 > 0.75
  });
});

describe("groupByWeeks", () => {
  it("should return empty array for empty data", () => {
    expect(groupByWeeks([])).toEqual([]);
  });

  it("should group a single week", () => {
    // 2026-01-05 is Monday, 2026-01-10 is Saturday
    const data = [
      makeActivity("2026-01-05", 1),
      makeActivity("2026-01-06", 2),
      makeActivity("2026-01-07", 3),
    ];
    const weeks = groupByWeeks(data);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toHaveLength(3);
  });

  it("should split on Sunday", () => {
    // 2026-01-10 is Saturday, 2026-01-11 is Sunday
    const data = [
      makeActivity("2026-01-10", 1),
      makeActivity("2026-01-11", 2), // Sunday -> new week
      makeActivity("2026-01-12", 3),
    ];
    const weeks = groupByWeeks(data);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toHaveLength(1);
    expect(weeks[1]).toHaveLength(2);
  });

  it("should handle data starting on Sunday", () => {
    // 2026-01-04 is Sunday
    const data = [
      makeActivity("2026-01-04", 1),
      makeActivity("2026-01-05", 2),
    ];
    const weeks = groupByWeeks(data);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toHaveLength(2);
  });
});

describe("calcWeekdayStats", () => {
  it("should return zeros for empty data", () => {
    const { weekdayAvgs, maxWeekdayAvg } = calcWeekdayStats([]);
    expect(weekdayAvgs).toHaveLength(7);
    expect(weekdayAvgs.every((v) => v === 0)).toBe(true);
    expect(maxWeekdayAvg).toBe(0);
  });

  it("should calculate averages correctly", () => {
    // 2026-01-05 is Monday (day 1)
    const data = [
      makeActivity("2026-01-05", 10),
      makeActivity("2026-01-12", 20), // Also Monday
    ];
    const { weekdayAvgs } = calcWeekdayStats(data);
    expect(weekdayAvgs[1]).toBe(15); // Monday average: (10+20)/2
  });

  it("should skip zero count entries", () => {
    const data = [
      makeActivity("2026-01-05", 0),
      makeActivity("2026-01-06", 10),
    ];
    const { weekdayAvgs } = calcWeekdayStats(data);
    expect(weekdayAvgs[1]).toBe(0); // Monday had 0
    expect(weekdayAvgs[2]).toBe(10); // Tuesday had 10
  });
});

describe("calcStats", () => {
  it("should handle empty data", () => {
    const stats = calcStats([], []);
    expect(stats.totalCost).toBe(0);
    expect(stats.dailyAvg).toBe(0);
    expect(stats.weeklyAvg).toBe(0);
    expect(stats.activeDays).toBe(0);
    expect(stats.totalDays).toBe(0);
    expect(stats.peak).toEqual({ count: 0, date: "-" });
  });

  it("should handle data with no active days", () => {
    const data = [makeActivity("2026-01-05", 0), makeActivity("2026-01-06", 0)];
    const weeks = [data];
    const stats = calcStats(data, weeks);
    expect(stats.totalCost).toBe(0);
    expect(stats.dailyAvg).toBe(0);
    expect(stats.activeDays).toBe(0);
    expect(stats.totalDays).toBe(2);
  });

  it("should calculate stats correctly", () => {
    const data = [
      makeActivity("2026-01-05", 10),
      makeActivity("2026-01-06", 0),
      makeActivity("2026-01-07", 30),
    ];
    const weeks = [data];
    const stats = calcStats(data, weeks);
    expect(stats.totalCost).toBe(40);
    expect(stats.dailyAvg).toBe(20); // 40 / 2 active days
    expect(stats.weeklyAvg).toBe(40); // 1 active week with total 40
    expect(stats.activeDays).toBe(2);
    expect(stats.totalDays).toBe(3);
    expect(stats.peak.count).toBe(30);
    expect(stats.peak.date).toBe("2026-01-07");
  });
});

describe("formatTokens", () => {
  it("should format with commas", () => {
    expect(formatTokens(1000)).toBe("1,000");
    expect(formatTokens(1234567)).toBe("1,234,567");
  });

  it("should handle zero", () => {
    expect(formatTokens(0)).toBe("0");
  });
});
