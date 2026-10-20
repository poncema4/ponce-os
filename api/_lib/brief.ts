// Cyber Brief core: fixed source list, tolerant RSS/Atom parsing, flags, archive merge, search + paging.
// Pure functions only (no fetch here besides loadSource) so the tests need no network.
// The leading underscore keeps Vercel from deploying this file as its own endpoint.

export type Topic = "cyber" | "ai";

export interface Source {
  id: string;
  name: string;
  topic: Topic;
  url: string;
  kind: "rss" | "kev";
  note?: string; // shown honestly when a feed is unofficial
  keepCategories?: string[]; // keep only items carrying one of these categories (lowercase)
  heavy?: boolean; // 0.8 MB+ download: the Action fetches it, the edge function does not (CPU limit)
}

export type Flag = "model" | "alert";

export interface Item {
  id: string;
  title: string;
  url: string;
  source: string;
  topic: Topic;
  published: number; // epoch ms
  snippet: string;
  tag?: string;
  flag?: Flag; // model = a new AI model/product from a lab, alert = actively exploited / breach
}

// Fixed allowlist: visitors can never choose a URL to fetch.
export const SOURCES: Source[] = [
  { id: "cisa", name: "CISA Advisories", topic: "cyber", kind: "rss", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", heavy: true },
  { id: "kev", name: "CISA KEV", topic: "cyber", kind: "kev", url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", heavy: true },
  { id: "bleeping", name: "BleepingComputer", topic: "cyber", kind: "rss", url: "https://www.bleepingcomputer.com/feed/" },
  { id: "thn", name: "The Hacker News", topic: "cyber", kind: "rss", url: "https://feeds.feedburner.com/TheHackersNews" },
  { id: "krebs", name: "Krebs on Security", topic: "cyber", kind: "rss", url: "https://krebsonsecurity.com/feed/" },
  { id: "darkreading", name: "Dark Reading", topic: "cyber", kind: "rss", url: "https://www.darkreading.com/rss.xml" },
  { id: "schneier", name: "Schneier on Security", topic: "cyber", kind: "rss", url: "https://www.schneier.com/feed/atom/" },
  { id: "sans", name: "SANS ISC", topic: "cyber", kind: "rss", url: "https://isc.sans.edu/rssfeed.xml" },
  {
    id: "openai", name: "OpenAI", topic: "ai", kind: "rss", url: "https://openai.com/news/rss.xml",
    // OpenAI's feed mixes news with dozens of customer case studies; the case studies carry no category.
    keepCategories: ["product", "research", "company", "safety", "publication", "global affairs", "engineering", "security"],
    note: "news only, customer stories left out",
    heavy: true,
  },
  {
    id: "anthropic", name: "Anthropic", topic: "ai", kind: "rss",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
    note: "community-generated feed (Anthropic publishes none)",
  },
  { id: "claude-code", name: "Claude Code releases", topic: "ai", kind: "rss", url: "https://github.com/anthropics/claude-code/releases.atom" },
  { id: "hf", name: "Hugging Face", topic: "ai", kind: "rss", url: "https://huggingface.co/blog/feed.xml" },
  { id: "deepmind", name: "Google DeepMind", topic: "ai", kind: "rss", url: "https://deepmind.google/blog/rss.xml" },
  { id: "techcrunch-ai", name: "TechCrunch AI", topic: "ai", kind: "rss", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { id: "mit-ai", name: "MIT Technology Review", topic: "ai", kind: "rss", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
];

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "...",
};

export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 31 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Text only: unwrap CDATA, drop tags, decode entities twice (feeds often double-escape),
// force plain ASCII punctuation, collapse whitespace.
export function clean(raw: string, max: number): string {
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = decode(decode(s)).replace(/<[^>]*>/g, " ");
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...");
  s = s.replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 3).replace(/\s+\S*$/, "") + "..." : s;
}

function tag(block: string, names: string[]): string {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i"));
    if (m) return m[1];
  }
  return "";
}

function linkOf(block: string): string {
  const atom = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  const alt = block.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i);
  const href = (alt ?? atom)?.[1];
  if (href) return decode(href);
  return clean(tag(block, ["link", "guid"]), 600);
}

export function safeUrl(u: string): string | null {
  try {
    const p = new URL(u.trim());
    return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : null;
  } catch {
    return null;
  }
}

