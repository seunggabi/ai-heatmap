#!/usr/bin/env node
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const [command, ...args] = process.argv.slice(2);

const HELP = `
ai-heatmap - AI usage cost heatmap

Commands:
  init [repo-name]        Create a new heatmap GitHub Pages repo
  generate [options]      Generate data.json from ccusage
  push [--repo <owner/repo>]  Push data.json to target repo (default: {user}/{user}-ai-heatmap)
  update [--repo <owner/repo>]  generate + push combined (default: {user}/{user}-ai-heatmap)
  deploy                     Deploy to Vercel (SVG API endpoint)

Generate options:
  --since YYYYMMDD        Start date
  --until YYYYMMDD        End date

Examples:
  npx ai-heatmap init {user}-ai-heatmap
  npx ai-heatmap generate --since 20260101
  npx ai-heatmap push --repo {user}-ai-heatmap
  npx ai-heatmap update --repo {user}-ai-heatmap
  npx ai-heatmap deploy
`;

switch (command) {
  case "init": {
    const script = resolve(__dirname, "init.mjs");
    execSync(`node ${script} ${args.join(" ")}`, { stdio: "inherit" });
    break;
  }
  case "generate": {
    const script = resolve(root, "scripts/generate.mjs");
    execSync(`node ${script} ${args.join(" ")}`, { stdio: "inherit" });
    break;
  }
  case "push": {
    const script = resolve(__dirname, "push.mjs");
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
  case "deploy": {
    try {
      execSync("vercel --version", { stdio: "ignore" });
    } catch {
      console.log("Installing Vercel CLI...");
      execSync("npm install -g vercel", { stdio: "inherit" });
    }
    execSync(`vercel --prod ${args.join(" ")}`, {
      cwd: root,
      stdio: "inherit",
    });
    break;
  }
  default:
    console.log(HELP);
}
