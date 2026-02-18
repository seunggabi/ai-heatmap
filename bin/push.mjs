#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const args = process.argv.slice(2);
const repoIdx = args.indexOf("--repo");
let repo = repoIdx !== -1 ? args[repoIdx + 1] : null;

try {
  const owner = execSync("gh api user --jq .login", { encoding: "utf-8" }).trim();
  if (!repo) {
    repo = `${owner}/my-ai-heatmap`;
    console.log(`No --repo specified, using default: ${repo}`);
  } else if (!repo.includes("/")) {
    repo = `${owner}/${repo}`;
  }
} catch {
  if (!repo || !repo.includes("/")) {
    console.error("Usage: ai-heatmap push --repo <owner/repo>");
    console.error("Example: ai-heatmap push --repo <owner>/my-ai-heatmap");
    process.exit(1);
  }
}

const dataPath = resolve(root, "public/data.json");
if (!existsSync(dataPath)) {
  console.error("data.json not found. Run 'ai-heatmap generate' first.");
  process.exit(1);
}

const content = readFileSync(dataPath, "utf-8");
const base64 = Buffer.from(content).toString("base64");

console.log(`Pushing data.json to ${repo}...`);

// Get current file SHA if it exists (needed for update)
let sha = "";
try {
  sha = execSync(
    `gh api repos/${repo}/contents/public/data.json --jq .sha 2>/dev/null`,
    { encoding: "utf-8" },
  ).trim();
} catch {
  // File doesn't exist yet, that's fine
}

const payload = {
  message: `Update heatmap data (${new Date().toISOString().slice(0, 10)})`,
  content: base64,
};
if (sha) payload.sha = sha;

const payloadStr = JSON.stringify(JSON.stringify(payload));

try {
  execSync(
    `echo ${payloadStr} | gh api repos/${repo}/contents/public/data.json -X PUT --input -`,
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  console.log(`Updated public/data.json in ${repo}`);
} catch (e) {
  console.error("Push failed. Check gh auth and repo permissions.");
  process.exit(1);
}
