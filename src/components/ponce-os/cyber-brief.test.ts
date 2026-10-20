import { afterEach, describe, expect, it, vi } from "vitest";
import { ARCHIVE_CAP, archiveChanged, highlights, INGEST_DAYS, KEEP_DAYS, MAX_PAGES, SOURCES, clean, collectLive, flagOf, isNoise, itemId, mergeArchive, parseFeed, parseKev, queryItems, safeUrl, type Item } from "../../../api/_lib/brief";
import handler from "../../../api/cyber-brief";
import { CB, ageLabel, agoLabel, hostOf, isBriefPage, isSafeHref, pageList, parseJump, pickBaseline } from "./cyber-brief";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const src = { name: "Test", topic: "cyber" as const };

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Critical <b>RCE</b> in Widget &amp; Co]]></title><link>https://example.com/a</link>
<pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Attackers &amp;amp; friends exploit it.&lt;/p&gt;</description></item>
<item><title>No date here</title><link>https://example.com/b</link></item>
<item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Stormcast For Tuesday</title><link>https://example.com/s</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>v2.1.304</title>
<link rel="alternate" type="text/html" href="https://github.com/o/r/releases/tag/v2.1.304"/>
<updated>2026-10-19T09:00:00Z</updated><content type="html">&lt;h2&gt;What's changed&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Fixed a bug&lt;/li&gt;&lt;/ul&gt;</content></entry></feed>`;

function item(over: Partial<Item>): Item {
  const url = over.url ?? "https://x.test/" + Math.random();
  return { id: itemId(url), title: "t", source: "S", topic: "cyber", published: NOW - 3_600_000, snippet: "", ...over, url };
}

describe("parseFeed", () => {
  const out = parseFeed(RSS, src);
  it("parses a valid RSS item, unwrapping CDATA, tags and double-escaped entities", () => {
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Critical RCE in Widget & Co");
    expect(out[0].snippet).toBe("Attackers & friends exploit it.");
    expect(out[0].published).toBe(Date.parse("2026-10-19T10:00:00Z"));
  });
  it("skips items with no date, a non-http link, or a noise title", () => {
    expect(out.map((i) => i.url)).toEqual(["https://example.com/a"]);
  });
  it("reads Atom entries via the alternate href and updated date", () => {
    const a = parseFeed(ATOM, src);
    expect(a).toHaveLength(1);
    expect(a[0].url).toBe("https://github.com/o/r/releases/tag/v2.1.304");
    expect(a[0].snippet).toContain("Fixed a bug");
  });
  it("never throws on garbage and returns nothing", () => {
    for (const bad of ["", "not xml", "<item><title>", "<rss><item></item></rss>", "\u0000\u0001<entry>"]) {
      expect(parseFeed(bad, src)).toEqual([]);
    }
  });
});

describe("clean / safeUrl", () => {
  it("strips tags, forces ASCII, and truncates on a word boundary", () => {
    expect(clean("<script>x</script>It’s “good” — ok \u{1F600}", 100)).toBe("x It's \"good\" - ok");
    const long = clean("word ".repeat(100), 30);
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long.endsWith("...")).toBe(true);
  });
  it("only allows http and https", () => {
    expect(safeUrl("https://a.test/x")).toBeTruthy();
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("nonsense")).toBeNull();
  });
});

describe("parseKev", () => {
  const json = JSON.stringify({ vulnerabilities: [
    { cveID: "CVE-2026-0001", vendorProject: "A", product: "P", vulnerabilityName: "Old", dateAdded: "2026-10-01", shortDescription: "old" },
    { cveID: "CVE-2026-0002", vendorProject: "B", product: "Q", vulnerabilityName: "New", dateAdded: "2026-10-16", shortDescription: "new", knownRansomwareCampaignUse: "Known" },
    { cveID: "CVE-2026-0003", dateAdded: "garbage" },
    { vendorProject: "no cve" },
  ] });
  it("returns newest first, drops bad rows, tags ransomware, links to NVD", () => {
    const k = parseKev(json, 5);
    expect(k.map((i) => i.title.slice(0, 13))).toEqual(["CVE-2026-0002", "CVE-2026-0001"]);
    expect(k[0].tag).toBe("ransomware");
    expect(k[1].tag).toBe("exploited");
    expect(k[0].url).toBe("https://nvd.nist.gov/vuln/detail/CVE-2026-0002");
  });
  it("respects the limit and survives bad JSON", () => {
    expect(parseKev(json, 1)).toHaveLength(1);
    expect(parseKev("{{{")).toEqual([]);
    expect(parseKev('{"vulnerabilities":"x"}')).toEqual([]);
  });
});

