import { describe, it, expect } from "vitest";
import {
  DISCOVERIES, DISCOVERY_IDS, SECTION_ORDER, parseMemory, emptyMemory, recordVisit, markSeen, markFound, progress,
  allSectionsSeen, furthest, ago, welcomeLine, isNightOwl, loadMemory, saveMemory, MEMORY_KEY,
} from "./memory";

const H = 3_600_000, D = 86_400_000;
const label = (id: string) => id.toUpperCase();

describe("discoveries list", () => {
  it("has unique ids and both languages filled in", () => {
    expect(new Set(DISCOVERY_IDS).size).toBe(DISCOVERIES.length);
    for (const d of DISCOVERIES) for (const l of ["en", "es"] as const) {
      expect(d[l].name.length).toBeGreaterThan(2); expect(d[l].hint.length).toBeGreaterThan(5);
    }
  });
});

describe("parseMemory is defensive", () => {
  it("returns empty for null, junk, and non-objects", () => {
    expect(parseMemory(null)).toEqual(emptyMemory());
    expect(parseMemory("{not json")).toEqual(emptyMemory());
    expect(parseMemory("42").visits).toBe(0);
  });
  it("drops unknown sections, unknown discoveries, and bad numbers", () => {
    const m = parseMemory(JSON.stringify({ visits: -3, first: "x", seen: ["terminal", "hack", 7], found: { konami: 5, bogus: 9, matrix: "no" }, lastSection: "nope" }));
    expect(m.visits).toBe(0); expect(m.first).toBe(0);
    expect(m.seen).toEqual(["terminal"]);
    expect(m.found).toEqual({ konami: 5 });
    expect(m.lastSection).toBeNull();
  });
  it("round-trips a good value", () => {
    const m = { ...emptyMemory(), visits: 3, first: 10, last: 20, seen: ["terminal", "uplink"], found: { keel: 99 } };
    expect(parseMemory(JSON.stringify(m))).toEqual(m);
  });
});

describe("visits", () => {
  it("counts a visit and keeps the first timestamp", () => {
    const a = recordVisit(emptyMemory(), 1000).mem;
    expect(a).toMatchObject({ visits: 1, first: 1000, last: 1000 });
    const b = recordVisit(a, 5000).mem;
    expect(b).toMatchObject({ visits: 2, first: 1000, last: 5000 });
  });
  it("remembers the furthest section from the previous visit", () => {
    let m = recordVisit(emptyMemory(), 1).mem;
    m = markSeen(markSeen(markSeen(m, "terminal"), "case-files"), "service-log");
    expect(recordVisit(m, 2).mem.lastSection).toBe("case-files");
  });
});

describe("sections", () => {
  it("ignores unknown and duplicate sections", () => {
    const m = markSeen(emptyMemory(), "terminal");
    expect(markSeen(m, "terminal")).toBe(m);
    expect(markSeen(m, "nope")).toBe(m);
  });
  it("furthest follows page order, not visit order", () => {
    expect(furthest(["contact", "terminal"])).toBe("contact");
    expect(furthest([])).toBeNull();
  });
  it("allSectionsSeen needs every one", () => {
    let m = emptyMemory();
    for (const s of SECTION_ORDER.slice(0, -1)) m = markSeen(m, s);
    expect(allSectionsSeen(m)).toBe(false);
    expect(allSectionsSeen(markSeen(m, SECTION_ORDER[SECTION_ORDER.length - 1]))).toBe(true);
  });
});

describe("discoveries", () => {
  it("unlocks once and reports it as new only the first time", () => {
    const a = markFound(emptyMemory(), "konami", 7);
    expect(a.isNew).toBe(true);
    const b = markFound(a.mem, "konami", 99);
    expect(b.isNew).toBe(false); expect(b.mem.found.konami).toBe(7);
  });
  it("rejects ids that are not on the list", () => expect(markFound(emptyMemory(), "hax", 1).isNew).toBe(false));
  it("progress counts and rounds", () => {
    let m = emptyMemory();
    expect(progress(m)).toEqual({ got: 0, total: DISCOVERIES.length, pct: 0 });
    for (const id of DISCOVERY_IDS) m = markFound(m, id, 1).mem;
    expect(progress(m).pct).toBe(100);
  });
});

describe("welcomeLine", () => {
  const base = { visits: 3, prevLast: 0, prevSection: "case-files" as string | null };
  it("says nothing on a first visit or without a previous timestamp", () => {
    expect(welcomeLine({ visits: 1, prevLast: 5, prevSection: null }, 100, "en", label)).toBeNull();
    expect(welcomeLine({ ...base, prevLast: 0 }, 100, "en", label)).toBeNull();
  });
  it("mentions the visit number, the time, and where you got to", () => {
    const now = 10 * D;
    const s = welcomeLine({ ...base, prevLast: now - 2 * D }, now, "en", label)!;
    expect(s).toContain("Visit 3"); expect(s).toContain("2 days ago"); expect(s).toContain("CASE-FILES");
  });
  it("does not claim a section when you only saw the top", () => {
    expect(welcomeLine({ ...base, prevLast: 1, prevSection: "terminal" }, D, "en", label)).not.toContain("as far as");
    expect(welcomeLine({ ...base, prevLast: 1, prevSection: null }, D, "en", label)).not.toContain("as far as");
  });
  it("speaks Spanish too", () => {
    expect(welcomeLine({ ...base, prevLast: 1 }, 3 * H, "es", label)).toContain("Bienvenido de vuelta");
  });
});

describe("ago", () => {
  it("steps through minutes, hours, days", () => {
    expect(ago(30_000, "en")).toBe("a moment ago");
    expect(ago(10 * 60_000, "en")).toBe("10 minutes ago");
    expect(ago(H, "en")).toBe("an hour ago");
    expect(ago(5 * H, "en")).toBe("5 hours ago");
    expect(ago(D, "en")).toBe("yesterday");
    expect(ago(9 * D, "en")).toBe("9 days ago");
    expect(ago(D, "es")).toBe("ayer");
  });
});

describe("night owl", () => {
  it("is midnight to 5am local", () => {
    expect(isNightOwl(new Date(2026, 9, 14, 0, 30))).toBe(true);
    expect(isNightOwl(new Date(2026, 9, 14, 4, 59))).toBe(true);
    expect(isNightOwl(new Date(2026, 9, 14, 5, 0))).toBe(false);
    expect(isNightOwl(new Date(2026, 9, 14, 21, 0))).toBe(false);
  });
});

describe("storage helpers never throw", () => {
  it("load and save survive a broken storage", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    expect(loadMemory(bad)).toEqual(emptyMemory());
    expect(() => saveMemory(bad, emptyMemory())).not.toThrow();
    expect(loadMemory(null)).toEqual(emptyMemory());
  });
  it("saves under the versioned key", () => {
    const store: Record<string, string> = {};
    saveMemory({ setItem: (k, v) => { store[k] = v; } }, { ...emptyMemory(), visits: 2 });
    expect(JSON.parse(store[MEMORY_KEY]).visits).toBe(2);
  });
});
