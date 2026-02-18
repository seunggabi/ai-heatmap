# AI Heatmap

[![npm version](https://img.shields.io/npm/v/ai-heatmap?color=cb3837&logo=npm)](https://www.npmjs.com/package/ai-heatmap)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/seunggabi/ai-heatmap?style=social)](https://github.com/seunggabi/ai-heatmap/stargazers)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)

GitHub-style heatmap for your AI usage costs.
Powered by [ccusage](https://github.com/ryoppippi/ccusage) + [react-activity-calendar](https://github.com/grubersjoe/react-activity-calendar).

## Preview

<!-- Replace YOUR_VERCEL_DOMAIN with your actual Vercel deployment URL -->
![AI Heatmap](https://seunggabi-ai-heatmap/api/heatmap)

### Variations

```markdown
<!-- Dark mode with full stats -->
![](https://YOUR_VERCEL_DOMAIN/api/heatmap?colorScheme=dark)

<!-- Blue theme, heatmap + stats only -->
![](https://YOUR_VERCEL_DOMAIN/api/heatmap?theme=blue&weekday=false)

<!-- Heatmap only (clean embed) -->
![](https://YOUR_VERCEL_DOMAIN/api/heatmap?stats=false&weekday=false)

<!-- Custom date range -->
![](https://YOUR_VERCEL_DOMAIN/api/heatmap?start=2026-01-01&end=2026-02-18)
```

## Quick Start

```bash
# Init a new heatmap repo (creates repo + generates data + pushes)
npx ai-heatmap init
npx ai-heatmap init {user}-ai-heatmap

# Update data (generate + push)
npx ai-heatmap update
npx ai-heatmap update --repo {user}-ai-heatmap
```

## SVG API (Vercel)

~~Deploy~~ this repo to Vercel for a dynamic SVG endpoint. Embed it in any README:

```markdown
![AI Heatmap](https://your-app.vercel.app/api/heatmap)
```

The SVG is generated on each request from `public/data.json`, so you can control the output with query parameters.

### SVG API Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `colorScheme` | `light` | Color scheme: `light`, `dark` |
| `theme` | same as `colorScheme` | Theme override: `light`, `dark`, `blue`, `orange`, `pink` |
| `blockSize` | `16` | Size of each day block in pixels |
| `blockMargin` | `4` | Gap between blocks in pixels |
| `blockRadius` | `3` | Border radius of blocks in pixels |
| `bg` | auto | Background color (e.g. `%23ffffff`). Auto: transparent (light) / `#0d1117` (dark) |
| `textColor` | auto | Text color. Auto: `#24292f` (light) / `#c9d1d9` (dark) |
| `start` | - | Filter start date (`YYYY-MM-DD`) |
| `end` | - | Filter end date (`YYYY-MM-DD`) |
| `stats` | `true` | Show stats section (daily avg, weekly avg, peak, active days) |
| `weekday` | `true` | Show average-by-weekday bar chart |

### SVG API Examples

```
# Default light theme with all sections
/api/heatmap

# Dark theme
/api/heatmap?colorScheme=dark

# Pink theme, heatmap only
/api/heatmap?theme=pink&stats=false&weekday=false

# Custom block size
/api/heatmap?blockSize=12&blockMargin=3&blockRadius=2

# Date range filter
/api/heatmap?start=2026-01-01&end=2026-02-18
```

## GitHub Pages (Interactive)

The interactive version with tooltips is deployed via GitHub Pages. Tooltips show cost, tokens, cache hit rate, and per-model breakdown.

### GitHub Pages Options

All options are controlled via query string:

```
https://owner.github.io/{user}-ai-heatmap/?colorScheme=dark&blockSize=14
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `colorScheme` | `light` | Color scheme: `light`, `dark` |
| `blockSize` | `12` | Size of each day block in pixels |
| `blockMargin` | `3` | Gap between blocks in pixels |
| `blockRadius` | `2` | Border radius of blocks in pixels |
| `fontSize` | `12` | Font size in pixels |
| `hideColorLegend` | `false` | Hide the color legend |
| `hideMonthLabels` | `false` | Hide month labels |
| `hideTotalCount` | `false` | Hide total count label |
| `showWeekdayLabels` | `true` | Show weekday labels (Mon, Wed, Fri) |
| `weekStart` | `0` | First day of week (0 = Sunday, 1 = Monday) |
| `start` | - | Filter start date (`YYYY-MM-DD`) |
| `end` | - | Filter end date (`YYYY-MM-DD`) |

### Available Themes (SVG API)

| Theme | Colors |
|-------|--------|
| `light` | `#ebedf0` `#c6e48b` `#7bc96f` `#239a3b` `#196127` |
| `dark` | `#161b22` `#0e4429` `#006d32` `#26a641` `#39d353` |
| `blue` | `#ebedf0` `#c0ddf9` `#73b3f3` `#3886e1` `#1b4f91` |
| `orange` | `#ebedf0` `#ffdf80` `#ffa742` `#e87d2f` `#ac5219` |
| `pink` | `#ebedf0` `#ffc0cb` `#ff69b4` `#ff1493` `#c71585` |

## Configuration

Customize the static SVG output by editing `heatmap.config.json` in the project root:

```json
{
  "colorScheme": "light",
  "theme": "",
  "blockSize": 16,
  "blockMargin": 4,
  "blockRadius": 3,
  "bg": "",
  "textColor": "",
  "start": "",
  "end": "",
  "stats": true,
  "weekday": true
}
```

This config is used by `npm run generate:svg` to build `public/heatmap.svg`. Empty strings (`""`) use auto defaults.

For the Vercel dynamic API, use query parameters instead (they override config).

## Data Update

`ccusage` reads Claude Code usage logs from your **local machine**, so data must be generated locally and pushed to the repo.

```bash
npx ai-heatmap update
```

For automated updates, use a local cron job or macOS LaunchAgent:

```bash
# crontab -e (runs daily at midnight)
0 0 * * * npx ai-heatmap update
```

## Upgrade

To use the latest version of ai-heatmap:

```bash
# Always uses latest (npx caches, so clear if needed)
npx ai-heatmap@latest generate

# Clear npx cache and run
npx --yes ai-heatmap@latest update
```

## Deployment

### GitHub Pages

1. Enable GitHub Pages (Settings > Pages > Source: GitHub Actions)
2. Push `data.json` to `main` to trigger the first deploy
3. Manual deploy: Actions tab > "Deploy AI Heatmap" > "Run workflow"

### Vercel

1. Import this repo on [vercel.com](https://vercel.com)
2. Deploy (zero config — `vercel.json` included)
3. Use the deployed URL for dynamic SVG embeds

## Local Development

```bash
npm install
npm run generate              # Generate data.json from ccusage
npm run dev                   # Vite dev server (interactive heatmap)
node scripts/serve-svg.mjs    # Local SVG API on :3333
```

## Project Structure

```
ai-heatmap/
  api/heatmap.ts              # Vercel serverless SVG endpoint
  bin/cli.mjs                 # CLI entrypoint
  bin/init.mjs                # Repo scaffolding
  bin/push.mjs                # Push data to GitHub
  scripts/generate.mjs        # ccusage -> data.json
  scripts/generate-svg.mjs    # data.json -> static heatmap.svg
  scripts/serve-svg.mjs       # Local SVG dev server
  src/App.tsx                 # React interactive heatmap
  public/data.json            # Generated activity data
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=seunggabi/ai-heatmap&type=Date)](https://star-history.com/#seunggabi/ai-heatmap&Date)

## Sponsor

If this project helps you, consider supporting it:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤️-ea4aaa?logo=github)](https://github.com/sponsors/seunggabi)

## License

MIT License - see [LICENSE](LICENSE) file for details

Copyright (c) 2026 seunggabi

## Author

**seunggabi**

- GitHub: [@seunggabi](https://github.com/seunggabi)
- Repository: [ai-heatmap](https://github.com/seunggabi/ai-heatmap)

---

Made with ❤️ using React, TypeScript, and Vite
