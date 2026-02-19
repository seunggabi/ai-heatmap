#!/usr/bin/env node
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const args = process.argv.slice(2);
const sinceFlag = args.find((a) => a.startsWith("--since"));
const untilFlag = args.find((a) => a.startsWith("--until"));

let cmd = "npx --yes ccusage@latest daily --json";
if (sinceFlag) cmd += ` ${sinceFlag}`;
if (untilFlag) cmd += ` ${untilFlag}`;

console.log(`Running: ${cmd}`);
const raw = execSync(cmd, { encoding: "utf-8", timeout: 300000 });
const { daily } = JSON.parse(raw);

const costs = daily.map((d) => d.totalCost);
const maxCost = Math.max(...costs);

function toLevel(cost) {
  if (cost === 0 || maxCost === 0) return 0;
  const ratio = cost / maxCost;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// Build a map of existing data
const dataMap = new Map(daily.map((d) => [d.date, d]));

// Fill 365 days (from today back 364 days)
const today = new Date();
const activities = [];
for (let i = 364; i >= 0; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const date = d.toISOString().slice(0, 10);
  const entry = dataMap.get(date);
  if (entry) {
    const cacheTotal = entry.cacheCreationTokens + entry.cacheReadTokens;
    const cacheHitRate = cacheTotal > 0
      ? Math.round((entry.cacheReadTokens / cacheTotal) * 100)
      : 0;
    activities.push({
      date,
      count: Math.round(entry.totalCost * 100) / 100,
      level: toLevel(entry.totalCost),
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      totalTokens: entry.totalTokens,
      cacheHitRate,
      modelsUsed: entry.modelsUsed,
      modelBreakdowns: entry.modelBreakdowns.map((m) => ({
        model: m.modelName,
        cost: Math.round(m.cost * 100) / 100,
      })),
    });
  } else {
    activities.push({ date, count: 0, level: 0 });
  }
}

const outDir = resolve(root, "public");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "data.json");
writeFileSync(outPath, JSON.stringify(activities, null, 2));
console.log(`Generated ${outPath} (${activities.length} days)`);
