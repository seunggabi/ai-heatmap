#!/usr/bin/env node
import { execSync } from "node:child_process";

let owner;
try {
  owner = execSync("gh api user --jq .login", { encoding: "utf-8" }).trim();
} catch {
  console.error("gh CLI not available or not authenticated.");
  process.exit(1);
}

const repoName = process.argv[2] || `${owner}-ai-heatmap`;
const repo = repoName.includes("/") ? repoName : `${owner}/${repoName}`;

console.log(`Deleting GitHub repo: ${repo}...`);

try {
  execSync(`gh repo delete ${repo} --yes`, { stdio: "inherit" });
  console.log(`Deleted ${repo}`);
} catch {
  console.error(`Failed to delete ${repo}. Check gh auth and repo permissions.`);
  process.exit(1);
}
