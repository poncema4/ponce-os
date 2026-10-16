import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bibAuthor, bibKey, toBibtex, papersBib, type PaperLike } from "./bib";

const riskcast: PaperLike = {
  id: "RSC-26", title: "RiskCast: Behavioral Risk Forecasting Across Multi-Modal Security Streams", venue: "ACM IWSPA '26",
  where: "Frankfurt am Main, Germany", authors: "S. Anand, M. Ponce, D. Duong", doi: "https://doi.org/10.1145/3806007.3810965",
};

describe("bibAuthor", () => {
  it("puts the family name first", () => {
    expect(bibAuthor("M. Ponce")).toBe("Ponce, M.");
    expect(bibAuthor("  Marco   Antonio Ponce ")).toBe("Ponce, Marco Antonio");
  });
  it("leaves a single token alone", () => expect(bibAuthor("Plato")).toBe("Plato"));
});

describe("toBibtex", () => {
  const out = toBibtex(riskcast).join("\n");
  it("is a well-formed @inproceedings entry with balanced braces", () => {
    expect(out.startsWith("@inproceedings{")).toBe(true);
    expect(out.trimEnd().endsWith("}")).toBe(true);
    expect((out.match(/{/g) ?? []).length).toBe((out.match(/}/g) ?? []).length);
  });
  it("joins authors with 'and', family name first, in the page's order", () => {
    expect(out).toContain("author    = {Anand, S. and Ponce, M. and Duong, D.}");
  });
  it("carries the real title, venue, place, year and DOI", () => {
    expect(out).toContain("RiskCast: Behavioral Risk Forecasting");
    expect(out).toContain("booktitle = {ACM IWSPA '26}");
    expect(out).toContain("Frankfurt am Main, Germany");
    expect(out).toContain("year      = {2026}");
    expect(out).toContain("doi       = {10.1145/3806007.3810965}");
    expect(out).toContain("url       = {https://doi.org/10.1145/3806007.3810965}");
  });
  it("a title with BibTeX syntax characters cannot break the entry", () => {
    const evil = toBibtex({ ...riskcast, title: "A {nasty} \\title & 100% #1" }).join("\n");
    expect((evil.match(/{/g) ?? []).length).toBe((evil.match(/}/g) ?? []).length);
    expect(evil).toContain("A nasty title \\& 100\\% \\#1");
  });
  it("the key is lowercase alphanumerics only", () => {
    expect(bibKey(riskcast)).toMatch(/^[a-z0-9]+$/);
    expect(bibKey({ ...riskcast, authors: "X. O'Neil-Smith", title: "Zero-Trust: x" })).toMatch(/^[a-z0-9]+$/);
  });
});

describe("papersBib", () => {
  it("separates entries with exactly one blank line and has unique keys", () => {
    const b = { ...riskcast, id: "BKR-26", title: "BBKR: Behavior-Driven Key Rotation", doi: "https://doi.org/10.1145/3806008.3811702" };
    const lines = papersBib([riskcast, b]);
    expect(lines.filter((l) => l === "")).toHaveLength(1);
    const keys = lines.filter((l) => l.startsWith("@")).map((l) => l.slice(l.indexOf("{") + 1, -1));
    expect(new Set(keys).size).toBe(2);
  });
  it("is empty for no papers", () => expect(papersBib([])).toEqual([]));
});

describe("contract with the page", () => {
  it("the page still has exactly the two papers this module is meant to print", () => {
    const app = fs.readFileSync(path.resolve(__dirname, "../PonceOS.tsx"), "utf8");
    expect([...app.matchAll(/doi: "https:\/\/doi\.org\/10\.1145\/(\d+\.\d+)"/g)]).toHaveLength(2);
  });
});