// Short stable id from the link (FNV-1a, 32 bit, base36). Same link => same id, so merges dedupe.
export function itemId(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const LABS = new Set(["Anthropic", "OpenAI", "Google DeepMind"]);
const MODEL_NAME = /\b(claude|opus|sonnet|haiku|gpt-?\d|gemini|llama|mistral|deepseek|qwen|grok)\b/i;
const MODEL_FIRST = /^(claude[- ](opus|sonnet|haiku|fable|\d)|(gpt-?|gemini |llama |mistral |deepseek-?|qwen|grok )\d)/i;
const LAUNCH_FIRST = /^(introducing|announcing|meet|say hello to)\b/i;
const RECAP = /\b(weekly recap|week in review|newsletter|podcast)\b/i; // roundups mention every scary word; they are not the alert
const ALERT = /zero[- ]day|actively exploited|exploited in the wild|data breach|ransomware attack|supply[- ]chain attack/i;

// What deserves a badge. A new model from a lab (not point releases of a CLI), or a security
// story about active exploitation or a breach.
export function flagOf(i: Pick<Item, "title" | "source" | "topic" | "tag">): Flag | undefined {
  // A lab announcing a model: the title opens with "Introducing ..." naming a model, or opens with
  // the model name itself. "Cuts costs with GPT-6" case studies and "Better caching for GPT-6" do not.
  const t = i.title.trim();
  const launch = (LAUNCH_FIRST.test(t) && MODEL_NAME.test(t)) || MODEL_FIRST.test(t);
  if (i.topic === "ai" && LABS.has(i.source) && launch) return "model";
  if (i.topic === "cyber" && !RECAP.test(i.title) && (i.tag === "ransomware" || ALERT.test(i.title))) return "alert";
  return undefined;
}

// Feed items that are listings or business filler, not security/AI news (ICS advisory bundles,
// a daily podcast stub, startup funding rounds).
export function isNoise(title: string): boolean {
  return (
    /stormcast|industrial control systems? advisor|\bICS advisor/i.test(title) ||
    /^CISA adds .*known exploited vulnerabilit/i.test(title) || // bulletin; the KEV source lists each CVE by name
    /\b(raises?|raised|snags|secures|lands|bags)\b[^.]*\$\d|\bvaluation\b|\bseries [a-e]\b/i.test(title) // funding rounds are not the news you asked for
  );
}

function finish(i: Omit<Item, "id" | "flag">): Item {
  const full = { ...i, id: itemId(i.url) } as Item;
  const flag = flagOf(full);
  return flag ? { ...full, flag } : full;
}

// Tolerant on purpose: one malformed entry is skipped, never fatal.
export function parseFeed(xml: string, src: Pick<Source, "name" | "topic" | "keepCategories">): Item[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const out: Item[] = [];
  for (const b of blocks) {
    const title = clean(tag(b, ["title"]), 200);
    const url = safeUrl(linkOf(b));
    const when = Date.parse(clean(tag(b, ["pubDate", "published", "updated", "dc:date"]), 60));
    if (!title || !url || !Number.isFinite(when)) continue;
    if (isNoise(title)) continue;
    if (src.keepCategories) {
      const cats = [...b.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => clean(m[1], 40).toLowerCase());
      if (!cats.some((c) => src.keepCategories!.includes(c))) continue;
    }
    const body = tag(b, ["description", "summary", "content:encoded", "content"]);
    out.push(finish({ title, url, source: src.name, topic: src.topic, published: when, snippet: clean(body, 200) }));
  }
  return out;
}

interface KevRow { cveID?: string; vendorProject?: string; product?: string; vulnerabilityName?: string; dateAdded?: string; shortDescription?: string; knownRansomwareCampaignUse?: string }

export function parseKev(json: string, limit = 6): Item[] {
  let rows: KevRow[] = [];
  try {
    const v = JSON.parse(json) as { vulnerabilities?: KevRow[] };
    rows = Array.isArray(v.vulnerabilities) ? v.vulnerabilities : [];
  } catch {
    return [];
  }
  return rows
    .filter((r) => r.cveID && r.dateAdded && Number.isFinite(Date.parse(r.dateAdded)))
    .sort((a, b) => Date.parse(b.dateAdded!) - Date.parse(a.dateAdded!))
    .slice(0, limit)
    .map((r) => finish({
      title: clean(`${r.cveID}: ${r.vendorProject ?? ""} ${r.product ?? ""} - ${r.vulnerabilityName ?? ""}`, 200),
      url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(r.cveID!)}`,
      source: "CISA KEV",
      topic: "cyber" as const,
      published: Date.parse(r.dateAdded!),
      snippet: clean(r.shortDescription ?? "", 200),
      tag: r.knownRansomwareCampaignUse === "Known" ? "ransomware" : "exploited",
    }));
}

export interface SourceStatus { id: string; name: string; ok: boolean; count: number; note?: string }

export async function loadSource(src: Source, timeoutMs = 8000): Promise<{ items: Item[]; status: SourceStatus }> {
  const base = { id: src.id, name: src.name, note: src.note };
  try {
    const res = await fetch(src.url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "ponce-os-cyber-brief/1.0 (+https://poncema4.vercel.app)", accept: "application/xml,application/json,text/xml,*/*" },
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const text = await res.text();
    const items = src.kind === "kev" ? parseKev(text) : parseFeed(text, src);
    return { items, status: { ...base, ok: items.length > 0, count: items.length } };
  } catch {
    return { items: [], status: { ...base, ok: false, count: 0 } };
  }
}

export interface Archive { version: 1; updated: number; items: Item[] }

export const KEEP_DAYS = 365;
// True when the merged stories differ from what is already stored. The workflow only writes (and so
// only commits) when this is true; otherwise it would commit a new timestamp every 30 minutes.
export function archiveChanged(before: Item[], after: Item[]): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export const PER_PAGE = 20;
export const MAX_PAGES = 100; // anything past 2,000 stories is stale; the archive never holds more
export const ARCHIVE_CAP = PER_PAGE * MAX_PAGES;
export const INGEST_DAYS = 30; // a feed's own back catalogue (OpenAI lists 1300 posts) is not news

// `light: true` skips the heavy sources (the edge function's CPU budget is small); the Action, which
// runs in full Node, fetches everything and keeps their stories in the archive.
export async function collectLive(now = Date.now(), load = loadSource, light = false) {
  const results = await Promise.all(SOURCES.filter((s) => !(light && s.heavy)).map((s) => load(s)));
  const since = now - INGEST_DAYS * 86_400_000;
  const items = results.flatMap((r) => r.items).filter((i) => i.published >= since && i.published <= now + 3_600_000);
  return { items, sources: results.map((r) => r.status) };
}

function reflag(i: Item): Item {
  const { flag: _old, ...rest } = i;
  const flag = flagOf(i);
  return flag ? { ...rest, flag } : rest;
}

// Newest first, one row per link (fresh data wins), old rows aged out, size capped.
export function mergeArchive(archive: Item[], fresh: Item[], now: number): Item[] {
  const byUrl = new Map<string, Item>();
  for (const i of archive) if (i && typeof i.url === "string") byUrl.set(i.url, i);
  for (const i of fresh) byUrl.set(i.url, i);
  const oldest = now - KEEP_DAYS * 86_400_000;
  return [...byUrl.values()]
    .filter((i) => i.published >= oldest && !isNoise(i.title))
    .map(reflag) // flags follow today's rules, not the rules in force when the story was archived
    .sort((a, b) => b.published - a.published)
    .slice(0, ARCHIVE_CAP);
}

export type TopicFilter = Topic | "all";

export function queryItems(items: Item[], o: { topic?: string; q?: string; page?: number; perPage?: number }) {
  const perPage = o.perPage ?? PER_PAGE;
  const topic: TopicFilter = o.topic === "cyber" || o.topic === "ai" ? o.topic : "all";
  const words = (o.q ?? "").toLowerCase().replace(/[^\x20-\x7e]/g, " ").split(/\s+/).filter(Boolean).slice(0, 6);
  const hit = items.filter((i) => {
    if (topic !== "all" && i.topic !== topic) return false;
    const hay = `${i.title} ${i.snippet} ${i.source}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(hit.length / perPage)));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(o.page)) || 1));
  return { total: Math.min(hit.length, pages * perPage), page, pages, perPage, items: hit.slice((page - 1) * perPage, page * perPage) };
}

// The few stories worth interrupting for: flagged (new model / alert) and recent. Newest first, at
// most `max`, at most two from one source so a launch covered by five posts does not fill the strip.
export function highlights(items: Item[], now: number, max = 5, hours = 72): Item[] {
  const since = now - hours * 3_600_000;
  const used: Record<string, number> = {};
  const out: Item[] = [];
  for (const i of [...items].sort((a, b) => b.published - a.published)) {
    if (!i.flag || i.published < since || i.published > now + 3_600_000) continue;
    if ((used[i.source] ?? 0) >= 2) continue;
    used[i.source] = (used[i.source] ?? 0) + 1;
    out.push(i);
    if (out.length >= max) break;
  }
  return out;
}

export function isArchive(v: unknown): v is Archive {
  const a = v as Archive | null;
  return !!a && a.version === 1 && typeof a.updated === "number" && Array.isArray(a.items);
}
