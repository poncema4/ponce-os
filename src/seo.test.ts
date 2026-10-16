// Search + social preview contract. Reads the real files (index.html, public/, the DOIs in the app),
// so a future edit that breaks the link preview, the sitemap, or leaks contact details fails here.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const html = read("index.html");
const meta = (attr: "name" | "property", key: string) =>
  html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];
const SITE = "https://poncema4.vercel.app/";

describe("page head", () => {
  it("has a short title and a description that fits a search snippet", () => {
    const title = html.match(/<title>([^<]*)<\/title>/)![1];
    expect(title.length).toBeGreaterThan(3);
    expect(title.length).toBeLessThanOrEqual(60);
    const d = meta("name", "description")!;
    expect(d.length).toBeGreaterThanOrEqual(70);
    expect(d.length).toBeLessThanOrEqual(200);
  });
  it("canonical, og:url and the sitemap all name the same absolute https URL", () => {
    expect(html).toContain(`<link rel="canonical" href="${SITE}"`);
    expect(meta("property", "og:url")).toBe(SITE);
    expect(read("public/sitemap.xml")).toContain(`<loc>${SITE}</loc>`);
  });
  it("robots.txt allows crawling and points at the sitemap", () => {
    const r = read("public/robots.txt");
    expect(r).toMatch(/User-agent: \*\s+Allow: \//);
    expect(r).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(r).not.toMatch(/Disallow:\s*\//);
  });
  it("is indexable", () => {
    expect(meta("name", "robots")).toMatch(/index/);
    expect(meta("name", "robots")).not.toMatch(/noindex/);
  });
});

describe("social preview", () => {
  it("Open Graph and Twitter tags are complete, absolute, and agree", () => {
    for (const k of ["og:title", "og:description", "og:type", "og:url", "og:image", "og:image:alt", "og:site_name"]) {
      expect(meta("property", k), k).toBeTruthy();
    }
    expect(meta("name", "twitter:card")).toBe("summary_large_image");
    expect(meta("name", "twitter:image")).toBe(meta("property", "og:image"));
    expect(meta("name", "twitter:image:alt")).toBeTruthy();
    expect(meta("property", "og:image")).toMatch(/^https:\/\//);
    expect(meta("property", "og:image:width")).toBe("1200");
    expect(meta("property", "og:image:height")).toBe("630");
  });
  it("the preview image actually exists and is a real JPEG of a sensible size", () => {
    const file = meta("property", "og:image")!.replace(SITE, "");
    const buf = fs.readFileSync(path.join(root, "public", file));
    expect(buf.subarray(0, 3).toString("hex")).toBe("ffd8ff"); // JPEG magic bytes
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf.length).toBeLessThan(600_000); // chat apps drop huge previews
  });
});

describe("structured data", () => {
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  const graph: Array<Record<string, unknown>> = ld["@graph"];
  it("is valid JSON-LD with a Person, a WebSite and both papers", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    const types = graph.map((n) => n["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Person", "WebSite"]));
    expect(types.filter((t) => t === "ScholarlyArticle")).toHaveLength(2);
  });
  it("the paper links are exactly the DOIs the page shows (no drift between data and content)", () => {
    const app = read("src/components/PonceOS.tsx");
    const shown = [...app.matchAll(/doi: "(https:\/\/doi\.org\/[^"]+)"/g)].map((m) => m[1]).sort();
    const declared = graph.filter((n) => n["@type"] === "ScholarlyArticle").map((n) => n.url as string).sort();
    expect(shown).toHaveLength(2);
    expect(declared).toEqual(shown);
  });
  it("every URL in the data is absolute https", () => {
    const urls = JSON.stringify(ld).match(/"(?:url|image|sameAs)":\s*"?\[?"?[^,}\]]*/g) ?? [];
    for (const u of JSON.stringify(ld).match(/https?:\/\/[^"]+/g)!) expect(u).toMatch(/^https:\/\//);
    expect(urls.length).toBeGreaterThan(0);
  });
});

describe("privacy: nothing personal leaks through the head or the no-JS page", () => {
  it("has no email address, phone number or street address in index.html", () => {
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(html).not.toMatch(/\b\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/);
    expect(html).not.toMatch(/mailto:|tel:/i);
  });
});

describe("no-JavaScript fallback", () => {
  const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? "";
  it("gives crawlers and link scrapers real content and the key links", () => {
    expect(noscript).toContain("Marco Ponce");
    expect(noscript).toContain("/Marco_Ponce_Resume.pdf");
    expect(noscript).toContain("github.com/poncema4");
    expect(noscript).toContain("10.1145/3806007.3810965");
    expect(noscript).toContain("10.1145/3806008.3811702");
  });
  it("the resume it links to exists", () => {
    expect(fs.existsSync(path.join(root, "public", "Marco_Ponce_Resume.pdf"))).toBe(true);
  });
});
