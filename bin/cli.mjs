#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const [command, ...args] = process.argv.slice(2);

const HELP = `
ai-heatmap - AI usage cost heatmap

Commands:
  init [repo-name]           Create a new heatmap repo and generate initial data
  update [--repo <owner/repo>]  Generate data + push to repo (default: {user}/{user}-ai-heatmap)
  delete [repo-name]         Delete the heatmap GitHub repo
  deploy                     Deploy to Vercel (SVG API endpoint)

Update options:
  --since YYYYMMDD        Start date
  --until YYYYMMDD        End date
  --repo <owner/repo>     Target repo (default: auto-detect)

Examples:
  npx ai-heatmap init
  npx ai-heatmap update
  npx ai-heatmap update --repo {user}-ai-heatmap
  npx ai-heatmap delete
  npx ai-heatmap deploy
`;

switch (command) {
  case "init": {
    const script = resolve(__dirname, "init.mjs");
    execSync(`node ${script} ${args.join(" ")}`, { stdio: "inherit" });
    break;
  }
  case "update": {
    const genScript = resolve(root, "scripts/generate.mjs");
    const pushScript = resolve(__dirname, "push.mjs");
    const genArgs = args.filter(
      (a) => a.startsWith("--since") || a.startsWith("--until"),
    );
    const pushArgs = args.filter((a) => a.startsWith("--repo"));
    execSync(`node ${genScript} ${genArgs.join(" ")}`, { stdio: "inherit" });
    execSync(`node ${pushScript} ${pushArgs.join(" ")}`, { stdio: "inherit" });
    break;
  }
  case "delete": {
    const script = resolve(__dirname, "delete.mjs");
    execSync(`node ${script} ${args.join(" ")}`, { stdio: "inherit" });
    break;
  }
  case "deploy": {
    try {
      execSync("vercel --version", { stdio: "ignore" });
    } catch {
      console.log("Installing Vercel CLI...");
      execSync("npm install -g vercel", { stdio: "inherit" });
    }
    // Determine target directory: argument > auto-detect {user}-ai-heatmap > cwd
    let deployDir = process.cwd();
    const repoArg = args[0];
    if (repoArg) {
      deployDir = resolve(process.cwd(), repoArg);
    } else {
      try {
        const owner = execSync("gh api user --jq .login", { encoding: "utf-8" }).trim();
        const autoDir = resolve(process.cwd(), `${owner}-ai-heatmap`);
        if (existsSync(autoDir)) {
          deployDir = autoDir;
        }
      } catch {}
    }
    console.log(`Deploying from ${deployDir}...`);
    try {
      execSync("git pull", { cwd: deployDir, stdio: "inherit" });
    } catch {
      console.log("git pull skipped (not a git repo or no remote)");
    }
    execSync(`vercel --prod`, {
      cwd: deployDir,
      stdio: "inherit",
    });
    break;
  }
  default:
    console.log(HELP);
}
