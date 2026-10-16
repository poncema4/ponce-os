// The Ctrl+K palette's brain: ranking, accent-folding, keyboard maths, and the curated list.
import { describe, it, expect } from "vitest";
import { norm, score, filterItems, moveIndex, isPaletteHotkey, hotkeyLabel, buildItems, paletteCopy, SECTION_IDS, type PaletteItem } from "./palette-model";

const nav = { terminal: "terminal", "service-log": "experience", "case-files": "work", uplink: "activity", research: "research", credentials: "skills", contact: "contact" };
const items = buildItems("en", nav);
const ids = (q: string) => filterItems(items, q).map((i) => i.id);

describe("norm", () => {
  it("lowercases, trims and folds accents", () => {
    expect(norm("  MenÚ ")).toBe("menu");
    expect(norm("Diário del capitán")).toBe("diario del capitan");
  });
});

describe("filterItems", () => {
  it("an empty or blank query returns the whole curated list unchanged", () => {
    expect(filterItems(items, "")).toBe(items);
    expect(filterItems(items, "   ")).toBe(items);
  });
  it("ranks a label prefix above a word prefix above a substring", () => {
    const fake: PaletteItem[] = [
      { id: "c", label: "Xresume", group: "do" },          // substring only
      { id: "b", label: "Download resume", group: "do" },  // word prefix
      { id: "a", label: "Resume builder", group: "do" },   // label prefix
    ];
    expect(filterItems(fake, "resume").map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("finds things by their keywords, not just their label", () => {
    expect(ids("calendly")).toContain("chat");
    expect(ids("cv")).toContain("resume");
    expect(ids("broadside")).toContain("fire");
  });
  it("matches multi-word queries across label and keywords", () => {
    expect(ids("download pdf")).toContain("resume");
  });
  it("a query that matches nothing returns an empty list", () => {
    expect(ids("zzzzqqqq")).toEqual([]);
  });
  it("ties keep the curated order (stable)", () => {
    const fake: PaletteItem[] = [{ id: "1", label: "open one", group: "open" }, { id: "2", label: "open two", group: "open" }, { id: "3", label: "open three", group: "open" }];
    expect(filterItems(fake, "open").map((i) => i.id)).toEqual(["1", "2", "3"]);
  });
  it("is accent-insensitive in both directions (Spanish labels)", () => {
    const es = buildItems("es", nav);
    expect(filterItems(es, "capitan").map((i) => i.id)).toContain("log");
    expect(filterItems(es, "CAPITÁN").map((i) => i.id)).toContain("log");
  });
  it("does not mutate the list it was given", () => {
    const copy = items.map((i) => i.id);
    filterItems(items, "g");
    expect(items.map((i) => i.id)).toEqual(copy);
  });
});

describe("score", () => {
  it("0 means no match, anything positive means a match", () => {
    expect(score(items[0], "qqqq")).toBe(0);
    expect(score(items[0], "term")).toBeGreaterThan(0);
  });
});

describe("moveIndex", () => {
  it("moves and wraps at both ends", () => {
    expect(moveIndex(0, 5, 1)).toBe(1);
    expect(moveIndex(4, 5, 1)).toBe(0);
    expect(moveIndex(0, 5, -1)).toBe(4);
  });
  it("is safe on an empty list", () => {
    expect(moveIndex(0, 0, 1)).toBe(0);
    expect(moveIndex(3, 0, -1)).toBe(0);
  });
});

describe("hotkey", () => {
  const ev = (o: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }>) => ({ key: "k", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
  it("Ctrl+K and Cmd+K open it, either case", () => {
    expect(isPaletteHotkey(ev({ ctrlKey: true }))).toBe(true);
    expect(isPaletteHotkey(ev({ metaKey: true }))).toBe(true);
    expect(isPaletteHotkey(ev({ ctrlKey: true, key: "K" }))).toBe(true);
  });
  it("plain k, other keys and modified chords do not (so typing 'k' never opens it)", () => {
    expect(isPaletteHotkey(ev({}))).toBe(false);
    expect(isPaletteHotkey(ev({ ctrlKey: true, key: "j" }))).toBe(false);
    expect(isPaletteHotkey(ev({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteHotkey(ev({ ctrlKey: true, altKey: true }))).toBe(false);
  });
  it("shows the right hint per platform", () => {
    expect(hotkeyLabel("MacIntel")).toBe("⌘K");
    expect(hotkeyLabel("iPhone")).toBe("⌘K");
    expect(hotkeyLabel("Linux x86_64")).toBe("Ctrl K");
    expect(hotkeyLabel("Win32")).toBe("Ctrl K");
  });
});

describe("the curated list", () => {
  it("has every section, once, using the site's own nav labels", () => {
    const go = items.filter((i) => i.group === "go");
    expect(go.map((i) => i.id)).toEqual(SECTION_IDS.map((s) => `go:${s}`));
    expect(go.find((i) => i.id === "go:service-log")!.label).toBe("experience");
  });
  it("ids are unique and every label is non-empty in BOTH languages", () => {
    for (const lang of ["en", "es"] as const) {
      const list = buildItems(lang, nav);
      expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
      for (const i of list) expect(i.label.trim().length).toBeGreaterThan(0);
    }
  });
  it("English and Spanish expose exactly the same actions and copy keys", () => {
    expect(buildItems("en", nav).map((i) => i.id)).toEqual(buildItems("es", nav).map((i) => i.id));
    expect(Object.keys(paletteCopy("en")).sort()).toEqual(Object.keys(paletteCopy("es")).sort());
  });
  it("every group has a heading in the copy", () => {
    for (const i of items) expect(paletteCopy("en")[i.group].length).toBeGreaterThan(0);
  });
});
