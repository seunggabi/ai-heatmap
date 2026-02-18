import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Activity {
  date: string;
  count: number;
  level: number;
}

const THEMES: Record<string, string[]> = {
  light: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  blue: ["#ebedf0", "#c0ddf9", "#73b3f3", "#3886e1", "#1b4f91"],
  orange: ["#ebedf0", "#ffdf80", "#ffa742", "#e87d2f", "#ac5219"],
  pink: ["#ebedf0", "#ffc0cb", "#ff69b4", "#ff1493", "#c71585"],
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function num(v: string | string[] | undefined, def: number): number {
  if (v == null || v === "") return def;
  const n = Number(v);
  return isNaN(n) ? def : n;
}

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const {
    colorScheme = "light",
    blockSize: bs,
    blockMargin: bm,
    blockRadius: br,
    start,
    end,
    theme: themeName,
    bg,
    textColor,
    stats: statsParam,
    weekday: weekdayParam,
  } = req.query;

  const BLOCK = num(bs as string, 16);
  const GAP = num(bm as string, 4);
  const RADIUS = num(br as string, 3);
  const PAD = 16;
  const LABEL_W = 36;
  const HEADER_H = 24;

  const scheme = (colorScheme as string) || "light";
  const colors = THEMES[(themeName as string) || scheme] || THEMES.light;
  const bgColor = (bg as string) || (scheme === "dark" ? "#0d1117" : "transparent");
  const txtColor = (textColor as string) || (scheme === "dark" ? "#c9d1d9" : "#24292f");
  const subColor = scheme === "dark" ? "#8b949e" : "#666";

  // Load data
  let data: Activity[];
  try {
    const raw = readFileSync(resolve(process.cwd(), "public/data.json"), "utf-8");
    data = JSON.parse(raw);
  } catch {
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="40"><text x="10" y="25" fill="red">data.json not found</text></svg>`);
    return;
  }

  // Filter by date range
  if (start) data = data.filter((d) => d.date >= (start as string));
  if (end) data = data.filter((d) => d.date <= (end as string));

  // Group by weeks
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

  const cols = weeks.length;
  const svgW = PAD * 2 + LABEL_W + cols * (BLOCK + GAP) + GAP;
  const svgH = PAD * 2 + HEADER_H + 7 * (BLOCK + GAP) + GAP + 36;

  // Month labels
  const monthLabels: { x: number; label: string }[] = [];
  let prevMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const month = new Date(weeks[w][0].date).getMonth();
    if (month !== prevMonth) {
      monthLabels.push({ x: PAD + LABEL_W + w * (BLOCK + GAP), label: MONTHS[month] });
      prevMonth = month;
    }
  }

  // Rects
  const rects: string[] = [];
  for (let w = 0; w < weeks.length; w++) {
    for (const d of weeks[w]) {
      const dow = new Date(d.date).getDay();
      const x = PAD + LABEL_W + w * (BLOCK + GAP);
      const y = PAD + HEADER_H + dow * (BLOCK + GAP);
      const color = colors[d.level] || colors[0];
      const cost = d.count > 0 ? `$${d.count.toFixed(2)}` : "No data";
      rects.push(`<rect x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${color}"><title>${d.date}: ${cost}</title></rect>`);
    }
  }

  // Legend
  const legendX = svgW - PAD - 5 * (BLOCK + GAP) - 60;
  const legendY = PAD + HEADER_H + 7 * (BLOCK + GAP) + 10;
  const legendRects = colors
    .map((c, i) => `<rect x="${legendX + 40 + i * (BLOCK + GAP)}" y="${legendY}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${c}"/>`)
    .join("\n");

  // Total
  const totalCost = data.reduce((s, d) => s + d.count, 0);
  const totalFormatted = usd(totalCost);
  const firstYear = data[0]?.date.slice(0, 4);
  const lastYear = data[data.length - 1]?.date.slice(0, 4);
  const yearLabel = firstYear === lastYear ? firstYear : `${firstYear}~${lastYear}`;

  // Stats
  const showStats = (statsParam as string) !== "false";
  const showWeekday = (weekdayParam as string) !== "false";
  const activeDays = data.filter((d) => d.count > 0);
  const dailyAvg = activeDays.length ? totalCost / activeDays.length : 0;
  const peak = activeDays.reduce((max, d) => (d.count > max.count ? d : max), { count: 0, date: "-" });

  // Weekday averages
  const weekdayTotals = Array(7).fill(0);
  const weekdayCounts = Array(7).fill(0);
  for (const d of data) {
    if (d.count > 0) {
      const dow = new Date(d.date).getDay();
      weekdayTotals[dow] += d.count;
      weekdayCounts[dow]++;
    }
  }
  const weekdayAvgs = weekdayTotals.map((t: number, i: number) => (weekdayCounts[i] ? t / weekdayCounts[i] : 0));
  const maxWeekdayAvg = Math.max(...weekdayAvgs);

  // Weekly averages
  const weeklyTotals = weeks.map((w) => w.reduce((s, d) => s + d.count, 0));
  const activeWeeks = weeklyTotals.filter((t) => t > 0);
  const weeklyAvg = activeWeeks.length ? activeWeeks.reduce((s, t) => s + t, 0) / activeWeeks.length : 0;

  // Extra height
  const STATS_H = showStats ? 50 : 0;
  const WEEKDAY_H = showWeekday ? 180 : 0;
  const totalH = svgH + STATS_H + WEEKDAY_H;

  // Stats section Y
  const statsY = legendY + BLOCK + 20;
  const weekdayY = statsY + (showStats ? 50 : 10);
  const BAR_W = Math.min(300, svgW - PAD * 2 - 100);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}">
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
<text x="${PAD + LABEL_W}" y="${legendY + BLOCK - 1}" class="total">${totalFormatted} total (${yearLabel})</text>
${showStats ? `
<line x1="${PAD}" y1="${statsY - 6}" x2="${svgW - PAD}" y2="${statsY - 6}" stroke="${scheme === "dark" ? "#30363d" : "#d0d7de"}" stroke-width="1"/>
<text x="${PAD}" y="${statsY + 12}" class="stat">Daily avg: <tspan class="stat-val">${usd(dailyAvg)}</tspan></text>
<text x="${PAD + 200}" y="${statsY + 12}" class="stat">Weekly avg: <tspan class="stat-val">${usd(weeklyAvg)}</tspan></text>
<text x="${PAD}" y="${statsY + 30}" class="stat">Peak: <tspan class="stat-val">${usd(peak.count)}</tspan> (${peak.date})</text>
<text x="${PAD + 200}" y="${statsY + 30}" class="stat">Active: <tspan class="stat-val">${activeDays.length}</tspan> / ${data.length} days</text>
` : ""}
${showWeekday ? `
<text x="${PAD}" y="${weekdayY}" class="section-title">Avg by weekday</text>
${DAY_NAMES.map((name, i) => {
  const barY = weekdayY + 14 + i * 22;
  const barLen = maxWeekdayAvg > 0 ? (weekdayAvgs[i] / maxWeekdayAvg) * BAR_W : 0;
  const barColor = colors[Math.min(4, Math.ceil((weekdayAvgs[i] / (maxWeekdayAvg || 1)) * 4))];
  return `<text x="${PAD}" y="${barY + 12}" class="bar-label">${name}</text>` +
    `<rect x="${PAD + 36}" y="${barY + 2}" width="${barLen}" height="14" rx="3" fill="${barColor}" opacity="0.85"/>` +
    `<text x="${PAD + 42 + barLen}" y="${barY + 13}" class="bar-val">${usd(weekdayAvgs[i])}</text>`;
}).join("\n")}
` : ""}
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.status(200).send(svg);
}
