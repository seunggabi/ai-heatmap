#!/usr/bin/env node
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function getMachineName() {
  try {
    if (process.platform === "darwin") {
      const serial = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformSerialNumber/ {print $NF}' | tr -d '\"'",
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
      ).trim();
      if (serial) return serial;
    } else if (process.platform === "linux") {
      const id = readFileSync("/etc/machine-id", "utf-8").trim();
      if (id) return id.slice(0, 12);
    } else if (process.platform === "win32") {
      const uuid = execSync("wmic csproduct get UUID /value", {
        encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"],
      }).match(/UUID=([^\r\n]+)/)?.[1]?.trim();
      if (uuid) return uuid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
    }
  } catch {}
  return os.hostname().replace(/[^a-zA-Z0-9_-]/g, "_");
}

const args = process.argv.slice(2);
const sinceFlag = args.find((a) => a.startsWith("--since"));
const untilFlag = args.find((a) => a.startsWith("--until"));
const nameFlag = args.find((a) => a.startsWith("--name="));
const dirFlag = args.find((a) => a.startsWith("--dir="));
const mergeOnly = args.includes("--merge-only");
const machineName = nameFlag
  ? nameFlag.slice("--name=".length)
  : getMachineName();

function toLevel(cost, max) {
  if (cost === 0 || max === 0) return 0;
  const ratio = cost / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const outDir = dirFlag
  ? resolve(dirFlag.slice("--dir=".length))
  : resolve(root, "public");
mkdirSync(outDir, { recursive: true });

if (!mergeOnly) {
  let cmd = "npx --yes ccusage@latest daily --json";
  if (sinceFlag) cmd += ` ${sinceFlag}`;
  if (untilFlag) cmd += ` ${untilFlag}`;

  console.log(`Running: ${cmd}`);
  let raw;
  try {
    raw = execSync(cmd, { encoding: "utf-8", timeout: 300000 });
  } catch (err) {
    if (err.code === "ETIMEDOUT" || err.signal === "SIGTERM") {
      console.error("\nError: ccusage timed out after 5 minutes.");
      console.error("This may be caused by a slow network or npm registry issue.");
      console.error("Try running manually: npx clear-npx-cache && npx --yes ccusage@latest daily --json");
    } else {
      console.error("\nError running ccusage:", err.message);
      if (err.stderr) console.error(err.stderr);
    }
    process.exit(1);
  }
  const { daily } = JSON.parse(raw);

  const costs = daily.map((d) => d.totalCost);
  const maxCost = Math.max(...costs);

  // Build a map of existing data
  const dataMap = new Map(daily.map((d) => [d.date, d]));

  // Fill 365 days (from today back 364 days)
  const today = new Date();
  const activities = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = dataMap.get(date);
    if (entry) {
      const cacheReadTokens = entry.cacheReadTokens ?? 0;
      const cacheCreationTokens = entry.cacheCreationTokens ?? 0;
      const cacheTotal = cacheCreationTokens + cacheReadTokens;
      const cacheHitRate = cacheTotal > 0
        ? Math.round((cacheReadTokens / cacheTotal) * 100)
        : 0;
      activities.push({
        date,
        count: Math.round(entry.totalCost * 100) / 100,
        level: toLevel(entry.totalCost, maxCost),
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        totalTokens: entry.totalTokens,
        cacheReadTokens,
        cacheCreationTokens,
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

  // 1. 컴퓨터별 개별 파일 저장
  const machineFile = resolve(outDir, `data-${machineName}.json`);
  writeFileSync(machineFile, JSON.stringify(activities, null, 2));
  console.log(`Generated ${machineFile} (${activities.length} days)`);
}

// 2. 모든 data-{name}.json 파일을 읽어서 합산
const dataFiles = readdirSync(outDir)
  .filter((f) => f.match(/^data-.+\.json$/))
  .sort()
  .map((f) => resolve(outDir, f));

console.log(`Merging ${dataFiles.length} file(s): ${dataFiles.map((f) => f.split("/").pop()).join(", ")}`);

const mergeMap = new Map();

for (const file of dataFiles) {
  const fileData = JSON.parse(readFileSync(file, "utf-8"));
  for (const entry of fileData) {
    if (!mergeMap.has(entry.date)) {
      mergeMap.set(entry.date, {
        date: entry.date,
        count: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        modelsUsed: new Set(),
        modelBreakdowns: new Map(),
      });
    }
    const m = mergeMap.get(entry.date);
    m.count = Math.round((m.count + (entry.count ?? 0)) * 100) / 100;
    m.inputTokens += entry.inputTokens ?? 0;
    m.outputTokens += entry.outputTokens ?? 0;
    m.totalTokens += entry.totalTokens ?? 0;
    m.cacheReadTokens += entry.cacheReadTokens ?? 0;
    m.cacheCreationTokens += entry.cacheCreationTokens ?? 0;

    for (const model of (entry.modelsUsed ?? [])) {
      m.modelsUsed.add(model);
    }

    for (const mb of (entry.modelBreakdowns ?? [])) {
      const prev = m.modelBreakdowns.get(mb.model) ?? 0;
      m.modelBreakdowns.set(mb.model, Math.round((prev + mb.cost) * 100) / 100);
    }
  }
}

// 합산된 최대값 기준으로 level 재계산
const allCounts = [...mergeMap.values()].map((m) => m.count);
const mergedMax = Math.max(...allCounts);

const merged = [...mergeMap.values()]
  .sort((a, b) => a.date.localeCompare(b.date))
  .map((m) => {
    const cacheTotal = m.cacheReadTokens + m.cacheCreationTokens;
    const result = {
      date: m.date,
      count: m.count,
      level: toLevel(m.count, mergedMax),
    };
    if (m.inputTokens || m.outputTokens || m.totalTokens) {
      result.inputTokens = m.inputTokens;
      result.outputTokens = m.outputTokens;
      result.totalTokens = m.totalTokens;
    }
    if (cacheTotal > 0) {
      result.cacheHitRate = Math.round((m.cacheReadTokens / cacheTotal) * 100);
    }
    if (m.modelsUsed.size > 0) {
      result.modelsUsed = [...m.modelsUsed];
    }
    const mbs = [...m.modelBreakdowns.entries()].map(([model, cost]) => ({ model, cost }));
    if (mbs.length > 0) {
      result.modelBreakdowns = mbs;
    }
    return result;
  });

const outPath = resolve(outDir, "data.json");
writeFileSync(outPath, JSON.stringify(merged, null, 2));
console.log(`Merged into ${outPath} (${merged.length} days)`);
