import { describe, it, expect } from "vitest";
import { EMPTY_STATS, FLAG, FLAG_AT, achievements, journalProgress, loadStats, recordCatch, saveStats, type Stats } from "./fishing-journal";

const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), dump: () => Object.fromEntries(m) };
};
const fresh = (): Stats => ({ ...EMPTY_STATS, species: [] });
const land = (s: Stats, name: string, rarity = "common", streak = 1) => recordCatch(s, { name, rarity }, streak);

describe("recordCatch", () => {
  it("counts every catch and remembers each species once", () => {
    let s = fresh();
    s = land(s, "sardine"); s = land(s, "sardine"); s = land(s, "crab");
    expect(s.catches).toBe(3);
    expect(s.species).toEqual(["sardine", "crab"]);
  });

  it("tracks the best streak, legendaries and phish separately", () => {
    let s = fresh();
    s = land(s, "sardine", "common", 3);
    s = land(s, "SHARK", "legendary", 4);
    s = land(s, "phish", "phish", 0);
    s = land(s, "crab", "common", 1);
    expect(s.bestStreak).toBe(4);
    expect(s.legendary).toBe(1);
    expect(s.phish).toBe(1);
  });

  it("does not mutate the previous stats", () => {
    const a = fresh();
    land(a, "sardine");
    expect(a.catches).toBe(0);
    expect(a.species).toEqual([]);
  });
});

describe("the deep-water flag", () => {
  it(`unlocks at exactly ${FLAG_AT} different species, not before, and then stays`, () => {
    let s = fresh();
    const names = ["a", "b", "c", "d", "e", "f"];
    for (let i = 0; i < FLAG_AT - 1; i++) { s = land(s, names[i]); expect(s.flag).toBe(false); }
    s = land(s, names[FLAG_AT - 1]);
    expect(s.flag).toBe(true);
    s = land(s, "a"); // landing a repeat later cannot take it away
    expect(s.flag).toBe(true);
  });

  it("repeating the same species never unlocks it", () => {
    let s = fresh();
    for (let i = 0; i < 20; i++) s = land(s, "sardine");
    expect(s.flag).toBe(false);
  });

  it("the flag text is the one the site has always advertised", () => expect(FLAG).toBe("ponce{d33p-w4t3r-4ngl3r}"));
});

describe("persistence", () => {
  it("round-trips", () => {
    const store = mem();
    let s = fresh();
    s = land(s, "sardine", "common", 2); s = land(s, "WHALE", "legendary", 3);
    saveStats(s, store);
    expect(loadStats(store)).toEqual(s);
  });

  it("keeps the ORIGINAL species key in step, so older progress and a downgrade still work", () => {
    const store = mem();
    saveStats(land(fresh(), "crab"), store);
    expect(JSON.parse(store.dump()["ponce-os:cast:caught"])).toEqual(["crab"]);
  });

  it("reads progress saved by the old version (species list only)", () => {
    const s = loadStats(mem({ "ponce-os:cast:caught": JSON.stringify(["sardine", "crab", "shrimp"]) }));
    expect(s.species).toEqual(["sardine", "crab", "shrimp"]);
    expect(s.catches).toBe(3);
  });

  it("an old save with 6+ species already counts as having earned the flag", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(loadStats(mem({ "ponce-os:cast:caught": JSON.stringify(six) })).flag).toBe(true);
  });

  it("corrupt or missing storage gives clean empty stats instead of throwing", () => {
    expect(loadStats(mem({ "ponce-os:cast:stats": "{not json" }))).toEqual(EMPTY_STATS);
    expect(loadStats(mem())).toEqual(EMPTY_STATS);
    expect(loadStats({ getItem: () => { throw new Error("blocked"); } })).toEqual(EMPTY_STATS);
  });

  it("a blocked write does not throw", () => {
    expect(() => saveStats(fresh(), { setItem: () => { throw new Error("quota"); } })).not.toThrow();
  });
});

describe("achievements", () => {
  const get = (s: Stats, id: string) => achievements(s, 22).find((a) => a.id === id)!;

  it("starts with nothing earned", () => expect(achievements(fresh(), 22).every((a) => !a.done)).toBe(true));
  it("first catch", () => expect(get(land(fresh(), "sardine"), "first").done).toBe(true));
  it("angler needs 10 catches", () => {
    let s = fresh();
    for (let i = 0; i < 9; i++) s = land(s, "sardine");
    expect(get(s, "angler").done).toBe(false);
    s = land(s, "sardine");
    expect(get(s, "angler").done).toBe(true);
  });
  it("hot streak needs 5 in a row", () => {
    expect(get(land(fresh(), "x", "common", 4), "streak").done).toBe(false);
    expect(get(land(fresh(), "x", "common", 5), "streak").done).toBe(true);
  });
  it("legend hunter and the phish joke", () => {
    expect(get(land(fresh(), "SHARK", "legendary"), "legend").done).toBe(true);
    expect(get(land(fresh(), "phish", "phish"), "phish").done).toBe(true);
  });
  it("collector is half the species, completionist is all of them", () => {
    let s = fresh();
    for (let i = 0; i < 11; i++) s = land(s, `s${i}`);
    expect(get(s, "collector").done).toBe(true);
    expect(get(s, "all").done).toBe(false);
    for (let i = 11; i < 22; i++) s = land(s, `s${i}`);
    expect(get(s, "all").done).toBe(true);
  });
  it("every achievement has a name and a hint", () => {
    for (const a of achievements(fresh(), 22)) { expect(a.name.length).toBeGreaterThan(2); expect(a.hint.length).toBeGreaterThan(2); }
  });
});

describe("journalProgress", () => {
  it("reports found / total and a percentage, capped at the total", () => {
    let s = fresh();
    for (let i = 0; i < 11; i++) s = land(s, `s${i}`);
    expect(journalProgress(s, 22)).toEqual({ got: 11, total: 22, pct: 50 });
    expect(journalProgress({ ...s, species: Array.from({ length: 30 }, (_, i) => `s${i}`) }, 22).got).toBe(22);
  });
});
