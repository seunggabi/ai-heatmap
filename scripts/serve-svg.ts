#!/usr/bin/env npx tsx
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import type { Activity } from "../src/lib/constants";
import { parseNum } from "../src/lib/utils";
import { buildHeatmapSVG } from "../src/lib/svg-builder";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function generateSvg(query: URLSearchParams): string {
  const dataPath = resolve(root, "public/data.json");
  let data: Activity[] = JSON.parse(readFileSync(dataPath, "utf-8"));

  const start = query.get("start");
  const end = query.get("end");
  if (start) data = data.filter((d) => d.date >= start);
  if (end) data = data.filter((d) => d.date <= end);

  return buildHeatmapSVG(data, {
    colorScheme: query.get("colorScheme") || "light",
    theme: query.get("theme") || undefined,
    blockSize: parseNum(query.get("blockSize"), 16),
    blockMargin: parseNum(query.get("blockMargin"), 4),
    blockRadius: parseNum(query.get("blockRadius"), 3),
    bg: query.get("bg") || undefined,
    textColor: query.get("textColor") || undefined,
    stats: query.get("stats") !== "false",
    weekday: query.get("weekday") !== "false",
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url!, "http://localhost");
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