describe("ids, flags, noise", () => {
  it("gives the same id for the same link and different ids for different links", () => {
    expect(itemId("https://a.test/x")).toBe(itemId("https://a.test/x"));
    expect(itemId("https://a.test/x")).not.toBe(itemId("https://a.test/y"));
  });
  it("flags a new model from a lab, but not CLI point releases or other sources", () => {
    expect(flagOf({ title: "Introducing Claude Opus 5.5", source: "Anthropic", topic: "ai" })).toBe("model");
    expect(flagOf({ title: "GPT-6 and Intelligent UI for everyone", source: "OpenAI", topic: "ai" })).toBe("model");
    expect(flagOf({ title: "Introducing GPT-6.1 Sol", source: "OpenAI", topic: "ai" })).toBe("model");
    expect(flagOf({ title: "Asana cuts model costs 76x in browser tests with GPT-6.1 Sol", source: "OpenAI", topic: "ai" })).toBeUndefined();
    expect(flagOf({ title: "Claude discovers a novel enzyme system", source: "Anthropic", topic: "ai" })).toBeUndefined();
    expect(flagOf({ title: "Claude Sonnet 5.5 is here", source: "Anthropic", topic: "ai" })).toBe("model");
    expect(flagOf({ title: "Better prompt caching for GPT-6", source: "OpenAI", topic: "ai" })).toBeUndefined();
    expect(flagOf({ title: "Gemini 4 Argon: Built to solve your hardest problems", source: "Google DeepMind", topic: "ai" })).toBe("model");
    expect(flagOf({ title: "v2.1.304", source: "Claude Code releases", topic: "ai" })).toBeUndefined();
    expect(flagOf({ title: "Introducing Claude Opus 5.5", source: "Some Blog", topic: "ai" })).toBeUndefined();
    expect(flagOf({ title: "Anthropic opens Singapore office", source: "Anthropic", topic: "ai" })).toBeUndefined();
  });
  it("flags a Hugging Face 'Welcome <open model>' post, not other Welcome posts or other sources", () => {
    const hf = (title: string, source = "Hugging Face") => flagOf({ title, source, topic: "ai" });
    expect(hf("Welcome Beam: a 501B open model you can own, customize, and scale")).toBe("model");
    expect(hf("Welcome Muse Spark Open: open-weight frontier multimodal mixture-of-experts model from Meta")).toBe("model");
    expect(hf("Welcome RL Environments to the hub")).toBeUndefined();
    expect(hf("Scaling Indic Pretraining: 2.8 Trillion Tokens and an Open Data Generation Pipeline")).toBeUndefined();
    expect(hf("Welcome Beam: a 501B open model", "Some Blog")).toBeUndefined();
  });
  it("flags active exploitation and breaches as alerts, and ransomware-tagged KEV rows", () => {
    expect(flagOf({ title: "Zero-day actively exploited in Widget", source: "X", topic: "cyber" })).toBe("alert");
    expect(flagOf({ title: "Weekly Recap: 98 Zero-Days, Rogue AI Agents and a Data Breach", source: "The Hacker News", topic: "cyber" })).toBeUndefined();
    expect(flagOf({ title: "Patch Tuesday recap", source: "X", topic: "cyber" })).toBeUndefined();
    expect(flagOf({ title: "CVE-1: thing", source: "CISA KEV", topic: "cyber", tag: "ransomware" })).toBe("alert");
  });
  it("catches real exploitation and breach headlines, not the people and courts around them", () => {
    const cyber = (title: string) => flagOf({ title, source: "The Hacker News", topic: "cyber" });
    // headlines that matter, taken from the live feed
    expect(cyber("Qilin and INC Ransomware Groups Exploit Palo Alto Networks Flaw to Bypass MFA")).toBe("alert");
    expect(cyber("Critical FortiSIEM Flaw Gets Public Exploit PoC for Unauthenticated Remote Code Execution")).toBe("alert");
    expect(cyber("Russian APT28 Breaches NATO Naval Shipbuilder in NATO Country, Deploys New Reflective Loader")).toBe("alert");
    expect(cyber("OpenCode Console Breach May Have Exposed OpenAI, Anthropic, and Google API Keys")).toBe("alert");
    expect(cyber("Cisco Warns of Active Attacks Exploiting New Critical Secure Email Gateway Vulnerability")).toBe("alert");
    expect(cyber("Hackers Exploit Plex2Shell Flaws to Install Crypto Miners and Linux Proxy Backdoor")).toBe("alert");
    expect(cyber("Drupal patches critical RCE flaws, warns exploits may emerge soon")).toBe("alert");
    // stories about people, courts and research, and AI items, are not alerts
    expect(cyber("When Your Ransomware Negotiator Works for the Other Side")).toBeUndefined();
    expect(cyber("FBI Arrests Executive at Ransomware Negotiation Firm")).toBeUndefined();
    expect(cyber("When AI Agents Commit Breaches, Humans May Not Be Held Liable")).toBeUndefined();
    expect(cyber("Researchers Demonstrate OpenBSD Root Exploit Chaining 37-Year-Old Shared-Memory Bug")).toBeUndefined();
    expect(cyber("How to build a security awareness program")).toBeUndefined();
    expect(flagOf({ title: "Qilin Ransomware Groups Exploit Palo Alto Flaw", source: "TechCrunch AI", topic: "ai" })).toBeUndefined();
  });
  it("treats ICS advisory bundles and Stormcast as noise, nothing else", () => {
    expect(isNoise("CISA Releases Nine Industrial Control Systems Advisories")).toBe(true);
    expect(isNoise("ISC Stormcast For Tuesday")).toBe(true);
    expect(isNoise("CISA Adds Two Known Exploited Vulnerabilities to Catalog")).toBe(true);
    expect(isNoise("CISA warns of actively exploited Cisco flaw")).toBe(false);
    expect(isNoise("Tolan snags $30M for its AI companion")).toBe(true);
    expect(isNoise("Tenstorrent hits $6.2B valuation to scale open-weight AI chips")).toBe(true);
    expect(isNoise("Startup raises $12 million Series A")).toBe(true);
    expect(isNoise("Critical RCE in Widget")).toBe(false);
    expect(isNoise("Anthropic says it's committing 5% of its shares to a public benefit fund")).toBe(false);
    expect(isNoise("Hackers steal $100M in crypto theft")).toBe(false);
  });
  it("stamps flag and id onto parsed items", () => {
    const x = parseFeed(`<rss><item><title>Introducing Claude Opus 5.5</title><link>https://anthropic.com/n</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate></item></rss>`, { name: "Anthropic", topic: "ai" });
    expect(x[0].flag).toBe("model");
    expect(x[0].id).toBe(itemId("https://anthropic.com/n"));
  });
});

