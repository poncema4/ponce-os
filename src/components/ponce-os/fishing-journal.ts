// The cast minigame's memory: what you have caught, your records, and the achievements built from them.
// Pure functions over a small stats object (no React, no DOM except the storage you pass in), so the
// rules (what counts as an achievement, when the flag unlocks) can be unit tested.

export const FLAG = "ponce{d33p-w4t3r-4ngl3r}";
export const FLAG_AT = 6; // distinct species needed to earn it

export type Stats = {
  catches: number;       // fish landed (the phish counts: you did land it)
  species: string[];     // distinct species names, in the order first caught
  bestStreak: number;
  legendary: number;
  phish: number;         // times you struck at the phish
  flag: boolean;         // the flag has been earned (stays earned)
};

export const EMPTY_STATS: Stats = { catches: 0, species: [], bestStreak: 0, legendary: 0, phish: 0, flag: false };

const STATS_KEY = "ponce-os:cast:stats";
const CAUGHT_KEY = "ponce-os:cast:caught"; // the original, species-only key: still read so old progress is kept

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

export function loadStats(storage: Reader = localStorage): Stats {
  try {
    const raw = JSON.parse(storage.getItem(STATS_KEY) || "null");
    const legacy = JSON.parse(storage.getItem(CAUGHT_KEY) || "[]");
    const species = [...new Set<string>([...(Array.isArray(raw?.species) ? raw.species : []), ...(Array.isArray(legacy) ? legacy : [])])];
    const s: Stats = {
      catches: Math.max(0, Number(raw?.catches) || 0),
      species,
      bestStreak: Math.max(0, Number(raw?.bestStreak) || 0),
      legendary: Math.max(0, Number(raw?.legendary) || 0),
      phish: Math.max(0, Number(raw?.phish) || 0),
      flag: Boolean(raw?.flag) || species.length >= FLAG_AT,
    };
    s.catches = Math.max(s.catches, s.species.length);
    return s;
  } catch {
    return { ...EMPTY_STATS, species: [] };
  }
}

export function saveStats(s: Stats, storage: Writer = localStorage) {
  try {
    storage.setItem(STATS_KEY, JSON.stringify(s));
    storage.setItem(CAUGHT_KEY, JSON.stringify(s.species)); // keep the original key in step
  } catch { /* storage blocked (private mode): the game still plays, progress just will not persist */ }
}

/** Fold one landed catch into the stats. `streakAfter` is the player's current run, phish excluded. */
export function recordCatch(s: Stats, c: { name: string; rarity: string }, streakAfter: number): Stats {
  const species = s.species.includes(c.name) ? s.species : [...s.species, c.name];
  return {
    catches: s.catches + 1,
    species,
    bestStreak: Math.max(s.bestStreak, streakAfter),
    legendary: s.legendary + (c.rarity === "legendary" ? 1 : 0),
    phish: s.phish + (c.rarity === "phish" ? 1 : 0),
    flag: s.flag || species.length >= FLAG_AT,
  };
}

export type Achievement = { id: string; name: string; hint: string; done: boolean };

export function achievements(s: Stats, totalSpecies: number): Achievement[] {
  const half = Math.ceil(totalSpecies / 2);
  return [
    { id: "first", name: "First catch", hint: "land any fish", done: s.catches >= 1 },
    { id: "angler", name: "Angler", hint: "land 10 fish", done: s.catches >= 10 },
    { id: "regular", name: "Regular on deck", hint: "land 50 fish", done: s.catches >= 50 },
    { id: "streak", name: "Hot streak", hint: "land 5 in a row without a miss", done: s.bestStreak >= 5 },
    { id: "legend", name: "Legend hunter", hint: "land a legendary", done: s.legendary >= 1 },
    { id: "phish", name: "Do not click it", hint: "strike at the phish. we have all done it", done: s.phish >= 1 },
    { id: "collector", name: "Collector", hint: `log ${half} different species`, done: s.species.length >= half },
    { id: "flag", name: "Deep-water flag", hint: `log ${FLAG_AT} different species`, done: s.flag },
    { id: "all", name: "Completionist", hint: `log all ${totalSpecies} species`, done: s.species.length >= totalSpecies },
  ];
}

/** "7 / 23" style summary used by the journal header. */
export function journalProgress(s: Stats, totalSpecies: number) {
  const got = Math.min(s.species.length, totalSpecies);
  return { got, total: totalSpecies, pct: totalSpecies ? Math.round((got / totalSpecies) * 100) : 0 };
}
