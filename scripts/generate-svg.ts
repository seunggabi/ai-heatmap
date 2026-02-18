#!/usr/bin/env npx tsx
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Activity } from "../src/lib/constants";
import { buildHeatmapSVG } from "../src/lib/svg-builder";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load config
const configPath = resolve(root, "heatmap.config.json");
const defaults = {
  colorScheme: "light",
  theme: "",
  blockSize: 16,
  blockMargin: 4,
  blockRadius: 3,
  bg: "",
  textColor: "",
  start: "",
  end: "",
  stats: true,
  weekday: true,
};
const config = existsSync(configPath)
  ? { ...defaults, ...JSON.parse(readFileSync(configPath, "utf-8")) }
  : defaults;

// Load data
let data: Activity[] = JSON.parse(
  readFileSync(resolve(root, "public/data.json"), "utf-8"),
);
if (config.start) data = data.filter((d) => d.date >= config.start);
if (config.end) data = data.filter((d) => d.date <= config.end);

const svg = buildHeatmapSVG(data, {
  colorScheme: config.colorScheme,
  theme: config.theme || undefined,
  blockSize: config.blockSize,
  blockMargin: config.blockMargin,
  blockRadius: config.blockRadius,
  bg: config.bg || undefined,
  textColor: config.textColor || undefined,
  stats: config.stats,
  weekday: config.weekday,
});

const outPath = resolve(root, "public/heatmap.svg");
writeFileSync(outPath, svg);
console.log(`Generated ${outPath} (config: ${configPath})`);
