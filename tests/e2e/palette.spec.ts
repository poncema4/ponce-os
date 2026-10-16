// Ctrl+K "jump to anything": the dialog, the keyboard, the actions, and when it must stay shut.
import { test, expect, type Page } from "@playwright/test";
import { boot, runCmd } from "./helpers";

const pal = (page: Page) => page.locator(".pos-pal");
const opts = (page: Page) => page.locator(".pos-pal [role=option]");
async function open(page: Page) {
  await page.keyboard.press("Control+k");
  await expect(pal(page)).toBeVisible();
}

test.describe("command palette", () => {
  test("Ctrl+K opens a real dialog: focused input, every item listed, ARIA wired", async ({ page }) => {
    await boot(page);
    await open(page);
    await expect(pal(page)).toHaveAttribute("aria-modal", "true");
    const input = page.locator(".pos-pal-input");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("role", "combobox");
    expect(await opts(page).count()).toBe(18); // 7 sections + 5 links + 6 actions
    // aria-activedescendant must point at a real, selected option
    const id = await input.getAttribute("aria-activedescendant");
    expect(id).toBeTruthy();
    await expect(page.locator(`[id="${id}"]`)).toHaveAttribute("aria-selected", "true");
    expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  });

  test("Escape closes it, restores scrolling, and returns focus to where it was", async ({ page }) => {
    await boot(page);
    const term = page.locator(".pos-term-input input");
    await term.scrollIntoViewIfNeeded();
    await term.focus();
    await open(page);
    await page.keyboard.press("Escape");
    await expect(pal(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect(term).toBeFocused();
  });

  test("Ctrl+K again toggles it shut; clicking the backdrop closes it; clicking inside does not", async ({ page }) => {
    await boot(page);
    await open(page);
    await page.locator(".pos-pal-input").click();
    await expect(pal(page)).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(pal(page)).toHaveCount(0);
    await open(page);
    await page.locator(".pos-pal-wrap").click({ position: { x: 4, y: 4 } });
    await expect(pal(page)).toHaveCount(0);
  });

  test("typing filters and ranks; Enter runs the top match and jumps to that section", async ({ page }) => {
    await boot(page);
    await open(page);
    await page.keyboard.type("resea");
    await expect(opts(page)).toHaveCount(1);
    await expect(opts(page).first()).toContainText("research");
    await page.keyboard.press("Enter");
    await expect(pal(page)).toHaveCount(0);
    // Same bar as the nav tests: the section's heading is on screen, below the sticky bar (not stuck hidden under it).
    // The exact resting offset is not asserted: under software rendering a long smooth scroll can pause early.
    await expect.poll(() => page.evaluate(() => { const r = document.querySelector("#research h2")!.getBoundingClientRect(); return r.top >= 50 && r.bottom <= innerHeight; }), { timeout: 12_000 }).toBe(true);
  });

  test("arrow keys move the highlight and wrap around", async ({ page }) => {
    await boot(page);
    await open(page);
    const selected = () => page.locator(".pos-pal [aria-selected=true]").evaluate((e) => e.id);
    const first = await selected();
    await page.keyboard.press("ArrowDown");
    expect(await selected()).not.toBe(first);
    await page.keyboard.press("ArrowUp");
    expect(await selected()).toBe(first);
    await page.keyboard.press("ArrowUp"); // wraps to the last item
    const last = await selected();
    expect(last).not.toBe(first);
    await page.keyboard.press("ArrowDown");
    expect(await selected()).toBe(first);
  });

  test("a query with no match says so, and Enter does nothing (the dialog stays)", async ({ page }) => {
    await boot(page);
    await open(page);
    await page.keyboard.type("zzzzqqqq");
    await expect(page.locator(".pos-pal .none")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(pal(page)).toBeVisible();
  });

  test("actions: fire the cannons unlocks Broadside; the captain's log opens; language switches", async ({ page }) => {
    await boot(page);
    await open(page);
    await page.keyboard.type("cannons");
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("ponce-os:memory:v1") || "{}").found || {}))).toContain("broadside");

    await open(page);
    await page.keyboard.type("captain");
    await page.keyboard.press("Enter");
    await expect(page.locator(".pos-log-panel")).toBeVisible();
    await page.keyboard.press("Escape");

    await open(page);
    await page.keyboard.type("language");
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("it follows the language: Spanish placeholder, accent-insensitive search", async ({ page }) => {
    await boot(page);
    await open(page);
    await page.keyboard.type("language");
    await page.keyboard.press("Enter");
    await open(page);
    await expect(page.locator(".pos-pal-input")).toHaveAttribute("placeholder", /ve a una seccion/i);
    await page.keyboard.type("capitan");
    await expect(opts(page).first()).toContainText(/diario del capitan/i);
  });

  test("it stays shut where it should: one Ctrl+K keystroke on the boot screen only skips the boot, and plain k never opens it", async ({ page }) => {
    await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.goto("/");
    await page.waitForSelector(".pos-boot");
    // ONE key event (a real Ctrl+K is two: Ctrl, then K). It dismisses the boot ("any key skips it") and must not
    // also open the palette behind it, even though the hotkey listener is registered while it is still dispatching.
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })));
    await expect(page.locator("input").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".pos-boot")).toHaveCount(0);
    await expect(pal(page)).toHaveCount(0);
    // and from here on it works normally
    await open(page);
    await page.keyboard.press("Escape");
    await runCmd(page, "kkkk"); // typing k in the terminal must not open it
    await expect(pal(page)).toHaveCount(0);
  });

  test("the status-bar button exists on a laptop and is hidden on a phone", async ({ page, isMobile }) => {
    await boot(page);
    const btn = page.locator(".pos-palbtn");
    if (isMobile) await expect(btn).toBeHidden();
    else {
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText(/Ctrl K|⌘K/);
      await btn.click();
      await expect(pal(page)).toBeVisible();
    }
  });

  test("on a phone-sized screen it fits: no sideways scroll, rows are thumb-sized", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = (await page.locator(".pos-pal").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    for (const h of await opts(page).evaluateAll((els) => els.slice(0, 6).map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(47.5);
  });
});
