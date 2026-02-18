import { THEMES, MONTHS, DAY_NAMES, LAYOUT, type Activity } from "./constants";
import { formatUSD, groupByWeeks, calcWeekdayStats, calcStats } from "./utils";

export interface HeatmapSVGOptions {
  colorScheme?: string;
  theme?: string;
  blockSize?: number;
  blockMargin?: number;
  blockRadius?: number;
  bg?: string;
  textColor?: string;
  stats?: boolean;
  weekday?: boolean;
}

export function buildHeatmapSVG(
  data: Activity[],
  options: HeatmapSVGOptions = {},
): string {
  const { PAD, LABEL_W, HEADER_H } = LAYOUT;

  const BLOCK = options.blockSize ?? 16;
  const GAP = options.blockMargin ?? 4;
  const RADIUS = options.blockRadius ?? 3;

  const scheme = options.colorScheme ?? "light";
  const colors = THEMES[options.theme ?? scheme] ?? THEMES.light;
  const bgColor = options.bg || (scheme === "dark" ? "#0d1117" : "transparent");
  const txtColor = options.textColor || (scheme === "dark" ? "#c9d1d9" : "#24292f");
  const subColor = scheme === "dark" ? "#8b949e" : "#666";

  const showStats = options.stats !== false;
  const showWeekday = options.weekday !== false;

  // Group by weeks
  const weeks = groupByWeeks(data);

  const cols = weeks.length;
  const svgW = PAD * 2 + LABEL_W + cols * (BLOCK + GAP) + GAP;
  const svgH = PAD * 2 + HEADER_H + 7 * (BLOCK + GAP) + GAP + 36;

  // Month labels
  const monthLabels: { x: number; label: string }[] = [];
  let prevMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const month = new Date(weeks[w][0].date).getMonth();
    if (month !== prevMonth) {
      monthLabels.push({
        x: PAD + LABEL_W + w * (BLOCK + GAP),
        label: MONTHS[month],
      });
      prevMonth = month;
    }
  }

  // Rects with tooltips
  const rects: string[] = [];
  for (let w = 0; w < weeks.length; w++) {
    for (const d of weeks[w]) {
      const dow = new Date(d.date).getDay();
      const x = PAD + LABEL_W + w * (BLOCK + GAP);
      const y = PAD + HEADER_H + dow * (BLOCK + GAP);
      const color = colors[d.level] ?? colors[0];

      const lines = [d.date + ` (${DAY_NAMES[dow]})`];
      if (d.count > 0) {
        lines.push(`Cost: ${formatUSD(d.count)}`);
        if (d.inputTokens != null) {
          lines.push(
            `In: ${d.inputTokens.toLocaleString()} / Out: ${(d.outputTokens ?? 0).toLocaleString()}`,
          );
        }
        if (d.totalTokens) lines.push(`Total: ${d.totalTokens.toLocaleString()}`);
        if (d.cacheHitRate != null) lines.push(`Cache hit: ${d.cacheHitRate}%`);
        if (d.modelBreakdowns?.length) {
          for (const m of d.modelBreakdowns) {
            lines.push(`${m.model}: ${formatUSD(m.cost)}`);
          }
        }
      } else {
        lines.push("No data");
      }
      const title = lines.join("&#10;");
      rects.push(
        `<rect x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${color}"><title>${title}</title></rect>`,
      );
    }
  }

  // Legend
  const legendX = svgW - PAD - 5 * (BLOCK + GAP) - 60;
  const legendY = PAD + HEADER_H + 7 * (BLOCK + GAP) + 10;
  const legendRects = colors
    .map(
      (c, i) =>
        `<rect x="${legendX + 40 + i * (BLOCK + GAP)}" y="${legendY}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${c}"/>`,
    )
    .join("\n");

  // Stats
  const stats = calcStats(data, weeks);
  const { weekdayAvgs, maxWeekdayAvg } = calcWeekdayStats(data);

  // Year label
  const firstYear = data[0]?.date.slice(0, 4);
  const lastYear = data[data.length - 1]?.date.slice(0, 4);
  const yearLabel = firstYear === lastYear ? firstYear : `${firstYear}~${lastYear}`;

  // Extra height
  const STATS_H = showStats ? 50 : 0;
  const WEEKDAY_H = showWeekday ? 180 : 0;
  const totalH = svgH + STATS_H + WEEKDAY_H;

  // Stats section Y
  const statsY = legendY + BLOCK + 20;
  const weekdayY = statsY + (showStats ? 50 : 10);
  const BAR_W = svgW - PAD * 2 - 100;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}">
