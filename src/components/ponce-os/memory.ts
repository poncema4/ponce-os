// The site remembers you. Everything here is pure (storage and the clock are passed in) so it can be
// unit-tested, and nothing personal is stored: a visit count, timestamps, which sections you reached,
// and which secrets you found. It never leaves the browser.

export type Lang = "en" | "es";

export interface Discovery { id: string; en: { name: string; hint: string }; es: { name: string; hint: string } }

export const DISCOVERIES: Discovery[] = [
  { id: "explorer", en: { name: "Cartographer", hint: "scroll through every section" }, es: { name: "Cartografo", hint: "recorre todas las secciones" } },
  { id: "regular", en: { name: "Regular", hint: "come back for a second visit" }, es: { name: "Habitual", hint: "vuelve para una segunda visita" } },
  { id: "night-owl", en: { name: "Night owl", hint: "visit between midnight and 5am" }, es: { name: "Buho", hint: "visita entre medianoche y las 5" } },
  { id: "polyglot", en: { name: "Polyglot", hint: "switch the language" }, es: { name: "Poliglota", hint: "cambia el idioma" } },
  { id: "resume", en: { name: "Paper trail", hint: "download the resume" }, es: { name: "Papeles", hint: "descarga el CV" } },
  { id: "keel", en: { name: "Met the first mate", hint: "talk to Keel in the terminal" }, es: { name: "Conoces al primer oficial", hint: "habla con Keel en la terminal" } },
  { id: "scan", en: { name: "Fingerprint", hint: "run a visitor scan (it stays local)" }, es: { name: "Huella", hint: "ejecuta un escaneo de visitante (es local)" } },
  { id: "synth", en: { name: "Soundtrack", hint: "turn the synthwave on" }, es: { name: "Banda sonora", hint: "activa el synthwave" } },
  { id: "matrix", en: { name: "Red pill", hint: "follow the white rabbit" }, es: { name: "Pastilla roja", hint: "sigue al conejo blanco" } },
  { id: "kraken", en: { name: "Respects paid", hint: "summon the kraken" }, es: { name: "Respetos", hint: "invoca al kraken" } },
  { id: "breach", en: { name: "Root", hint: "crack the firewall" }, es: { name: "Root", hint: "rompe el firewall" } },
  { id: "broadside", en: { name: "Broadside", hint: "order the ship to fire its cannons" }, es: { name: "Andanada", hint: "ordena al barco disparar los canones" } },
  { id: "konami", en: { name: "Old school", hint: "an old cheat code, from the 80s" }, es: { name: "Vieja escuela", hint: "un truco clasico de los 80" } },
  { id: "first-catch", en: { name: "First catch", hint: "land a fish in the fishing game" }, es: { name: "Primera pesca", hint: "pesca algo en el juego" } },
  { id: "flag", en: { name: "Deep water", hint: "find the flag in the fishing journal" }, es: { name: "Aguas profundas", hint: "encuentra la bandera en el diario" } },
];

export const DISCOVERY_IDS = DISCOVERIES.map((d) => d.id);

export interface Memory {
  visits: number;
  first: number;                    // epoch ms of the first visit
  last: number;                     // epoch ms of the previous visit (what "last time" means)
  lastSection: string | null;       // furthest section reached on the previous visit
  seen: string[];                   // sections reached, ever
  found: Record<string, number>;    // discovery id -> epoch ms
}

export const MEMORY_KEY = "ponce-os:memory:v1";
export const SECTION_ORDER = ["terminal", "service-log", "case-files", "uplink", "research", "credentials", "contact"];

export const emptyMemory = (): Memory => ({ visits: 0, first: 0, last: 0, lastSection: null, seen: [], found: {} });

/** Defensive parse: a corrupt or hand-edited value must never break the page. */
export function parseMemory(raw: string | null): Memory {
  const base = emptyMemory();
  if (!raw) return base;
  try {
    const o = JSON.parse(raw) as Partial<Memory>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    const found: Record<string, number> = {};
    if (o.found && typeof o.found === "object") for (const [k, v] of Object.entries(o.found)) if (DISCOVERY_IDS.includes(k) && num(v)) found[k] = num(v);
    return {
      visits: Math.floor(num(o.visits)),
      first: num(o.first), last: num(o.last),
      lastSection: typeof o.lastSection === "string" && SECTION_ORDER.includes(o.lastSection) ? o.lastSection : null,
      seen: Array.isArray(o.seen) ? o.seen.filter((s): s is string => typeof s === "string" && SECTION_ORDER.includes(s)) : [],
      found,
    };
  } catch { return base; }
}

