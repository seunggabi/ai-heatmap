# ccusage Integration: ai-heatmap

This directory contains the proposed integration code for [ccusage](https://github.com/ryoppippi/ccusage).

## Proposal

Add `--heatmap` flag to ccusage that auto-generates and pushes data to a user's ai-heatmap GitHub Pages repo.

### Usage

```bash
# One-time setup: create your heatmap repo
npx ai-heatmap init {user}-ai-heatmap

# Then with ccusage:
npx ccusage daily --heatmap --heatmap-repo {user}/{user}-ai-heatmap

# Or set env var for convenience:
export CCUSAGE_HEATMAP_REPO={user}/{user}-ai-heatmap
npx ccusage daily --heatmap
```

### How it works

1. ccusage runs its normal `daily` aggregation
2. With `--heatmap`, it transforms the data to `react-activity-calendar` format
3. Pushes `data.json` to the specified GitHub repo via GitHub API (`gh` CLI)
4. GitHub Actions on the target repo auto-deploys to GitHub Pages

### Files

- `heatmap-plugin.mjs` — The integration module for ccusage
- `README.md` — This file
