import { describe, it, expect, vi, afterEach } from "vitest";
import { runVisitorScan, scanLineClass } from "./scan";

// The `scan` command promises "0 bytes sent". These tests hold it to that: nothing here may call
// fetch, and the output has to keep its shape (the terminal colours lines by their text).

function stubBrowser(over: { ua?: string; cores?: number; lang?: string } = {}) {
  vi.stubGlobal("navigator", { userAgent: over.ua ?? "UA-1", hardwareConcurrency: over.cores ?? 8, language: over.lang ?? "en-US" });
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
  vi.stubGlobal("screen", { width: 1920, height: 1080 });
  vi.stubGlobal("window", { devicePixelRatio: 2 });
}

describe("runVisitorScan", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never touches the network", async () => {
    stubBrowser();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await runVisitorScan();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports the promised fields and the zero-bytes guarantee", async () => {
    stubBrowser();
    const out = (await runVisitorScan()).join("\n");
    for (const f of ["gpu", "cpu threads", "memory", "display", "timezone", "locale", "network", "battery", "fingerprint"]) {
      expect(out).toContain(f);
    }
    expect(out).toContain("1920x1080 @ 2x");
    expect(out).toMatch(/data sent\s+0 bytes/);
  });

  it("degrades gracefully when WebGL is blocked and the browser hides everything", async () => {
    stubBrowser();
    const out = (await runVisitorScan()).join("\n");
    expect(out).toContain("unknown (webgl blocked)");
    expect(out).toMatch(/memory\s+undisclosed/);
    expect(out).toMatch(/network\s+undisclosed/);
    expect(out).toMatch(/battery\s+undisclosed/);
  });

  it("the fingerprint is stable for the same browser and changes for a different one", async () => {
    const fp = async () => ((await runVisitorScan()).join("\n").match(/0x[0-9a-f]{8}/) || [""])[0];
    stubBrowser({ ua: "UA-1" });
    const a = await fp();
    const a2 = await fp();
    stubBrowser({ ua: "UA-2" });
    const b = await fp();
    expect(a).toMatch(/^0x[0-9a-f]{8}$/);
    expect(a).toBe(a2);
    expect(b).not.toBe(a);
  });

  it("highlights the headline and threat lines, and dims the data and lesson lines", async () => {
    stubBrowser();
    const lines = await runVisitorScan();
    const cls = (needle: string) => scanLineClass(lines.find((l) => l.includes(needle)) ?? "");
    expect(cls("initiating visitor assessment")).toBe("hd");
    expect(cls("threat level")).toBe("hd");
    expect(cls("data sent")).toBe("dim");
    expect(cls("lesson")).toBe("dim");
    expect(cls("fingerprint")).toBeUndefined();
  });
});

describe("scanLineClass", () => {
  it("is case-insensitive (regression: the old check was uppercase-only and never matched)", () => {
    expect(scanLineClass("  THREAT level high")).toBe("hd");
    expect(scanLineClass("  threat level minimal")).toBe("hd");
    expect(scanLineClass("  Lesson: zero trust")).toBe("dim");
  });
  it("does not dim ordinary lines that merely contain the word", () => {
    expect(scanLineClass("  gpu            some metadata card")).toBeUndefined();
    expect(scanLineClass("database")).toBeUndefined();
  });
});
