// The site remembers you: returning-visitor welcome, discoveries, and the captain's log.
// Desktop AND mobile (the log button lives in the status bar on desktop, in the menu sheet on phones).
import { test, expect, type Page } from "@playwright/test";
import { boot, openMenuIfPhone, runCmd } from "./helpers";

const KEY = "ponce-os:memory:v1";
const DAY = 86_400_000;

const seed = (page: Page, mem: unknown) => page.addInitScript(([k, v]) => { if (!localStorage.getItem(k as string)) localStorage.setItem(k as string, JSON.stringify(v)); }, [KEY, mem]);
const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);

async function openLog(page: Page) {
  await openMenuIfPhone(page);
  const btn = page.locator("button", { hasText: /^(log|diario) \d+\/\d+$/ }).filter({ visible: true }).first();
  await btn.click();
  await expect(page.locator(".pos-log-panel")).toBeVisible();
}

test.describe("memory: first visit", () => {
  test("says nothing it cannot know, counts the visit, and shows an empty log", async ({ page }) => {
    await boot(page);
    await expect(page.locator(".pos-welcome")).toHaveCount(0);
    await expect.poll(async () => (await stored(page)).visits).toBe(1);
    await openLog(page);
    await expect(page.locator(".pos-log-list li")).toHaveCount(14);
    await expect(page.locator(".pos-log-list li.got")).toHaveCount(0);
    await expect(page.locator(".pos-log-count")).toContainText("0 / 14");
  });

  test("a reload in the same session is not a second visit", async ({ page }) => {
    await boot(page);
    await expect.poll(async () => (await stored(page)).visits).toBe(1);
    await page.reload();
    await page.locator("input").first().waitFor();
    await page.waitForTimeout(500);
    expect((await stored(page)).visits).toBe(1);
  });
});

test.describe("memory: returning visitor", () => {
  test("welcomes you back, says when, and where you got to, and unlocks 'Regular'", async ({ page }) => {
    await seed(page, { visits: 2, first: Date.now() - 9 * DAY, last: Date.now() - 2 * DAY, lastSection: "case-files", seen: ["terminal", "service-log", "case-files"], found: {} });
    await boot(page);
    const w = page.locator(".pos-welcome");
    await expect(w).toBeVisible();
    await expect(w).toContainText("Welcome back");
    await expect(w).toContainText("2 days ago");
    await expect(w).toContainText("work"); // "case-files" is labelled "work" in the nav
    await openLog(page);
    await expect(page.locator(".pos-log-list li.got")).toContainText(["Regular"]);
  });

  test("the welcome follows the language toggle", async ({ page }) => {
    await seed(page, { visits: 4, first: Date.now() - 9 * DAY, last: Date.now() - DAY, lastSection: null, seen: [], found: {} });
    await boot(page);
    await expect(page.locator(".pos-welcome")).toContainText("Welcome back");
    await runCmd(page, "lang es");
    await expect(page.locator(".pos-welcome")).toContainText("Bienvenido de vuelta");
  });
});

test.describe("discoveries", () => {
  test("an unlock shows a toast, lands in the log, and survives a reload", async ({ page }) => {
    await boot(page);
    await runCmd(page, "kraken");
    await expect(page.locator(".pos-toast")).toContainText("Respects paid");
    await expect.poll(async () => Object.keys((await stored(page)).found || {})).toContain("kraken");
    await page.reload();
    await page.locator("input").first().waitFor();
    await openLog(page);
    await expect(page.locator(".pos-log-list li.got")).toContainText(["Respects paid"]);
  });

  test("terminal commands unlock the matching entries, once each", async ({ page }) => {
    await boot(page);
    await runCmd(page, "resume");
    await runCmd(page, "resume");
    await runCmd(page, "keel");
    await expect.poll(async () => Object.keys((await stored(page)).found || {}).sort()).toEqual(["keel", "resume"]);
  });

  test("switching language unlocks Polyglot; the music command unlocks Soundtrack", async ({ page }) => {
    await boot(page);
    await runCmd(page, "lang es");
    await runCmd(page, "music");
    await expect.poll(async () => Object.keys((await stored(page)).found || {})).toEqual(expect.arrayContaining(["polyglot", "synth"]));
  });

  test("a corrupt or hand-edited save never breaks the page", async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, "{{{ not json"), KEY);
    await boot(page);
    await openLog(page);
    await expect(page.locator(".pos-log-list li")).toHaveCount(14);
  });
});

test.describe("captain's log dialog", () => {
  test("is a real dialog: focus moves in, the page does not scroll, Escape closes and focus returns", async ({ page }) => {
    await boot(page);
    await openMenuIfPhone(page);
    const btn = page.locator("button", { hasText: /^log \d+\/\d+$/ }).filter({ visible: true }).first();
    await btn.focus();
    await btn.click();
    await expect(page.locator(".pos-log-panel")).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(page.locator(".pos-log-panel")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("fits the screen, has a thumb-sized close button, and traps Tab", async ({ page }) => {
    await boot(page);
    await openLog(page);
    const box = await page.locator(".pos-log-panel").boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
    const close = await page.locator(".pos-log-x").boundingBox();
    expect(close!.width).toBeGreaterThanOrEqual(44);
    expect(close!.height).toBeGreaterThanOrEqual(44);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".pos-log-wrap"))).toBe(true);
  });

  test("clicking outside the panel closes it", async ({ page }) => {
    await boot(page);
    await openLog(page);
    await page.locator(".pos-log-wrap").click({ position: { x: 3, y: 3 } });
    await expect(page.locator(".pos-log-panel")).toHaveCount(0);
  });
});

test.describe("lantern cursor", () => {
  test("never intercepts clicks and never causes sideways scroll", async ({ page }) => {
    await boot(page);
    const pe = await page.locator(".pos-lantern").evaluate((e) => getComputedStyle(e).pointerEvents);
    expect(pe).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
