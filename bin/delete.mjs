#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

let owner;
try {
  owner = execSync("gh api user --jq .login", { encoding: "utf-8" }).trim();
} catch {
  console.error("gh CLI not available or not authenticated.");
  process.exit(1);
}

const repoName = process.argv[2] || `${owner}-ai-heatmap`;
const repo = repoName.includes("/") ? repoName : `${owner}/${repoName}`;
const localName = repoName.includes("/") ? repoName.split("/")[1] : repoName;

console.log(`Deleting GitHub repo: ${repo}...`);

try {
  execSync(`gh repo delete ${repo} --yes`, { stdio: "inherit" });
  console.log(`Deleted ${repo}`);
} catch {
  console.error(`Failed to delete ${repo}. Check gh auth and repo permissions.`);
}

// Remove local directory if it exists
const localDir = resolve(process.cwd(), localName);
if (existsSync(localDir)) {
  console.log(`Removing local directory: ${localDir}`);
  rmSync(localDir, { recursive: true, force: true });
  console.log(`Removed ${localDir}`);
}
