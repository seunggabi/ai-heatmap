#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
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

const [command, ...args] = process.argv.slice(2);

const HELP = `
ai-heatmap - AI usage cost heatmap

Commands:
  init          [--repo <name>]        Create a new heatmap repo and generate initial data
  update        [--repo <owner/repo>]  Generate data + push to repo
                [--name <machine>]
  generate-svg                         Generate heatmap.svg from data.json
  delete        [--repo <name>]        Delete the heatmap GitHub repo
  deploy        [--repo <name>]        Deploy to Vercel (SVG API endpoint)

Options:
  --repo <name>           Target repo (default: {user}-ai-heatmap)
  --name <machine>        Machine name for per-device data file (default: serial number)
  --since YYYYMMDD        Start date (update only)
  --until YYYYMMDD        End date (update only)

Examples:
  npx ai-heatmap init
  npx ai-heatmap init --repo my-heatmap
  npx ai-heatmap update
  npx ai-heatmap update --name=mac
  npx ai-heatmap update --repo owner/repo-name
  npx ai-heatmap delete
  npx ai-heatmap deploy
`;

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function resolveRepo(repoArg) {
  try {
    const owner = execSync("gh api user --jq .login", { encoding: "utf-8" }).trim();
    if (!repoArg) return `${owner}/${owner}-ai-heatmap`;
    if (!repoArg.includes("/")) return `${owner}/${repoArg}`;
    return repoArg;
  } catch {
    if (repoArg && repoArg.includes("/")) return repoArg;
    console.error("Could not determine repo. Use --repo <owner/repo>");
    process.exit(1);
  }
}

function pushFile(repo, repoPath, localPath) {
  const content = readFileSync(localPath, "utf-8");
  const base64 = Buffer.from(content).toString("base64");

  let sha = "";
  try {
    sha = execSync(
      `gh api repos/${repo}/contents/${repoPath} --jq .sha`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    ).trim();
  } catch { /* file doesn't exist yet */ }

  const payload = {
    message: `Update ${repoPath} (${new Date().toISOString().slice(0, 10)})`,
    content: base64,
  };
  if (sha) payload.sha = sha;

  const payloadStr = JSON.stringify(JSON.stringify(payload));
  execSync(
    `echo ${payloadStr} | gh api repos/${repo}/contents/${repoPath} -X PUT --input -`,
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  console.log(`  Pushed ${repoPath} to ${repo}`);
}

switch (command) {
  case "init": {
    const script = resolve(__dirname, "init.mjs");
    const repoName = getArg("--repo") || args[0] || "";
    execSync(`node ${script} ${repoName}`, { stdio: "inherit" });
    break;
  }
  case "update": {
    const genScript = resolve(root, "scripts/generate.mjs");
    const outDir = resolve(root, "public");
    const genArgs = args.filter(
      (a) => a.startsWith("--since") || a.startsWith("--until") || a.startsWith("--name"),
    );

    const repo = resolveRepo(getArg("--repo"));

    // 머신 이름 결정 (generate.mjs와 동일한 로직)
    const nameFlag = genArgs.find((a) => a.startsWith("--name="));
    const machineName = nameFlag
      ? nameFlag.slice("--name=".length)
      : getMachineName();

    // 1. GitHub API로 다른 컴퓨터의 data-*.json 파일들을 로컬에 다운로드
    console.log(`Fetching machine data files from ${repo}...`);
    mkdirSync(outDir, { recursive: true });
    try {
      const raw = execSync(
        `gh api repos/${repo}/contents/public --jq '[.[] | select(.name | test("^data-.+\\.json$"))]'`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
      );
      const files = JSON.parse(raw);
      for (const file of files) {
        // 현재 컴퓨터 파일은 generate에서 새로 생성하므로 건너뜀
        if (file.name === `data-${machineName}.json`) continue;
        // 디렉토리 목록 API는 content를 포함하지 않으므로 파일별로 개별 fetch
        const content = execSync(
          `gh api repos/${repo}/contents/${file.path} --jq .content`,
          { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
        ).trim();
        const decoded = Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf-8");
        writeFileSync(resolve(outDir, file.name), decoded);
        console.log(`  Fetched ${file.name}`);
      }
    } catch {
      console.log("  No existing machine data files found (first run).");
    }

    // 2. generate: 이 컴퓨터 데이터 수집 + 모든 data-*.json 합산 → data.json 생성
    // machineName을 명시적으로 전달해 cli.mjs와 generate.mjs가 동일한 값을 사용하도록 보장
    const genArgsWithName = genArgs.some((a) => a.startsWith("--name="))
      ? genArgs
      : [`--name=${machineName}`, ...genArgs];
    execSync(`node ${genScript} ${genArgsWithName.join(" ")}`, { stdio: "inherit" });

    // 3. data-{name}.json push (이 컴퓨터 개별 파일)
    const machineFile = `data-${machineName}.json`;
    const machineFilePath = resolve(outDir, machineFile);
    if (existsSync(machineFilePath)) {
      console.log(`Pushing machine data file...`);
      pushFile(repo, `public/${machineFile}`, machineFilePath);
    }

    // 4. data.json push (합산 결과)
    const dataPath = resolve(outDir, "data.json");
    if (existsSync(dataPath)) {
      console.log(`Pushing merged data.json...`);
      pushFile(repo, "public/data.json", dataPath);
    }

    break;
  }
  case "delete": {
    const script = resolve(__dirname, "delete.mjs");
    const repoName = getArg("--repo") || args[0] || "";
    execSync(`node ${script} ${repoName}`, { stdio: "inherit" });
    break;
  }
  case "generate-svg": {
    const svgScript = resolve(root, "scripts/generate-svg.mjs");
    execSync(`node ${svgScript}`, { stdio: "inherit", cwd: process.cwd() });
    break;
  }
  case "deploy": {
    try {
      execSync("vercel --version", { stdio: "ignore" });
    } catch {
      console.log("Installing Vercel CLI...");
      execSync("npm install -g vercel", { stdio: "inherit" });
    }
    // Determine target directory: --repo > positional arg > auto-detect {user}-ai-heatmap > cwd
    let deployDir = process.cwd();
    const repoArg = getArg("--repo") || args[0];
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