<rect width="100%" height="100%" fill="${bgColor}" rx="6"/>
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:${txtColor}}.month{font-size:10px}.day{font-size:10px}.legend-label{font-size:10px;fill:${subColor}}.total{font-size:11px;font-weight:600}.stat{font-size:11px;fill:${subColor}}.stat-val{font-size:11px;font-weight:600;fill:${txtColor}}.bar-label{font-size:11px;fill:${subColor}}.bar-val{font-size:10px;fill:${subColor}}.section-title{font-size:12px;font-weight:600}</style>
${monthLabels.map((m) => `<text x="${m.x}" y="${PAD + 14}" class="month">${m.label}</text>`).join("\n")}
<text x="${PAD}" y="${PAD + HEADER_H + 1 * (BLOCK + GAP) + BLOCK - 2}" class="day">Mon</text>
<text x="${PAD}" y="${PAD + HEADER_H + 3 * (BLOCK + GAP) + BLOCK - 2}" class="day">Wed</text>
<text x="${PAD}" y="${PAD + HEADER_H + 5 * (BLOCK + GAP) + BLOCK - 2}" class="day">Fri</text>
${rects.join("\n")}
<text x="${legendX}" y="${legendY + BLOCK - 1}" class="legend-label">Less</text>
${legendRects}
<text x="${legendX + 40 + 5 * (BLOCK + GAP)}" y="${legendY + BLOCK - 1}" class="legend-label">More</text>
<text x="${PAD + LABEL_W}" y="${legendY + BLOCK - 1}" class="total">\uD83D\uDCB0 Total: ${formatUSD(stats.totalCost)} across ${data.length} days (${yearLabel})</text>
${showStats ? `
<line x1="${PAD}" y1="${statsY - 6}" x2="${svgW - PAD}" y2="${statsY - 6}" stroke="${scheme === "dark" ? "#30363d" : "#d0d7de"}" stroke-width="1"/>
<text x="${PAD}" y="${statsY + 12}" class="stat">Daily avg: <tspan class="stat-val">${formatUSD(stats.dailyAvg)}</tspan></text>
<text x="${PAD + 200}" y="${statsY + 12}" class="stat">Weekly avg: <tspan class="stat-val">${formatUSD(stats.weeklyAvg)}</tspan></text>
<text x="${PAD}" y="${statsY + 30}" class="stat">Peak: <tspan class="stat-val">${formatUSD(stats.peak.count)}</tspan> (${stats.peak.date})</text>
<text x="${PAD + 200}" y="${statsY + 30}" class="stat">Active: <tspan class="stat-val">${stats.activeDays}</tspan> / ${data.length} days</text>
` : ""}
${showWeekday ? `
<text x="${PAD}" y="${weekdayY}" class="section-title">Avg by weekday</text>
${DAY_NAMES.map((name, i) => {
  const barY = weekdayY + 14 + i * 22;
  const barLen = maxWeekdayAvg > 0 ? (weekdayAvgs[i] / maxWeekdayAvg) * BAR_W : 0;
  const barColor = colors[Math.min(4, Math.ceil((weekdayAvgs[i] / (maxWeekdayAvg || 1)) * 4))];
  return `<text x="${PAD}" y="${barY + 12}" class="bar-label">${name}</text>` +
    `<rect x="${PAD + 36}" y="${barY + 2}" width="${barLen}" height="14" rx="3" fill="${barColor}" opacity="0.85"/>` +
    `<text x="${PAD + 42 + barLen}" y="${barY + 13}" class="bar-val">${formatUSD(weekdayAvgs[i])}</text>`;
}).join("\n")}
` : ""}
</svg>`;
}
