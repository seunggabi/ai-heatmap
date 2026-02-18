import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: "svg-api-dev",
      configureServer() {
        const script = resolve(__dirname, "scripts/serve-svg.mjs");
        const child = spawn("node", [script], { stdio: "inherit" });
        process.on("exit", () => child.kill());
      },
    },
  ],
  base: "./",
  server: {
    proxy: {
      "/api/heatmap": "http://localhost:3333",
    },
  },
});
