import { describe, it, expect } from "vitest";
import { buildHeatmapSVG } from "../src/lib/svg-builder";
import type { Activity } from "../src/lib/constants";

function makeActivity(
  date: string,
  count: number,
  level = 0,
  extras?: Partial<Activity>,
): Activity {
  return { date, count, level, ...extras };
}

function makeSampleData(): Activity[] {
  return [
    makeActivity("2026-01-05", 10, 1, {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    }),
    makeActivity("2026-01-06", 0, 0),
    makeActivity("2026-01-07", 25, 2, {
      inputTokens: 2000,
      outputTokens: 1000,
      totalTokens: 3000,
      cacheHitRate: 45,
    }),
    makeActivity("2026-01-08", 50, 4, {
      inputTokens: 5000,
      outputTokens: 2500,
      totalTokens: 7500,
      modelBreakdowns: [
        { model: "claude-3-sonnet", cost: 30 },
        { model: "claude-3-haiku", cost: 20 },
      ],
    }),
  ];
}

describe("buildHeatmapSVG", () => {
  it("should return a valid SVG string", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("<svg xmlns=");
    expect(svg).toContain("</svg>");
  });

  it("should contain rect elements for each day", () => {
    const data = makeSampleData();
    const svg = buildHeatmapSVG(data);
    const rectCount = (svg.match(/<rect x="/g) || []).length;
    // data rects + background rect + legend rects (5) + weekday bar rects
    expect(rectCount).toBeGreaterThanOrEqual(data.length);
  });

  it("should use dark theme colors", () => {
    const svg = buildHeatmapSVG(makeSampleData(), {
      colorScheme: "dark",
    });
    expect(svg).toContain("#0d1117"); // dark background
    expect(svg).toContain("#c9d1d9"); // dark text color
  });

  it("should use custom theme colors", () => {
    const svg = buildHeatmapSVG(makeSampleData(), {
      theme: "blue",
    });
    expect(svg).toContain("#73b3f3"); // blue theme color
  });

  it("should hide stats when stats=false", () => {
    const svg = buildHeatmapSVG(makeSampleData(), { stats: false });
    expect(svg).not.toContain("Daily avg:");
    expect(svg).not.toContain("Weekly avg:");
    expect(svg).not.toContain("Peak:");
  });

  it("should hide weekday chart when weekday=false", () => {
    const svg = buildHeatmapSVG(makeSampleData(), { weekday: false });
    expect(svg).not.toContain("Avg by weekday");
  });

  it("should include stats by default", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("Daily avg:");
    expect(svg).toContain("Weekly avg:");
    expect(svg).toContain("Peak:");
    expect(svg).toContain("Active:");
  });

  it("should include tooltip info for active days", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("Cost:");
    expect(svg).toContain("In:");
    expect(svg).toContain("Cache hit:");
  });

  it("should include model breakdowns in tooltip", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("claude-3-sonnet:");
    expect(svg).toContain("claude-3-haiku:");
  });

  it("should show No data for zero count days", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("No data");
  });

  it("should apply custom block size", () => {
    const svg = buildHeatmapSVG(makeSampleData(), { blockSize: 20 });
    expect(svg).toContain('width="20"');
    expect(svg).toContain('height="20"');
  });

  it("should apply custom block radius", () => {
    const svg = buildHeatmapSVG(makeSampleData(), { blockRadius: 5 });
    expect(svg).toContain('rx="5"');
  });

  it("should apply custom background color", () => {
    const svg = buildHeatmapSVG(makeSampleData(), { bg: "#ff0000" });
    expect(svg).toContain('fill="#ff0000"');
  });

  it("should handle empty data", () => {
    const svg = buildHeatmapSVG([]);
    expect(svg).toContain("<svg xmlns=");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("$0.00");
  });

  it("should include month labels", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("Jan");
  });

  it("should include day labels", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("Mon");
    expect(svg).toContain("Wed");
    expect(svg).toContain("Fri");
  });

  it("should include legend", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("Less");
    expect(svg).toContain("More");
  });

  it("should include total cost in label", () => {
    const svg = buildHeatmapSVG(makeSampleData());
    expect(svg).toContain("Total:");
    expect(svg).toContain("$85.00"); // 10 + 25 + 50
  });
});
