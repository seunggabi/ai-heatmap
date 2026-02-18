#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateRoot = resolve(__dirname, "..");
let defaultName = "ai-heatmap";
try {
  const owner = execSync("gh api user --jq .login", { encoding: "utf-8" }).trim();
  defaultName = `${owner}-ai-heatmap`;
} catch {}
const repoName = process.argv[2] || defaultName;
const targetDir = resolve(process.cwd(), repoName);

if (existsSync(targetDir)) {
  console.error(`Error: ${targetDir} already exists`);
  process.exit(1);
}

console.log(`Creating ${repoName}...`);
mkdirSync(targetDir, { recursive: true });

// package.json
const pkg = {
  name: repoName,
  version: "1.0.0",
  type: "module",
  scripts: {
    generate: "npx ai-heatmap generate",
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    update: `npx ai-heatmap update --repo OWNER/${repoName}`,
  },
  dependencies: {
    react: "^19.2.4",
    "react-activity-calendar": "^3.1.1",
    "react-dom": "^19.2.4",
    "react-tooltip": "^5.30.0",
  },
  devDependencies: {
    "@types/node": "^22.15.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vercel/node": "^5.6.4",
    "@vitejs/plugin-react": "^5.1.4",
    typescript: "^5.9.3",
    vite: "^7.3.1",
  },
};
writeFileSync(
  resolve(targetDir, "package.json"),
  JSON.stringify(pkg, null, 2),
);

// Copy template files
const filesToCopy = [
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "vercel.json",
];
for (const f of filesToCopy) {
  copyFileSync(resolve(templateRoot, f), resolve(targetDir, f));
}

// .gitignore (npm renames .gitignore to .npmignore during install, so generate it)
writeFileSync(resolve(targetDir, ".gitignore"), "node_modules\ndist\n");

// Copy src/
mkdirSync(resolve(targetDir, "src"), { recursive: true });
const srcFiles = ["main.tsx", "App.tsx", "App.css", "vite-env.d.ts"];
for (const f of srcFiles) {
  copyFileSync(
    resolve(templateRoot, "src", f),
    resolve(targetDir, "src", f),
  );
}

// Copy src/lib/
mkdirSync(resolve(targetDir, "src/lib"), { recursive: true });
const libFiles = ["constants.ts", "utils.ts", "svg-builder.ts"];
for (const f of libFiles) {
  copyFileSync(
    resolve(templateRoot, "src/lib", f),
    resolve(targetDir, "src/lib", f),
  );
}

// Copy api/
mkdirSync(resolve(targetDir, "api"), { recursive: true });
copyFileSync(
  resolve(templateRoot, "api/heatmap.ts"),
  resolve(targetDir, "api/heatmap.ts"),
);

// Create public/ with config
mkdirSync(resolve(targetDir, "public"), { recursive: true });
copyFileSync(
  resolve(templateRoot, "public/heatmap.config.json"),
  resolve(targetDir, "public/heatmap.config.json"),
);

// README.md
let ghUser = "";
try {
  ghUser = execSync("gh api user --jq .login", { encoding: "utf-8" }).trim();
} catch {}
const pagesUrl = ghUser ? `https://${ghUser}.github.io/${repoName}` : "";
const readmeLines = [
  `# ${repoName}`,
  "",
  "AI usage cost heatmap powered by [ai-heatmap](https://github.com/seunggabi/ai-heatmap).",
  "",
];
if (pagesUrl) {
  readmeLines.push(`![AI Heatmap](${pagesUrl}/heatmap.svg)`, "");
}
readmeLines.push(
  "## Usage",
  "",
  "```bash",
  "npx --yes ai-heatmap@latest update",
  "```",
  "",
  "### Cron (daily update)",
  "",
  "```bash",
  "0 0 * * * npx --yes ai-heatmap@latest update",
  "```",
  "",
  "## Dynamic SVG (by Vercel)",
  "",
  `![AI Heatmap](https://${repoName}.vercel.app/api/heatmap?theme=blue&colorScheme=dark)`,
  "",
  "```bash",
  "npx --yes ai-heatmap@latest deploy",
  "```",
  "",
);
writeFileSync(resolve(targetDir, "README.md"), readmeLines.join("\n"));

// GitHub Actions workflow
const workflowDir = resolve(targetDir, ".github/workflows");
mkdirSync(workflowDir, { recursive: true });
copyFileSync(
  resolve(templateRoot, ".github/workflows/deploy.yml"),
  resolve(workflowDir, "deploy.yml"),
);

// Git init
execSync("git init", { cwd: targetDir, stdio: "inherit" });
execSync("git add -A", { cwd: targetDir, stdio: "inherit" });
execSync('git commit -m "Initial commit: ai-heatmap"', {
  cwd: targetDir,
  stdio: "inherit",
});

// Try to create GitHub repo
try {
  execSync(`gh repo create ${repoName} --public --source=. --push`, {
    cwd: targetDir,
    stdio: "inherit",
  });
  console.log(`\nRepo created: https://github.com/$(gh api user -q .login)/${repoName}`);

  // Enable GitHub Pages
  try {
    execSync(
      `gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow 2>/dev/null || true`,
      { cwd: targetDir, stdio: "inherit" },
    );
  } catch {
    // Pages may need manual setup
  }
} catch {
  console.log("\nGitHub repo creation skipped (gh CLI not available or auth needed)");
  console.log("Push manually: git remote add origin <url> && git push -u origin main");
}

// Generate and push data
console.log("\nGenerating and pushing heatmap data...");
try {
  const genScript = resolve(templateRoot, "scripts/generate.mjs");
  const pushScript = resolve(__dirname, "push.mjs");
  execSync(`node ${genScript}`, { stdio: "inherit" });
  execSync(`node ${pushScript} --repo ${repoName}`, { stdio: "inherit" });
} catch {
  console.log("Data generation/push skipped. Run 'npx ai-heatmap update' later.");
}

console.log(`
Done! Your heatmap repo is ready:
  cd ${repoName}
  npm install
  npm run dev             # Preview locally
`);

// Ask to star the repo
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question("⭐ Star https://github.com/seunggabi/ai-heatmap ? (y/n) ", (answer) => {
  rl.close();
  if (answer.toLowerCase() === "y") {
    try {
      execSync("gh api user/starred/seunggabi/ai-heatmap -X PUT", { stdio: "ignore" });
      console.log("Thanks for starring! ⭐");
    } catch {
      console.log("Star skipped (gh CLI not available or auth needed).");
    }
  }
});
