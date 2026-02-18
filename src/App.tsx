import { useEffect, useState } from "react";
import { ActivityCalendar } from "react-activity-calendar";
import { Tooltip as ReactTooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";

interface ModelBreakdown {
  model: string;
  cost: number;
}

interface Activity {
  date: string;
  count: number;
  level: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheHitRate?: number;
  modelsUsed?: string[];
  modelBreakdowns?: ModelBreakdown[];
}

interface CalendarOptions {
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
}

const DEFAULT_OPTIONS: CalendarOptions = {
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
};

function parseOptions(): CalendarOptions {
  const params = new URLSearchParams(window.location.search);
  const opts = { ...DEFAULT_OPTIONS };

  const bool = (key: keyof CalendarOptions) => {
    const v = params.get(key);
    if (v !== null) {
      (opts as Record<string, unknown>)[key] = v === "true" || v === "1";
    }
  };
  const num = (key: keyof CalendarOptions) => {
    const v = params.get(key);
    if (v !== null && !isNaN(Number(v))) {
      (opts as Record<string, unknown>)[key] = Number(v);
    }
  };

  num("blockSize");
  num("blockMargin");
  num("blockRadius");
  num("fontSize");
  bool("hideColorLegend");
  bool("hideMonthLabels");
  bool("hideTotalCount");
  bool("showWeekdayLabels");
  num("weekStart");

  const cs = params.get("colorScheme");
  if (cs === "light" || cs === "dark") opts.colorScheme = cs;

  return opts;
}

function commas(n: number) {
  return n.toLocaleString("en-US");
}

function formatUSD(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTokens(n: number) {
  return commas(n);
}

function shortModel(name: string) {
  return name
    .replace("claude-", "")
    .replace(/-\d{8}$/, "")
    .replace(/-preview$/, "");
}

export default function App() {
  const [data, setData] = useState<Activity[]>([]);
  const [options] = useState(parseOptions);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const startDate = params.get("start");
  const endDate = params.get("end");

  useEffect(() => {
    fetch("./data.json")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(`Failed to load data.json: ${e.message}`));
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

  const totalCost = filtered.reduce((s, d) => s + d.count, 0);
  const firstYear = filtered[0]?.date.slice(0, 4);
  const lastYear = filtered[filtered.length - 1]?.date.slice(0, 4);
  const yearLabel = firstYear === lastYear ? firstYear : `${firstYear}~${lastYear}`;

  return (
    <div
      className="container"
      data-color-scheme={options.colorScheme}
    >
      <h1>AI Usage Heatmap</h1>
      <p className="summary">
        Total: {formatUSD(totalCost)} across {filtered.length} days ({yearLabel})
      </p>

      <ActivityCalendar
        data={filtered}
        blockSize={options.blockSize}
        blockMargin={options.blockMargin}
        blockRadius={options.blockRadius}
        fontSize={options.fontSize}
        hideColorLegend={options.hideColorLegend}
        hideMonthLabels={options.hideMonthLabels}
        hideTotalCount={true}
        showWeekdayLabels={options.showWeekdayLabels}
        weekStart={options.weekStart}
        colorScheme={options.colorScheme}
        labels={{
          totalCount: "{{count}} USD spent in {{year}}",
        }}
        theme={{
          light: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
          dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
        }}
        renderBlock={(block, activity) => {
          const a = activity as Activity;
          if (a.count === 0) return block;
          const lines = [
            `<strong>${a.date}</strong>`,
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

      <details className="params-help">
        <summary>Query Parameters</summary>
        <table>
          <thead>
            <tr><th>Param</th><th>Default</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>blockSize</td><td>14</td><td>Block pixel size</td></tr>
            <tr><td>blockMargin</td><td>4</td><td>Gap between blocks</td></tr>
            <tr><td>blockRadius</td><td>2</td><td>Block border radius</td></tr>
            <tr><td>fontSize</td><td>14</td><td>Label font size</td></tr>
            <tr><td>hideColorLegend</td><td>false</td><td>Hide color legend</td></tr>
            <tr><td>hideMonthLabels</td><td>false</td><td>Hide month labels</td></tr>
            <tr><td>hideTotalCount</td><td>false</td><td>Hide total count</td></tr>
            <tr><td>showWeekdayLabels</td><td>true</td><td>Show weekday labels</td></tr>
            <tr><td>weekStart</td><td>0</td><td>Week start day (0=Sun)</td></tr>
            <tr><td>colorScheme</td><td>light</td><td>light / dark</td></tr>
            <tr><td>start</td><td>-</td><td>Start date (YYYY-MM-DD)</td></tr>
            <tr><td>end</td><td>-</td><td>End date (YYYY-MM-DD)</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}
