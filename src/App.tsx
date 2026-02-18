import { useEffect, useState } from "react";
import { ActivityCalendar } from "react-activity-calendar";
import { Tooltip as ReactTooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import { THEMES, type Activity } from "./lib/constants";
import { formatUSD, formatTokens, calcWeekdayStats } from "./lib/utils";

interface StatsConfig {
  dailyAvg: boolean;
  weeklyAvg: boolean;
  peak: boolean;
  activeDays: boolean;
}

interface HeatmapConfig {
  colorScheme?: string;
  theme?: string;
  blockSize?: number;
  blockMargin?: number;
  blockRadius?: number;
  bg?: string;
  textColor?: string;
  start?: string;
  end?: string;
  stats?: boolean | StatsConfig;
  weekday?: boolean;
}

interface AppOptions {
  blockSize: number;
  blockMargin: number;
  blockRadius: number;
  fontSize: number;
  hideColorLegend: boolean;
  hideMonthLabels: boolean;
  hideTotalCount: boolean;
  showWeekdayLabels: boolean;
  weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  colorScheme: "light" | "dark";
  theme: string;
  bg: string;
  textColor: string;
  stats: StatsConfig;
  weekday: boolean;
}

const DEFAULT_OPTIONS: AppOptions = {
  blockSize: 12,
  blockMargin: 3,
  blockRadius: 2,
  fontSize: 12,
  hideColorLegend: false,
  hideMonthLabels: false,
  hideTotalCount: false,
  showWeekdayLabels: true,
  weekStart: 0,
  colorScheme: "light",
  theme: "",
  bg: "",
  textColor: "",
  stats: { dailyAvg: true, weeklyAvg: true, peak: true, activeDays: true },
  weekday: true,
};

function parseOptions(config: HeatmapConfig = {}): AppOptions {
  const params = new URLSearchParams(window.location.search);

  // Merge config defaults
  const opts: AppOptions = {
    ...DEFAULT_OPTIONS,
    ...(config.blockSize != null && { blockSize: config.blockSize }),
    ...(config.blockMargin != null && { blockMargin: config.blockMargin }),
    ...(config.blockRadius != null && { blockRadius: config.blockRadius }),
    ...((config.colorScheme === "light" || config.colorScheme === "dark") && { colorScheme: config.colorScheme }),
    ...(config.theme && { theme: config.theme }),
    ...(config.bg && { bg: config.bg }),
    ...(config.textColor && { textColor: config.textColor }),
    ...(config.weekday != null && { weekday: config.weekday }),
  };

  // Stats config
  if (config.stats != null) {
    if (typeof config.stats === "boolean") {
      const v = config.stats;
      opts.stats = { dailyAvg: v, weeklyAvg: v, peak: v, activeDays: v };
    } else {
      opts.stats = { ...DEFAULT_OPTIONS.stats, ...config.stats };
    }
  }

  // Query string overrides
  const bool = (key: string) => {
    const v = params.get(key);
    if (v !== null) return v === "true" || v === "1";
    return undefined;
  };
  const num = (key: string) => {
    const v = params.get(key);
    if (v !== null && !isNaN(Number(v))) return Number(v);
    return undefined;
  };

  const bs = num("blockSize"); if (bs != null) opts.blockSize = bs;
  const bm = num("blockMargin"); if (bm != null) opts.blockMargin = bm;
  const br = num("blockRadius"); if (br != null) opts.blockRadius = br;
  const fs = num("fontSize"); if (fs != null) opts.fontSize = fs;
  const ws = num("weekStart"); if (ws != null) opts.weekStart = ws as AppOptions["weekStart"];

  const hcl = bool("hideColorLegend"); if (hcl != null) opts.hideColorLegend = hcl;
  const hml = bool("hideMonthLabels"); if (hml != null) opts.hideMonthLabels = hml;
  const htc = bool("hideTotalCount"); if (htc != null) opts.hideTotalCount = htc;
  const swl = bool("showWeekdayLabels"); if (swl != null) opts.showWeekdayLabels = swl;

  const cs = params.get("colorScheme");
  if (cs === "light" || cs === "dark") opts.colorScheme = cs;

  const th = params.get("theme");
  if (th) opts.theme = th;

  const bg = params.get("bg");
  if (bg) opts.bg = bg;

  const tc = params.get("textColor");
  if (tc) opts.textColor = tc;

  // Stats query string: stats=false disables all, or individual: dailyAvg=false
  const statsParam = bool("stats");
  if (statsParam === false) {
    opts.stats = { dailyAvg: false, weeklyAvg: false, peak: false, activeDays: false };
  } else {
    const da = bool("dailyAvg"); if (da != null) opts.stats.dailyAvg = da;
    const wa = bool("weeklyAvg"); if (wa != null) opts.stats.weeklyAvg = wa;
    const pk = bool("peak"); if (pk != null) opts.stats.peak = pk;
    const ad = bool("activeDays"); if (ad != null) opts.stats.activeDays = ad;
  }

  const wd = bool("weekday");
  if (wd != null) opts.weekday = wd;

  return opts;
}

function shortModel(name: string) {
  return name
    .replace("claude-", "")
    .replace(/-\d{8}$/, "")
    .replace(/-preview$/, "");
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function App() {
  const [data, setData] = useState<Activity[]>([]);
  const [options, setOptions] = useState(() => parseOptions());
  const [error, setError] = useState<string | null>(null);
  const [configDates, setConfigDates] = useState<{ start?: string; end?: string }>({});

  const params = new URLSearchParams(window.location.search);
  const startDate = params.get("start") || configDates.start || null;
  const endDate = params.get("end") || configDates.end || null;

  useEffect(() => {
    fetch("./data.json")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(`Failed to load data.json: ${e.message}`));

    fetch("./heatmap.config.json")
      .then((r) => r.ok ? r.json() : null)
      .then((config: HeatmapConfig | null) => {
        if (!config) return;
        setOptions(parseOptions(config));
        if (config.start || config.end) {
          setConfigDates({ start: config.start, end: config.end });
        }
      })
      .catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="container">
        <p className="error">{error}</p>
        <p>
          Run <code>npm run generate</code> to create data.json
        </p>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="container">
        <p>Loading...</p>
      </div>
    );
  }

  const filtered = data.filter((d) => {
    if (startDate && d.date < startDate) return false;
    if (endDate && d.date > endDate) return false;
    return true;
  });

  const activeDaysData = filtered.filter((d) => d.count > 0);
  const totalCost = filtered.reduce((s, d) => s + d.count, 0);
  const dailyAvg = activeDaysData.length ? totalCost / activeDaysData.length : 0;
  const weeks = Math.max(1, Math.ceil(filtered.length / 7));
  const weeklyAvg = totalCost / weeks;
  const peak = activeDaysData.reduce((max, d) => (d.count > max.count ? d : max), activeDaysData[0]);
  const firstYear = filtered[0]?.date.slice(0, 4);
  const lastYear = filtered[filtered.length - 1]?.date.slice(0, 4);
  const yearLabel = firstYear === lastYear ? firstYear : `${firstYear}~${lastYear}`;

  // Resolve theme colors
  const effectiveTheme = options.theme || options.colorScheme;
  const themeColors = THEMES[effectiveTheme] || THEMES[options.colorScheme];

  // Weekday averages
  const { weekdayAvgs, maxWeekdayAvg } = calcWeekdayStats(filtered);

  const hasStats = options.stats.dailyAvg || options.stats.weeklyAvg || options.stats.peak || options.stats.activeDays;

  const containerStyle: React.CSSProperties = {
    ...(options.bg && { background: options.bg }),
    ...(options.textColor && { color: options.textColor }),
  };

  return (
    <div
      className="container"
      data-color-scheme={options.colorScheme}
      style={containerStyle}
    >
      <h1>AI Usage Heatmap</h1>
      <ActivityCalendar
        data={filtered}
        blockSize={options.blockSize}
        blockMargin={options.blockMargin}
        blockRadius={options.blockRadius}
        fontSize={options.fontSize}
        hideColorLegend={options.hideColorLegend}
        hideMonthLabels={options.hideMonthLabels}
        hideTotalCount={options.hideTotalCount}
        showWeekdayLabels={options.showWeekdayLabels}
        weekStart={options.weekStart}
        colorScheme={options.colorScheme}
        labels={{
          totalCount: `\uD83D\uDCB0 Total: ${formatUSD(totalCost)} across ${filtered.length} days (${yearLabel})`,
        }}
        theme={{
          light: themeColors,
          dark: options.colorScheme === "dark" ? themeColors : THEMES.dark,
        }}
        renderBlock={(block, activity) => {
          const a = activity as Activity;
          if (a.count === 0) return block;
          const lines = [
            `<strong>${a.date} (${DAY_SHORT[new Date(a.date).getDay()]})</strong>`,
            `Cost: ${formatUSD(a.count)}`,
            a.inputTokens != null ? `In: ${formatTokens(a.inputTokens)} / Out: ${formatTokens(a.outputTokens ?? 0)}` : "",
            a.totalTokens ? `Total: ${formatTokens(a.totalTokens)}` : "",
            a.cacheHitRate != null ? `Cache hit: ${a.cacheHitRate}%` : "",
            ...(a.modelBreakdowns?.map((m) =>
              `${shortModel(m.model)}: ${formatUSD(m.cost)}`
            ) ?? []),
          ].filter(Boolean);
          return (
            <g data-tooltip-id="heatmap-tooltip" data-tooltip-html={lines.join("<br/>")}>
              {block}
            </g>
          );
        }}
      />
      <ReactTooltip id="heatmap-tooltip" />

      {hasStats && activeDaysData.length > 0 && (
        <div className="stats">
          {options.stats.dailyAvg && (
            <div className="stat-item">
              <span className="stat-value">{formatUSD(dailyAvg)}</span>
              <span className="stat-label">Daily Avg</span>
            </div>
          )}
          {options.stats.weeklyAvg && (
            <div className="stat-item">
              <span className="stat-value">{formatUSD(weeklyAvg)}</span>
              <span className="stat-label">Weekly Avg</span>
            </div>
          )}
          {options.stats.peak && peak && (
            <div className="stat-item">
              <span className="stat-value">{formatUSD(peak.count)}</span>
              <span className="stat-label">Peak ({peak.date})</span>
            </div>
          )}
          {options.stats.activeDays && (
            <div className="stat-item">
              <span className="stat-value">{activeDaysData.length}</span>
              <span className="stat-label">Active Days</span>
            </div>
          )}
        </div>
      )}

      {options.weekday && maxWeekdayAvg > 0 && (
        <div className="weekday-chart">
          <h3>Average by Weekday</h3>
          <div className="weekday-bars">
            {weekdayAvgs.map((avg, i) => (
              <div key={i} className="weekday-bar-item">
                <div className="weekday-bar-wrapper">
                  <div
                    className="weekday-bar"
                    style={{
                      height: `${maxWeekdayAvg ? (avg / maxWeekdayAvg) * 100 : 0}%`,
                      backgroundColor: themeColors[Math.min(4, Math.ceil((avg / maxWeekdayAvg) * 4))],
                    }}
                  />
                </div>
                <span className="weekday-label">{DAY_LABELS[i]}</span>
                <span className="weekday-value">{formatUSD(avg)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="params-help">
        <summary>Query Parameters</summary>
        <table>
          <thead>
            <tr><th>Param</th><th>Default</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>colorScheme</td><td>light</td><td>light / dark</td></tr>
            <tr><td>theme</td><td>-</td><td>light / dark / blue / orange / pink</td></tr>
            <tr><td>blockSize</td><td>12</td><td>Block pixel size</td></tr>
            <tr><td>blockMargin</td><td>3</td><td>Gap between blocks</td></tr>
            <tr><td>blockRadius</td><td>2</td><td>Block border radius</td></tr>
            <tr><td>fontSize</td><td>12</td><td>Label font size</td></tr>
            <tr><td>bg</td><td>-</td><td>Background color</td></tr>
            <tr><td>textColor</td><td>-</td><td>Text color</td></tr>
            <tr><td>stats</td><td>true</td><td>Show/hide all stats</td></tr>
            <tr><td>dailyAvg</td><td>true</td><td>Show daily average</td></tr>
            <tr><td>weeklyAvg</td><td>true</td><td>Show weekly average</td></tr>
            <tr><td>peak</td><td>true</td><td>Show peak day</td></tr>
            <tr><td>activeDays</td><td>true</td><td>Show active days count</td></tr>
            <tr><td>weekday</td><td>true</td><td>Show weekday average chart</td></tr>
            <tr><td>start</td><td>-</td><td>Start date (YYYY-MM-DD)</td></tr>
            <tr><td>end</td><td>-</td><td>End date (YYYY-MM-DD)</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}
