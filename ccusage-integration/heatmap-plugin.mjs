/**
 * ai-heatmap plugin for ccusage
 *
 * Transforms ccusage daily data → react-activity-calendar format
 * and pushes to a GitHub repo for GitHub Pages deployment.
 *
 * Usage in ccusage:
 *   import { transformAndPush } from 'ai-heatmap/plugin'
 *   await transformAndPush(dailyData, { repo: 'owner/repo' })
 */
import { execSync } from "node:child_process";

/**
 * Transform ccusage daily data to react-activity-calendar format.
 * @param {Array} daily - ccusage daily output array
 * @returns {Array} activity calendar data
 */
export function transform(daily) {
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

  return daily.map((d) => ({
    date: d.date,
    count: Math.round(d.totalCost * 100) / 100,
    level: toLevel(d.totalCost),
    totalTokens: d.totalTokens,
    modelsUsed: d.modelsUsed,
  }));
}

/**
 * Push data.json to a GitHub repo using gh CLI.
 * @param {Array} activities - transformed activity data
 * @param {object} opts - { repo: 'owner/repo' }
 */
export function push(activities, { repo }) {
  const content = Buffer.from(JSON.stringify(activities, null, 2)).toString(
    "base64",
  );

  // Get current file SHA if exists
  let sha = "";
  try {
    sha = execSync(
      `gh api repos/${repo}/contents/public/data.json --jq .sha 2>/dev/null`,
      { encoding: "utf-8" },
    ).trim();
  } catch {
    // File doesn't exist yet
  }

  const payload = {
    message: `Update heatmap data (${new Date().toISOString().slice(0, 10)})`,
    content,
  };
  if (sha) payload.sha = sha;

  const tmpFile = `/tmp/ai-heatmap-payload-${Date.now()}.json`;
  const { writeFileSync, unlinkSync } = await import("node:fs");
  writeFileSync(tmpFile, JSON.stringify(payload));

  try {
    execSync(
      `gh api repos/${repo}/contents/public/data.json -X PUT --input ${tmpFile}`,
      { stdio: "inherit" },
    );
    console.log(`Updated public/data.json in ${repo}`);
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {}
  }
}

/**
 * Full pipeline: transform ccusage data and push to repo.
 * @param {Array} daily - ccusage daily output array
 * @param {object} opts - { repo: 'owner/repo' }
 */
export async function transformAndPush(daily, opts) {
  const activities = transform(daily);
  console.log(`Transformed ${activities.length} days of data`);
  await push(activities, opts);
}
