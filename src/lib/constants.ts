export interface Activity {
  date: string;
  count: number;
  level: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheHitRate?: number;
  modelBreakdowns?: { model: string; cost: number }[];
}

export const THEMES: Record<string, string[]> = {
  light: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  blue: ["#ebedf0", "#c0ddf9", "#73b3f3", "#3886e1", "#1b4f91"],
  orange: ["#ebedf0", "#ffdf80", "#ffa742", "#e87d2f", "#ac5219"],
  pink: ["#ebedf0", "#ffc0cb", "#ff69b4", "#ff1493", "#c71585"],
};

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const LAYOUT = {
  PAD: 16,
  LABEL_W: 36,
  HEADER_H: 24,
} as const;