describe("category filter", () => {
  const xml = `<rss><channel>
<item><title>GPT-6 launch</title><link>https://o.test/1</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><category><![CDATA[Product]]></category></item>
<item><title>Acme cuts costs with GPT-6</title><link>https://o.test/2</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Startup story</title><link>https://o.test/3</link><pubDate>Mon, 19 Oct 2026 10:00:00 GMT</pubDate><category>Startup</category></item>
</channel></rss>`;
  it("keeps only categorised news when a source asks for it, and everything otherwise", () => {
    const only = parseFeed(xml, { name: "OpenAI", topic: "ai", keepCategories: ["product"] });
    expect(only.map((i) => i.url)).toEqual(["https://o.test/1"]);
    expect(parseFeed(xml, { name: "Other", topic: "ai" })).toHaveLength(3);
  });
  it("OpenAI is configured to drop uncategorised customer stories", () => {
    expect(SOURCES.find((s) => s.id === "openai")?.keepCategories).toContain("product");
  });
});

describe("mergeArchive", () => {
  const day = 86_400_000;
  it("dedupes by link with fresh data winning, sorts newest first", () => {
    const old = item({ url: "https://x.test/1", title: "old title", published: NOW - 2 * day });
    const fresh = item({ url: "https://x.test/1", title: "fresh title", published: NOW - 2 * day });
    const other = item({ url: "https://x.test/2", published: NOW - day });
    const m = mergeArchive([old], [fresh, other], NOW);
    expect(m.map((i) => i.title)).toEqual(["t", "fresh title"]);
  });
  it("ages out rows past the retention window and drops noise and junk rows", () => {
    const keep = item({ published: NOW - (KEEP_DAYS - 1) * day });
    const gone = item({ published: NOW - (KEEP_DAYS + 1) * day });
    const noise = item({ title: "ISC Stormcast For Monday" });
    const m = mergeArchive([keep, gone, noise, null as unknown as Item, { url: 5 } as unknown as Item], [], NOW);
    expect(m).toEqual([keep]);
  });
  it("recomputes flags from today's rules (adds a missing one, removes a stale one)", () => {
    const stale = item({ url: "https://x.test/s", title: "Weekly Recap: Zero-Days", topic: "cyber", flag: "alert" });
    const missing = item({ url: "https://x.test/m", title: "Introducing Claude Opus 9", source: "Anthropic", topic: "ai" });
    const m = mergeArchive([stale, missing], [], NOW);
    expect(m.find((i) => i.url === stale.url)?.flag).toBeUndefined();
    expect(m.find((i) => i.url === missing.url)?.flag).toBe("model");
  });
  it("caps the archive at 100 pages of 20, keeping the newest", () => {
    const many = Array.from({ length: 2100 }, (_, n) => item({ url: `https://x.test/${n}`, published: NOW - n * 1000 }));
    const m = mergeArchive(many, [], NOW);
    expect(ARCHIVE_CAP).toBe(2000);
    expect(m).toHaveLength(2000);
    expect(m[0].url).toBe("https://x.test/0");
    expect(m[1999].url).toBe("https://x.test/1999");
  });
});

