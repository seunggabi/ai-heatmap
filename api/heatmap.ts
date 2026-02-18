import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Activity } from "../src/lib/constants";
import { parseNum } from "../src/lib/utils";
import { buildHeatmapSVG } from "../src/lib/svg-builder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const {
    colorScheme,
    blockSize: bs,
    blockMargin: bm,
    blockRadius: br,
    start,
    end,
    theme,
    bg,
    textColor,
    stats: statsParam,
    weekday: weekdayParam,
  } = req.query;

  // Load data
  let data: Activity[];
  try {
    const raw = readFileSync(resolve(process.cwd(), "public/data.json"), "utf-8");
    data = JSON.parse(raw);
  } catch {
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="40"><text x="10" y="25" fill="red">data.json not found</text></svg>`);
    return;
  }

  // Filter by date range
  if (start) data = data.filter((d) => d.date >= (start as string));
  if (end) data = data.filter((d) => d.date <= (end as string));

  const svg = buildHeatmapSVG(data, {
    colorScheme: (colorScheme as string) || "light",
    theme: theme as string,
    blockSize: parseNum(bs as string, 16),
    blockMargin: parseNum(bm as string, 4),
    blockRadius: parseNum(br as string, 3),
    bg: bg as string,
    textColor: textColor as string,
    stats: (statsParam as string) !== "false",
    weekday: (weekdayParam as string) !== "false",
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.status(200).send(svg);
}
