import type { VercelRequest, VercelResponse } from "@vercel/node";

// --- Inlined types & constants (Vercel serverless can't resolve ../src/lib imports) ---

interface Activity {
  date: string;
  count: number;
  level: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheHitRate?: number;
  modelBreakdowns?: { model: string; cost: number }[];
}

const THEMES: Record<string, string[]> = {
  light: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  blue: ["#ebedf0", "#c0ddf9", "#73b3f3", "#3886e1", "#1b4f91"],
  orange: ["#ebedf0", "#ffdf80", "#ffa742", "#e87d2f", "#ac5219"],
  pink: ["#ebedf0", "#ffc0cb", "#ff69b4", "#ff1493", "#c71585"],
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function parseNum(v: string | undefined, def: number): number {
  if (v == null) return def;
  const n = Number(v);
  return Number.isNaN(n) ? def : n;
}

function usd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildHeatmapSVG(data: Activity[], options: {
  colorScheme?: string; theme?: string; blockSize?: number; blockMargin?: number;
  blockRadius?: number; bg?: string; textColor?: string; stats?: boolean; weekday?: boolean;
} = {}): string {
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

  const weeks: Activity[][] = []; let cur: Activity[] = [];
  for (const d of data) {
    if (new Date(d.date).getDay() === 0 && cur.length) { weeks.push(cur); cur = []; }
    cur.push(d);
  }
  if (cur.length) weeks.push(cur);

  const cols = weeks.length;
  const svgW = PAD * 2 + LABEL_W + cols * (BLOCK + GAP) + GAP;
  const svgH = PAD * 2 + HEADER_H + 7 * (BLOCK + GAP) + GAP + 36;

  const monthLabels: { x: number; label: string }[] = []; let pm = -1;
  for (let w = 0; w < weeks.length; w++) {
    const m = new Date(weeks[w][0].date).getMonth();
    if (m !== pm) { monthLabels.push({ x: PAD + LABEL_W + w * (BLOCK + GAP), label: MONTHS[m] }); pm = m; }
  }

  const rects: string[] = [];
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
          for (const mb of d.modelBreakdowns) lines.push(`${mb.model}: ${usd(mb.cost)}`);
        }
      } else {
        lines.push("No data");
      }
      rects.push(`<rect x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${colors[d.level] || colors[0]}"><title>${lines.join("&#10;")}</title></rect>`);
    }
  }

  const lx = svgW - PAD - 5 * (BLOCK + GAP) - 60;
  const ly = PAD + HEADER_H + 7 * (BLOCK + GAP) + 10;
  const lr = colors.map((c, i) => `<rect x="${lx + 40 + i * (BLOCK + GAP)}" y="${ly}" width="${BLOCK}" height="${BLOCK}" rx="${RADIUS}" fill="${c}"/>`).join("\n");

  const total = data.reduce((s, d) => s + d.count, 0);
  const fy = data[0]?.date.slice(0, 4), ly2 = data[data.length - 1]?.date.slice(0, 4);
  const yl = fy === ly2 ? fy : `${fy}~${ly2}`;
  const activeDays = data.filter(d => d.count > 0);
  const dailyAvg = activeDays.length ? total / activeDays.length : 0;
  const peak = activeDays.reduce((max, d) => d.count > max.count ? d : max, { count: 0, date: "-" });
  const weeklyTotals = weeks.map(w => w.reduce((s, d) => s + d.count, 0));
  const activeWeeks = weeklyTotals.filter(t => t > 0);
  const weeklyAvg = activeWeeks.length ? activeWeeks.reduce((s, t) => s + t, 0) / activeWeeks.length : 0;

  const weekdayTotals = Array(7).fill(0);
  const weekdayCounts = Array(7).fill(0);
  for (const d of data) {
    if (d.count > 0) { const dow = new Date(d.date).getDay(); weekdayTotals[dow] += d.count; weekdayCounts[dow]++; }
  }
  const weekdayAvgs = weekdayTotals.map((t: number, i: number) => weekdayCounts[i] ? t / weekdayCounts[i] : 0);
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
<text x="${PAD + LABEL_W}" y="${ly + BLOCK - 1}" class="total">\u{1F4B0} Total: ${usd(total)} across ${data.length} days (${yl})</text>
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

// --- Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const {
    colorScheme,
    blockSize: bs,
    blockMargin: bm,
    blockRadius: br,
    start,
    end,
    theme,
    bg,
    textColor,
    stats: statsParam,
    weekday: weekdayParam,
  } = req.query;

  let data: Activity[];
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const resp = await fetch(`${proto}://${host}/data.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch {
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="40"><text x="10" y="25" fill="red">data.json not found</text></svg>`);
    return;
  }

  if (start) data = data.filter((d) => d.date >= (start as string));
  if (end) data = data.filter((d) => d.date <= (end as string));

  const svg = buildHeatmapSVG(data, {
    colorScheme: (colorScheme as string) || "light",
    theme: theme as string,
    blockSize: parseNum(bs as string, 16),
    blockMargin: parseNum(bm as string, 4),
    blockRadius: parseNum(br as string, 3),
    bg: bg as string,
    textColor: textColor as string,
    stats: (statsParam as string) !== "false",
    weekday: (weekdayParam as string) !== "false",
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.status(200).send(svg);
}