export const furthest = (seen: string[]): string | null => {
  let best = -1;
  for (const s of seen) best = Math.max(best, SECTION_ORDER.indexOf(s));
  return best < 0 ? null : SECTION_ORDER[best];
};

/** Count a new visit. `prev` keeps what the PREVIOUS visit looked like so the welcome can refer to it. */
export function recordVisit(mem: Memory, now: number): { mem: Memory; prev: Memory } {
  const prev = mem;
  return { prev, mem: { ...mem, visits: mem.visits + 1, first: mem.first || now, last: now, lastSection: furthest(mem.seen) } };
}

export function markSeen(mem: Memory, section: string): Memory {
  if (!SECTION_ORDER.includes(section) || mem.seen.includes(section)) return mem;
  return { ...mem, seen: [...mem.seen, section] };
}

export function markFound(mem: Memory, id: string, now: number): { mem: Memory; isNew: boolean } {
  if (!DISCOVERY_IDS.includes(id) || mem.found[id]) return { mem, isNew: false };
  return { mem: { ...mem, found: { ...mem.found, [id]: now } }, isNew: true };
}

export const progress = (mem: Memory) => {
  const got = DISCOVERY_IDS.filter((id) => mem.found[id]).length;
  return { got, total: DISCOVERY_IDS.length, pct: Math.round((got / DISCOVERY_IDS.length) * 100) };
};

export const allSectionsSeen = (mem: Memory) => SECTION_ORDER.every((s) => mem.seen.includes(s));

export const isNightOwl = (d: Date) => d.getHours() >= 0 && d.getHours() < 5;

const DAY = 86_400_000;
export function ago(ms: number, lang: Lang): string {
  const mins = Math.floor(ms / 60_000), hrs = Math.floor(ms / 3_600_000), days = Math.floor(ms / DAY);
  if (lang === "es") {
    if (mins < 2) return "hace un momento";
    if (hrs < 1) return `hace ${mins} minutos`;
    if (hrs < 24) return hrs === 1 ? "hace una hora" : `hace ${hrs} horas`;
    return days === 1 ? "ayer" : `hace ${days} dias`;
  }
  if (mins < 2) return "a moment ago";
  if (hrs < 1) return `${mins} minutes ago`;
  if (hrs < 24) return hrs === 1 ? "an hour ago" : `${hrs} hours ago`;
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** The line under the greeting. null on a first visit (nothing to remember yet). */
export function welcomeLine(visit: { visits: number; prevLast: number; prevSection: string | null }, now: number, lang: Lang, label: (id: string) => string): string | null {
  if (visit.visits < 2 || !visit.prevLast) return null;
  const when = ago(Math.max(0, now - visit.prevLast), lang);
  const n = visit.visits;
  const where = visit.prevSection && visit.prevSection !== "terminal" ? label(visit.prevSection) : null;
  if (lang === "es") {
    return `Bienvenido de vuelta. Visita ${n}, la ultima fue ${when}.` + (where ? ` Llegaste hasta "${where}".` : "");
  }
  return `Welcome back. Visit ${n}, last one was ${when}.` + (where ? ` You got as far as "${where}".` : "");
}

export const CANNON_EVENT = "pos:cannon";
/** Fire the ship's cannons (the 3D scene listens; with no WebGL it is just the discovery). */
export function fireCannons() {
  try { window.dispatchEvent(new Event(CANNON_EVENT)); } catch { /* no window */ }
  discover("broadside");
}

export const DISCOVER_EVENT = "pos:discover";
/** Fire-and-forget: any component can announce a discovery without prop drilling. */
export function discover(id: string) {
  try { window.dispatchEvent(new CustomEvent(DISCOVER_EVENT, { detail: id })); } catch { /* no window (tests/SSR) */ }
}

export function loadMemory(storage: Pick<Storage, "getItem"> | null): Memory {
  try { return parseMemory(storage?.getItem(MEMORY_KEY) ?? null); } catch { return emptyMemory(); }
}
export function saveMemory(storage: Pick<Storage, "setItem"> | null, mem: Memory) {
  try { storage?.setItem(MEMORY_KEY, JSON.stringify(mem)); } catch { /* private mode / full: the site just forgets */ }
}
