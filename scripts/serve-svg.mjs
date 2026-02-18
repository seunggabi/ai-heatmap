#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const THEMES = {
  light: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  blue: ["#ebedf0", "#c0ddf9", "#73b3f3", "#3886e1", "#1b4f91"],
  orange: ["#ebedf0", "#ffdf80", "#ffa742", "#e87d2f", "#ac5219"],
  pink: ["#ebedf0", "#ffc0cb", "#ff69b4", "#ff1493", "#c71585"],
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function num(v, def) { if (v == null || v === "") return def; const n = Number(v); return isNaN(n) ? def : n; }

function generateSvg(query) {
  const BLOCK = num(query.get("blockSize"), 16);
  const GAP = num(query.get("blockMargin"), 4);
  const RADIUS = num(query.get("blockRadius"), 3);
  const PAD = 16;
  const LABEL_W = 36;
  const HEADER_H = 24;
  const scheme = query.get("colorScheme") || "light";
  const colors = THEMES[query.get("theme") || scheme] || THEMES.light;
  const bgColor = query.get("bg") || (scheme === "dark" ? "#0d1117" : "transparent");
  const txtColor = query.get("textColor") || (scheme === "dark" ? "#c9d1d9" : "#24292f");
  const subColor = scheme === "dark" ? "#8b949e" : "#666";

  const dataPath = resolve(root, "public/data.json");
  let data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const start = query.get("start"), end = query.get("end");
  if (start) data = data.filter(d => d.date >= start);
  if (end) data = data.filter(d => d.date <= end);

  const weeks = []; let cur = [];
  for (const d of data) {
    if (new Date(d.date).getDay() === 0 && cur.length) { weeks.push(cur); cur = []; }
    cur.push(d);
  }
  if (cur.length) weeks.push(cur);

  const cols = weeks.length;
  const svgW = PAD * 2 + LABEL_W + cols * (BLOCK + GAP) + GAP;
  const svgH = PAD * 2 + HEADER_H + 7 * (BLOCK + GAP) + GAP + 36;


  const monthLabels = []; let pm = -1;
  for (let w = 0; w < weeks.length; w++) {
    const m = new Date(weeks[w][0].date).getMonth();
    if (m !== pm) { monthLabels.push({ x: PAD + LABEL_W + w * (BLOCK + GAP), label: MONTHS[m] }); pm = m; }
  }

  const rects = [];
  for (let w = 0; w < weeks.length; w++) {
    for (const d of weeks[w]) {
      const dow = new Date(d.date).getDay();
      const x = PAD + LABEL_W + w * (BLOCK + GAP);
      const y = PAD + HEADER_H + dow * (BLOCK + GAP);
      const cost = d.count > 0 ? `$${d.count.toFixed(2)}` : "No data";
      rects.push(`<rect x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${colors[d.level] || colors[0]}"><title>${d.date}: ${cost}</title></rect>`);
    }
  }

  const lx = svgW - PAD - 5 * (BLOCK + GAP) - 60;
  const ly = PAD + HEADER_H + 7 * (BLOCK + GAP) + 10;
  const lr = colors.map((c, i) => `<rect x="${lx + 40 + i * (BLOCK + GAP)}" y="${ly}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${c}"/>`).join("\n");
  const total = data.reduce((s, d) => s + d.count, 0);
  const usd = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tf = usd(total);
  const fy = data[0]?.date.slice(0, 4), ly2 = data[data.length - 1]?.date.slice(0, 4);
  const yl = fy === ly2 ? fy : `${fy}~${ly2}`;

  // Stats
  const showStats = query.get("stats") !== "false";
  const showWeekday = query.get("weekday") !== "false";
  const activeDays = data.filter(d => d.count > 0);
  const dailyAvg = activeDays.length ? total / activeDays.length : 0;
  const peak = activeDays.reduce((max, d) => d.count > max.count ? d : max, { count: 0, date: "-" });

  // Weekday averages
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayTotals = Array(7).fill(0);
  const weekdayCounts = Array(7).fill(0);
  for (const d of data) {
    if (d.count > 0) {
      const dow = new Date(d.date).getDay();
      weekdayTotals[dow] += d.count;
      weekdayCounts[dow]++;
    }
  }
  const weekdayAvgs = weekdayTotals.map((t, i) => weekdayCounts[i] ? t / weekdayCounts[i] : 0);
  const maxWeekdayAvg = Math.max(...weekdayAvgs);

  // Weekly averages
  const weeklyTotals = weeks.map(w => w.reduce((s, d) => s + d.count, 0));
  const activeWeeks = weeklyTotals.filter(t => t > 0);
  const weeklyAvg = activeWeeks.length ? activeWeeks.reduce((s, t) => s + t, 0) / activeWeeks.length : 0;

  // Extra height
  const STATS_H = showStats ? 50 : 0;
  const WEEKDAY_H = showWeekday ? 180 : 0;
  const totalH = svgH + STATS_H + WEEKDAY_H;

  // Stats section Y
  const statsY = ly + BLOCK + 20;
  const weekdayY = statsY + (showStats ? 50 : 10);
  const BAR_W = Math.min(300, svgW - PAD * 2 - 100);

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
<text x="${PAD + LABEL_W}" y="${ly + BLOCK - 1}" class="total">${tf} total (${yl})</text>
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

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/heatmap" || url.pathname === "/api/heatmap.svg") {
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Access-Control-Allow-Origin": "*" });
    res.end(generateSvg(url.searchParams));
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><body style="padding:2rem;font-family:sans-serif">
<h2>AI Heatmap SVG API</h2>
<p><a href="/api/heatmap">Default (light)</a></p>
<p><a href="/api/heatmap?colorScheme=dark">Dark</a></p>
<p><a href="/api/heatmap?theme=blue">Blue</a></p>
<p><a href="/api/heatmap?theme=orange">Orange</a></p>
<p><a href="/api/heatmap?theme=pink">Pink</a></p>
<p><a href="/api/heatmap?colorScheme=dark&blockSize=16&blockMargin=4">Dark + Large</a></p>
<p><a href="/api/heatmap?start=2026-02-01&end=2026-02-18">Feb only</a></p>
<p><a href="/api/heatmap?stats=false&weekday=false">Heatmap only</a></p>
<hr/><h3>Preview:</h3>
<img src="/api/heatmap" style="max-width:100%" /><br/><br/>
<img src="/api/heatmap?colorScheme=dark" style="max-width:100%" />
</body></html>`);
  }
});

server.listen(3333, () => console.log("SVG API: http://localhost:3333"));
