import { describe, it, expect } from "vitest";
import { THEMES, MONTHS, DAY_NAMES, LAYOUT } from "../src/lib/constants";

describe("THEMES", () => {
  it("should have all expected theme keys", () => {
    expect(Object.keys(THEMES)).toEqual(
      expect.arrayContaining(["light", "dark", "blue", "orange", "pink"]),
    );
  });

  it("should have 5 colors per theme", () => {
    for (const [name, colors] of Object.entries(THEMES)) {
      expect(colors, `theme "${name}" should have 5 colors`).toHaveLength(5);
    }
  });

  it("should have valid hex color strings", () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    for (const [name, colors] of Object.entries(THEMES)) {
      for (const color of colors) {
        expect(color, `"${color}" in theme "${name}"`).toMatch(hexPattern);
      }
    }
  });
});

describe("MONTHS", () => {
  it("should have 12 months", () => {
    expect(MONTHS).toHaveLength(12);
  });

  it("should start with Jan and end with Dec", () => {
    expect(MONTHS[0]).toBe("Jan");
    expect(MONTHS[11]).toBe("Dec");
  });
});

describe("DAY_NAMES", () => {
  it("should have 7 days", () => {
    expect(DAY_NAMES).toHaveLength(7);
  });

  it("should start with Sun and end with Sat", () => {
    expect(DAY_NAMES[0]).toBe("Sun");
    expect(DAY_NAMES[6]).toBe("Sat");
  });
});

describe("LAYOUT", () => {
  it("should have expected layout values", () => {
    expect(LAYOUT.PAD).toBe(16);
    expect(LAYOUT.LABEL_W).toBe(36);
    expect(LAYOUT.HEADER_H).toBe(24);
  });
});
