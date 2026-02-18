#!/usr/bin/env node
/**
 * Standalone SVG generator that works with plain `node` (no tsx required).
 * Source of truth for SVG logic: src/lib/svg-builder.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// --- Inlined constants & utils (from src/lib/) ---

const THEMES = {
  light: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  blue: ["#ebedf0", "#c0ddf9", "#73b3f3", "#3886e1", "#1b4f91"],
  orange: ["#ebedf0", "#ffdf80", "#ffa742", "#e87d2f", "#ac5219"],
  pink: ["#ebedf0", "#ffc0cb", "#ff69b4", "#ff1493", "#c71585"],
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function usd(n) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildHeatmapSVG(data, options = {}) {
  const PAD = 16, LABEL_W = 36, HEADER_H = 24;
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
  const weeks = []; let cur = [];
  for (const d of data) {
    if (new Date(d.date).getDay() === 0 && cur.length) { weeks.push(cur); cur = []; }
    cur.push(d);
  }
  if (cur.length) weeks.push(cur);

  const cols = weeks.length;
  const svgW = PAD * 2 + LABEL_W + cols * (BLOCK + GAP) + GAP;
  const svgH = PAD * 2 + HEADER_H + 7 * (BLOCK + GAP) + GAP + 36;

  // Month labels
  const monthLabels = []; let pm = -1;
  for (let w = 0; w < weeks.length; w++) {
    const m = new Date(weeks[w][0].date).getMonth();
    if (m !== pm) { monthLabels.push({ x: PAD + LABEL_W + w * (BLOCK + GAP), label: MONTHS[m] }); pm = m; }
  }

  // Rects
  const rects = [];
  for (let w = 0; w < weeks.length; w++) {
    for (const d of weeks[w]) {
      const dow = new Date(d.date).getDay();
      const x = PAD + LABEL_W + w * (BLOCK + GAP);
      const y = PAD + HEADER_H + dow * (BLOCK + GAP);
      const lines = [d.date + ` (${DAY_NAMES[dow]})`];
      if (d.count > 0) {
        lines.push(`Cost: ${usd(d.count)}`);
        if (d.inputTokens != null) lines.push(`In: ${d.inputTokens.toLocaleString()} / Out: ${(d.outputTokens ?? 0).toLocaleString()}`);
        if (d.totalTokens) lines.push(`Total: ${d.totalTokens.toLocaleString()}`);
        if (d.cacheHitRate != null) lines.push(`Cache hit: ${d.cacheHitRate}%`);
        if (d.modelBreakdowns?.length) {
          for (const m of d.modelBreakdowns) lines.push(`${m.model}: ${usd(m.cost)}`);
        }
      } else {
        lines.push("No data");
      }
      rects.push(`<rect x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${colors[d.level] || colors[0]}"><title>${lines.join("&#10;")}</title></rect>`);
    }
  }

  // Legend
  const lx = svgW - PAD - 5 * (BLOCK + GAP) - 60;
  const ly = PAD + HEADER_H + 7 * (BLOCK + GAP) + 10;
  const lr = colors.map((c, i) => `<rect x="${lx + 40 + i * (BLOCK + GAP)}" y="${ly}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${c}"/>`).join("\n");

  // Stats
  const total = data.reduce((s, d) => s + d.count, 0);
  const fy = data[0]?.date.slice(0, 4), ly2 = data[data.length - 1]?.date.slice(0, 4);
  const yl = fy === ly2 ? fy : `${fy}~${ly2}`;
  const activeDays = data.filter(d => d.count > 0);
  const dailyAvg = activeDays.length ? total / activeDays.length : 0;
  const peak = activeDays.reduce((max, d) => d.count > max.count ? d : max, { count: 0, date: "-" });
  const weeklyTotals = weeks.map(w => w.reduce((s, d) => s + d.count, 0));
  const activeWeeks = weeklyTotals.filter(t => t > 0);
  const weeklyAvg = activeWeeks.length ? activeWeeks.reduce((s, t) => s + t, 0) / activeWeeks.length : 0;

  // Weekday averages
  const weekdayTotals = Array(7).fill(0);
  const weekdayCounts = Array(7).fill(0);
  for (const d of data) {
    if (d.count > 0) { const dow = new Date(d.date).getDay(); weekdayTotals[dow] += d.count; weekdayCounts[dow]++; }
  }
  const weekdayAvgs = weekdayTotals.map((t, i) => weekdayCounts[i] ? t / weekdayCounts[i] : 0);
  const maxWeekdayAvg = Math.max(...weekdayAvgs);

  const STATS_H = showStats ? 50 : 0;
  const WEEKDAY_H = showWeekday ? 180 : 0;
  const totalH = svgH + STATS_H + WEEKDAY_H;
  const statsY = ly + BLOCK + 20;
  const weekdayY = statsY + (showStats ? 50 : 10);
  const BAR_W = svgW - PAD * 2 - 100;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}">
<rect width="100%" height="100%" fill="${bgColor}" rx="6"/>
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:${txtColor}}.month{font-size:10px}.day{font-size:10px}.legend-label{font-size:10px;fill:${subColor}}.total{font-size:11px;font-weight:600}.stat{font-size:11px;fill:${subColor}}.stat-val{font-size:11px;font-weight:600;fill:${txtColor}}.bar-label{font-size:11px;fill:${subColor}}.bar-val{font-size:10px;fill:${subColor}}.section-title{font-size:12px;font-weight:600}</style>
${monthLabels.map(m => `<text x="${m.x}" y="${PAD + 14}" class="month">${m.label}</text>`).join("\n")}
<text x="${PAD}" y="${PAD + HEADER_H + 1 * (BLOCK + GAP) + BLOCK - 2}" class="day">Mon</text>
<text x="${PAD}" y="${PAD + HEADER_H + 3 * (BLOCK + GAP) + BLOCK - 2}" class="day">Wed</text>
<text x="${PAD}" y="${PAD + HEADER_H + 5 * (BLOCK + GAP) + BLOCK - 2}" class="day">Fri</text>
${rects.join("\n")}
<text x="${lx}" y="${ly + BLOCK - 1}" class="legend-label">Less</text>
${lr}
<text x="${lx + 40 + 5 * (BLOCK + GAP)}" y="${ly + BLOCK - 1}" class="legend-label">More</text>
<text x="${PAD + LABEL_W}" y="${ly + BLOCK - 1}" class="total">\uD83D\uDCB0 Total: ${usd(total)} across ${data.length} days (${yl})</text>
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
}

// --- Main ---

const configPath = resolve(root, "heatmap.config.json");
const defaults = {
  colorScheme: "light", theme: "", blockSize: 16, blockMargin: 4, blockRadius: 3,
  bg: "", textColor: "", start: "", end: "", stats: true, weekday: true,
};
const config = existsSync(configPath)
  ? { ...defaults, ...JSON.parse(readFileSync(configPath, "utf-8")) }
  : defaults;

let data = JSON.parse(readFileSync(resolve(root, "public/data.json"), "utf-8"));
if (config.start) data = data.filter(d => d.date >= config.start);
if (config.end) data = data.filter(d => d.date <= config.end);

const svg = buildHeatmapSVG(data, {
  colorScheme: config.colorScheme, theme: config.theme || undefined,
  blockSize: config.blockSize, blockMargin: config.blockMargin, blockRadius: config.blockRadius,
  bg: config.bg || undefined, textColor: config.textColor || undefined,
  stats: config.stats, weekday: config.weekday,
});

const outPath = resolve(root, "public/heatmap.svg");
writeFileSync(outPath, svg);
console.log(`Generated ${outPath}`);