describe("archiveChanged", () => {
  it("is false for identical stories (so the workflow does not commit) and true for any difference", () => {
    const a = item({ url: "https://x.test/1" });
    expect(archiveChanged([a], [{ ...a }])).toBe(false);
    expect(archiveChanged([], [])).toBe(false);
    expect(archiveChanged([a], [])).toBe(true);
    expect(archiveChanged([a], [{ ...a, title: "edited" }])).toBe(true);
    expect(archiveChanged([a], [a, item({ url: "https://x.test/2" })])).toBe(true);
  });
});

describe("highlights", () => {
  const H = 3_600_000;
  it("keeps only flagged stories from the last 72 hours, newest first", () => {
    const items = [
      item({ url: "https://x.test/a", title: "old launch", flag: "model", published: NOW - 80 * H }),
      item({ url: "https://x.test/b", title: "no flag", published: NOW - 1 * H }),
      item({ url: "https://x.test/c", title: "recent alert", flag: "alert", published: NOW - 10 * H }),
      item({ url: "https://x.test/d", title: "newest launch", flag: "model", published: NOW - 2 * H, source: "OpenAI" }),
      item({ url: "https://x.test/e", title: "from the future", flag: "alert", published: NOW + 9 * H }),
    ];
    expect(highlights(items, NOW).map((i) => i.title)).toEqual(["newest launch", "recent alert"]);
  });
  it("shows at most 5, and at most 2 from one source", () => {
    const many = Array.from({ length: 9 }, (_, n) => item({ url: `https://x.test/${n}`, flag: "model", source: n < 6 ? "Gemini Fan" : `Src${n}`, published: NOW - n * H }));
    const h = highlights(many, NOW);
    expect(h).toHaveLength(5);
    expect(h.filter((i) => i.source === "Gemini Fan")).toHaveLength(2);
    expect(highlights([], NOW)).toEqual([]);
  });
  it("the endpoint sends them on the plain first page only", async () => {
    const flagged = Array.from({ length: 25 }, (_, n) => item({ url: `https://arch.test/h${n}`, title: n === 0 ? "Introducing GPT-9 Story" : `Story ${n}`, source: "OpenAI", topic: "ai", published: Date.now() - (n + 1) * 3_600_000 }));
    vi.stubGlobal("fetch", async (u: string) =>
      String(u).includes("news-data") ? new Response(JSON.stringify({ version: 1, updated: Date.now(), items: flagged })) : new Response("down", { status: 500 }));
    const get = async (qs: string) => (await handler(new Request(`https://x.test/api/cyber-brief${qs}`))).json();
    expect((await get("")).highlights).toHaveLength(1);
    expect((await get("?page=2")).highlights).toEqual([]);
    expect((await get("?q=story")).highlights).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe("queryItems", () => {
  const items = Array.from({ length: 45 }, (_, n) =>
    item({ url: `https://x.test/${n}`, title: n % 3 === 0 ? `Claude story ${n}` : `Breach story ${n}`, topic: n % 3 === 0 ? "ai" : "cyber", published: NOW - n * 1000 }));
  it("pages at 20 and reports totals", () => {
    const p1 = queryItems(items, { page: 1 });
    expect(p1.items).toHaveLength(20);
    expect(p1.pages).toBe(3);
    expect(p1.total).toBe(45);
    expect(queryItems(items, { page: 3 }).items).toHaveLength(5);
  });
  it("never reports more than 100 pages, even if handed more stories", () => {
    const huge = Array.from({ length: 2500 }, (_, n) => item({ url: `https://x.test/${n}`, published: NOW - n * 1000 }));
    const r = queryItems(huge, { page: 500 });
    expect(MAX_PAGES).toBe(100);
    expect(r.pages).toBe(100);
    expect(r.page).toBe(100);
    expect(r.total).toBe(2000);
    expect(r.items).toHaveLength(20);
  });
  it("clamps bad page numbers instead of failing", () => {
    expect(queryItems(items, { page: 99 }).page).toBe(3);
    expect(queryItems(items, { page: -4 }).page).toBe(1);
    expect(queryItems(items, { page: NaN }).page).toBe(1);
    expect(queryItems([], {}).pages).toBe(1);
  });
  it("filters by topic and searches every word, case-insensitively", () => {
    expect(queryItems(items, { topic: "ai" }).total).toBe(15);
    expect(queryItems(items, { topic: "bogus" }).total).toBe(45);
    expect(queryItems(items, { q: "CLAUDE" }).total).toBe(15);
    expect(queryItems(items, { q: "claude story 39" }).total).toBe(1);
    expect(queryItems(items, { q: "claude breach" }).total).toBe(0);
    expect(queryItems(items, { q: "   " }).total).toBe(45);
  });
});

describe("collectLive", () => {
  it("keeps going when a source fails, and ignores the feeds' old back catalogue and future dates", async () => {
    const load = async (s: (typeof SOURCES)[number]) =>
      s.id === "krebs"
        ? { items: [], status: { id: s.id, name: s.name, ok: false, count: 0 } }
        : { items: [
            item({ source: s.name, topic: s.topic, url: `https://x.test/${s.id}/new`, published: NOW - 1000 }),
            item({ source: s.name, topic: s.topic, url: `https://x.test/${s.id}/old`, published: NOW - (INGEST_DAYS + 1) * 86_400_000 }),
            item({ source: s.name, topic: s.topic, url: `https://x.test/${s.id}/future`, published: NOW + 5 * 86_400_000 }),
          ], status: { id: s.id, name: s.name, ok: true, count: 3 } };
    const r = await collectLive(NOW, load);
    expect(r.sources).toHaveLength(SOURCES.length);
    expect(r.sources.find((s) => s.id === "krebs")?.ok).toBe(false);
    expect(r.items.every((i) => i.url.endsWith("/new"))).toBe(true);
    expect(r.items).toHaveLength(SOURCES.length - 1);
  });
  it("in light mode (the edge function) skips the heavy sources and nothing else", async () => {
    const seen: string[] = [];
    const load = async (s: (typeof SOURCES)[number]) => { seen.push(s.id); return { items: [], status: { id: s.id, name: s.name, ok: true, count: 0 } }; };
    await collectLive(NOW, load, true);
    const heavy = SOURCES.filter((s) => s.heavy).map((s) => s.id).sort();
    expect(heavy).toEqual(["cisa", "kev", "openai"]);
    expect(seen.sort()).toEqual(SOURCES.filter((s) => !s.heavy).map((s) => s.id).sort());
    seen.length = 0;
    await collectLive(NOW, load, false);
    expect(seen).toHaveLength(SOURCES.length);
  });
  it("only ever fetches the fixed https allowlist", () => {
    for (const s of SOURCES) expect(s.url.startsWith("https://")).toBe(true);
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
  });
});

describe("endpoint", () => {
  afterEach(() => vi.unstubAllGlobals());
  const archiveItems = Array.from({ length: 30 }, (_, n) => item({ url: `https://arch.test/${n}`, title: `Archived ${n}`, published: Date.now() - (n + 1) * 3_600_000 }));
  function stub(archive: unknown, archiveStatus = 200) {
    vi.stubGlobal("fetch", async (u: string) =>
      String(u).includes("raw.githubusercontent.com/poncema4/ponce-os/news-data")
        ? new Response(JSON.stringify(archive), { status: archiveStatus })
        : new Response("down", { status: 500 }));
  }
  const get = (q = "") => handler(new Request(`https://x.test/api/cyber-brief${q}`));

  it("rejects non-GET without touching the network", async () => {
    const res = await handler(new Request("https://x.test/api/cyber-brief", { method: "POST" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("serves the archive paged, even when every live feed is down", async () => {
    stub({ version: 1, updated: Date.now(), items: archiveItems });
    const body = await (await get("?page=2")).json();
    expect(body.archive.ok).toBe(true);
    expect(body.total).toBe(30);
    expect(body.page).toBe(2);
    expect(body.pages).toBe(2);
    expect(body.items).toHaveLength(10);
    type S = { ok: boolean; note?: string };
    const viaArchive = body.sources.filter((s: S) => s.note === "updated by the archive job");
    expect(viaArchive).toHaveLength(3);                                   // the heavy sources, healthy because the archive loaded
    expect(viaArchive.every((s: S) => s.ok)).toBe(true);
    expect(body.sources.filter((s: S) => s.note !== "updated by the archive job").every((s: S) => !s.ok)).toBe(true); // live feeds were all down
    expect(isBriefPage(body)).toBe(true);
  });
  it("searches the archive and clamps junk parameters", async () => {
    stub({ version: 1, updated: Date.now(), items: archiveItems });
    expect((await (await get("?q=archived%2012")).json()).total).toBe(1);
    const junk = await (await get("?page=abc&topic=%3Cscript%3E&q=" + "x".repeat(500))).json();
    expect(junk.page).toBe(1);
    expect(junk.total).toBe(0);
  });
  it("degrades to live-only when the archive is missing or malformed", async () => {
    for (const bad of [{ nope: 1 }, "garbage"]) {
      stub(bad);
      const res = await get();
      expect(res.status).toBe(200);
      expect((await res.json()).archive.ok).toBe(false);
    }
    stub({}, 404);
    expect((await (await get()).json()).archive.ok).toBe(false);
  });
});

describe("pageList", () => {
  const show = (c: number, n: number) => pageList(c, n).join(",");
  it("shows every page when there are six or fewer", () => {
    expect(show(1, 1)).toBe("1");
    expect(show(1, 4)).toBe("1,2,3,4");
    expect(show(6, 6)).toBe("1,2,3,4,5,6");
  });
  it("shows 1 2 3 4, a jump box and the last page at the start (the 100-page case)", () => {
    expect(show(1, 100)).toBe("1,2,3,4,jump,100");
    expect(show(4, 100)).toBe("1,2,3,4,jump,100");
    expect(show(1, 7)).toBe("1,2,3,4,jump,7");
  });
  it("keeps your page visible in the middle and at the end", () => {
    expect(show(5, 100)).toBe("1,gap,4,5,6,jump,100");
    expect(show(50, 100)).toBe("1,gap,49,50,51,jump,100");
    expect(show(97, 100)).toBe("1,gap,96,97,98,jump,100");
    expect(show(98, 100)).toBe("1,jump,97,98,99,100");
    expect(show(100, 100)).toBe("1,jump,97,98,99,100");
    expect(show(5, 7)).toBe("1,jump,4,5,6,7");
  });
  it("always contains the current page, exactly one jump box when paged, and at most 7 slots", () => {
    for (let n = 1; n <= 100; n++) for (let c = 1; c <= n; c++) {
      const l = pageList(c, n);
      expect(l.length).toBeLessThanOrEqual(7);
      expect(l).toContain(c);
      expect(l.filter((x) => x === "jump").length).toBe(n > 6 ? 1 : 0);
      expect(l[l.length - 1]).toBe(n);
    }
  });
});

describe("parseJump", () => {
  it("accepts whole numbers, clamps to the last page, and rejects everything else", () => {
    expect(parseJump("7", 100)).toBe(7);
    expect(parseJump(" 12 ", 100)).toBe(12);
    expect(parseJump("999", 100)).toBe(100);
    expect(parseJump("0", 100)).toBeNull();
    expect(parseJump("", 100)).toBeNull();
    expect(parseJump("-3", 100)).toBeNull();
    expect(parseJump("2.5", 100)).toBeNull();
    expect(parseJump("abc", 100)).toBeNull();
    expect(parseJump("12345", 100)).toBeNull();
  });
});

describe("pickBaseline", () => {
  it("pins the session value, else uses the stored last visit, else none", () => {
    expect(pickBaseline("500", "900")).toBe(500);
    expect(pickBaseline(null, "900")).toBe(900);
    expect(pickBaseline(null, null)).toBe(0);
    expect(pickBaseline("junk", "900")).toBe(900);
    expect(pickBaseline(null, "junk")).toBe(0);
  });
});

describe("page helpers", () => {
  it("formats ages in both languages", () => {
    expect(ageLabel(NOW, NOW, CB.en)).toBe("just now");
    expect(ageLabel(NOW - 5 * 60_000, NOW, CB.en)).toBe("5 min");
    expect(ageLabel(NOW - 3 * 3_600_000, NOW, CB.es)).toBe("3 h");
    expect(ageLabel(NOW - 72 * 3_600_000, NOW, CB.en)).toBe("3 d");
    expect(ageLabel(NOW + 99_000, NOW, CB.en)).toBe("just now");
    expect(agoLabel(NOW - 5 * 60_000, NOW, "en")).toBe("5 min ago");
    expect(agoLabel(NOW - 5 * 60_000, NOW, "es")).toBe("hace 5 min");
    expect(agoLabel(NOW, NOW, "es")).toBe("justo ahora");
  });
  it("validates the payload shape and links", () => {
    const ok = { generated: 1, total: 0, page: 1, pages: 1, perPage: 20, items: [], archive: { ok: true, count: 0, updated: 0 }, sources: [] };
    expect(isBriefPage(ok)).toBe(true);
    for (const bad of [null, {}, { ...ok, items: {} }, { ...ok, total: "x" }, { ...ok, archive: null }]) expect(isBriefPage(bad)).toBe(false);
    expect(isSafeHref("https://a.test")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(hostOf("https://www.example.com/x")).toBe("example.com");
    expect(hostOf("nope")).toBe("");
  });
  it("has the same copy keys in en and es", () => {
    expect(Object.keys(CB.es).sort()).toEqual(Object.keys(CB.en).sort());
  });
});
