import { test, expect, type Page } from "@playwright/test";
import { boot, openMenuIfPhone } from "./helpers";

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN GUARDS: the rules that keep the site usable on every device.

   Each of these exists because it was actually broken once (see tests/README.md, "What the
   redesign fixed"): the nav scrolled away on a 9,000 px page, two floating buttons sat on top of
   the experience text on phones, light text failed contrast, 20 tap targets were too small, and the
   case-file numbers only appeared on hover (so never on a phone).
   ──────────────────────────────────────────────────────────────────────────── */

const SIZES = [
  { name: "desktop 1440", w: 1440, h: 900 },
  { name: "laptop 1024", w: 1024, h: 768 },
  { name: "tablet 768", w: 768, h: 1024 },
  { name: "phone 390", w: 390, h: 844 },
  { name: "phone 360", w: 360, h: 740 },
];

async function scrollAndSettle(page: Page, y: number) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(500);
}

test.describe("layout at every size", () => {
  for (const s of SIZES) {
    test(`${s.name}: no sideways scroll, nav stays reachable, nothing covers what you read`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: s.w, height: s.h });
      await boot(page);

      // 1. no horizontal overflow anywhere on the page
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(0);

      // 2. the status bar is sticky: after scrolling a long way it is still pinned to the top
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      await scrollAndSettle(page, Math.round(total * 0.6));
      const bar = await page.evaluate(() => { const r = document.querySelector(".pos-statusbar")!.getBoundingClientRect(); return { top: r.top, h: r.height }; });
      expect(bar.top, "status bar pinned to the top after scrolling").toBe(0);
      expect(bar.h, "status bar stays slim (never a 3-row header)").toBeLessThanOrEqual(72);

      // 3. no floating widget sits over page content: the only fixed elements allowed are the 3D scene
      //    (behind everything) and non-interactive decoration
      const fixedInteractive = await page.evaluate(() =>
        [...document.querySelectorAll("body *")].filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.position !== "fixed" || cs.pointerEvents === "none") return false;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) return false;
          return !el.classList.contains("pos-scene3d");
        }).map((el) => el.className));
      expect(fixedInteractive, "fixed interactive elements floating over the page").toEqual([]);

      // 4. at several scroll stops, every important visible element is the topmost thing at its own centre
      const covered: string[] = [];
      for (const stop of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1]) {
        await scrollAndSettle(page, Math.round((total - s.h) * stop));
        const hits = await page.evaluate(() => {
          const out: string[] = [];
          const barH = document.querySelector(".pos-statusbar")!.getBoundingClientRect().height;
          const sel = "a[href], button, h1, h2, h3, .pos-hero-inner p, .pos-log-body li, .pos-file-brief, .pos-redact";
          for (const el of document.querySelectorAll(sel)) {
            if (el.closest("details:not([open])") || el.closest("[hidden]")) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none") continue;
            const r = el.getBoundingClientRect();
            const left = Math.max(0, r.left), right = Math.min(innerWidth, r.right), top = Math.max(barH, r.top), bottom = Math.min(innerHeight, r.bottom);
            if (right - left < 4 || bottom - top < 4) continue;
            let o = 1; for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
            if (o < 0.9) continue;
            const t = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
            if (!t || t === el || el.contains(t) || t.contains(el)) continue;
            if (el.closest("a") && el.closest("a") === t.closest("a")) continue;
            out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} "${(el.textContent || "").trim().slice(0, 24)}" covered by ${t.tagName.toLowerCase()}.${(t.className || "").toString().split(" ")[0]}`);
          }
          return out;
        });
        covered.push(...hits.map((h) => `@${Math.round(stop * 100)}%: ${h}`));
      }
      expect(covered, "elements covered by something else").toEqual([]);
    });
  }
});

test.describe("touch targets", () => {
  for (const s of SIZES.filter((x) => x.w <= 768)) {
    test(`${s.name}: every primary control is at least 44 px tall`, async ({ page }) => {
      await page.setViewportSize({ width: s.w, height: s.h });
      await boot(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await openMenuIfPhone(page);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const scope = ".pos-statusbar a, .pos-statusbar button, .pos-hero a, .pos-hero button, .pos-sheet a, .pos-sheet button, .pos-contact-links a, .pos-more > summary, .pos-paper-link";
        for (const el of document.querySelectorAll(scope)) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.height < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return out;
      });
      expect(small, "controls under 44px tall").toEqual([]);
    });
  }
});

test.describe("phone menu", () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); });

  test("is closed at first, opens on tap, closes on Escape, and exposes its state", async ({ page }) => {
    await boot(page);
    const btn = page.locator(".pos-menu-btn");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".pos-sheet")).toBeHidden();
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".pos-sheet")).toBeVisible();
    await expect(page.locator(".pos-sheet a")).toHaveCount(8); // 7 sections + the Cyber Brief page (/cyber)
    await page.keyboard.press("Escape");
    await expect(page.locator(".pos-sheet")).toBeHidden();
    await expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  test("the header is one slim row on a phone (it used to eat 150 px of the screen)", async ({ page }) => {
    await boot(page);
    const h = await page.locator(".pos-statusbar").evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBeLessThanOrEqual(64);
  });
});

test.describe("accessibility", () => {
  test("text colours meet WCAG AA (4.5:1) on the surfaces they sit on", async ({ page }) => {
    await boot(page);
    const result = await page.evaluate(() => {
      const root = document.querySelector(".pos-root")!;
      const cs = getComputedStyle(root);
      const v = (n: string) => cs.getPropertyValue(n).trim();
      const lum = (hex: string) => {
        const h = hex.replace("#", "");
        const c = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
      const out: Record<string, number> = {};
      for (const fg of ["--txt", "--soft", "--dim", "--green", "--green-hi", "--cyan", "--amber", "--amber-hi"]) {
        for (const bg of ["--bg", "--panel", "--panel-2"]) out[`${fg} on ${bg}`] = +ratio(v(fg), v(bg)).toFixed(2);
      }
      out["button text on amber"] = +ratio("#1a1205", v("--amber")).toFixed(2);
      return out;
    });
    const failing = Object.entries(result).filter(([, r]) => r < 4.5);
    expect(failing, `contrast below 4.5:1: ${JSON.stringify(failing)}`).toEqual([]);
  });

  test("keyboard: the first Tab reveals a skip link, and it works", async ({ page }) => {
    await boot(page);
    // a real visitor's first Tab on a fresh page: nothing focused, top of the page
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); window.scrollTo(0, 0); });
    await page.keyboard.press("Tab");
    const skip = page.locator(".pos-skip");
    await expect(skip).toBeFocused();
    await expect.poll(async () => (await skip.boundingBox())!.y, { message: "skip link slides into view on focus" }).toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => document.getElementById("terminal")!.getBoundingClientRect().top)).toBeLessThan(200);
  });

  test("keyboard: whatever has focus shows a visible focus ring", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); window.scrollTo(0, 0); });
    const missing: string[] = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const cs = getComputedStyle(el);
        const ok = el.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2;
        return { ok, label: `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} "${(el.textContent || "").trim().slice(0, 16)}"` };
      });
      if (!r.ok && !/input/.test(r.label)) missing.push(r.label);
    }
    expect(missing, "focused elements with no visible focus ring").toEqual([]);
  });

  test("landmarks and headings: one h1, a main, a nav with a label, sections named by their heading", async ({ page }) => {
    await boot(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator("nav[aria-label]")).toHaveCount(1);
    const unnamed = await page.locator("section[id]").evaluateAll((els) => els.filter((e) => !e.getAttribute("aria-labelledby")).map((e) => e.id));
    expect(unnamed).toEqual([]);
    const jumps = await page.evaluate(() => {
      const levels = [...document.querySelectorAll("h1,h2,h3")].map((h) => +h.tagName[1]);
      return levels.filter((l, i) => i > 0 && l - levels[i - 1] > 1).length;
    });
    expect(jumps, "heading levels skipped").toBe(0);
  });

  test("buttons that toggle say so, and icon-like controls have names", async ({ page }) => {
    await boot(page);
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href]")].filter((el) => {
        const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
        return name.length === 0;
      }).map((el) => el.className));
    expect(unnamed, "controls with no accessible name").toEqual([]);
  });
});

test.describe("privacy and supply chain", () => {
  test("the page asks nobody but itself (and the stubbed GitHub API) for anything", async ({ page }) => {
    const hosts = new Set<string>();
    page.on("request", (r) => hosts.add(new URL(r.url()).host));
    await boot(page);
    await page.waitForTimeout(800);
    const foreign = [...hosts].filter((h) => !/^localhost(:\d+)?$/.test(h) && h !== "api.github.com");
    expect(foreign, "third-party hosts contacted (fonts, analytics, CDNs)").toEqual([]);
  });

  test("the self-hosted fonts load and are the ones in use", async ({ page }) => {
    await boot(page);
    const ok = await page.evaluate(async () => {
      await document.fonts.ready;
      return { serif: document.fonts.check('16px "Newsreader"'), mono: document.fonts.check('16px "JetBrains Mono"') };
    });
    expect(ok).toEqual({ serif: true, mono: true });
    const fam = await page.locator(".pos-name").evaluate((e) => getComputedStyle(e).fontFamily);
    expect(fam).toMatch(/Newsreader/);
  });
});

test.describe("case-file cards on touch", () => {
  test("a tap goes to the project; the card never stays tilted (tilt is mouse-only)", async ({ page, isMobile }) => {
    test.skip(!isMobile, "touch emulation is the mobile project");
    await boot(page);
    const card = page.locator(".pos-file").first();
    await card.scrollIntoViewIfNeeded();
    await card.tap({ noWaitAfter: true, trial: true });
    const t = await card.evaluate((e) => (e as HTMLElement).style.transform);
    expect(t).toBe("");
  });
});
