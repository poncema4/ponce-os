// Hero declutter, the phone hamburger, and the one-tap preset messages in the terminal.
import { test, expect } from "@playwright/test";
import { boot, runCmd, terminalText, openMenuIfPhone } from "./helpers";

test.describe("hero", () => {
  test("no duplicate buttons under the stats; resume, calendar and email stay reachable from Contact", async ({ page }) => {
    await boot(page);
    await expect(page.locator(".pos-hero a", { hasText: /download resume|book a chat|email me/i })).toHaveCount(0);
    await expect(page.locator(".pos-hero .pos-proof li")).toHaveCount(4); // the stats are still there
    const contact = page.locator("#contact");
    await expect(contact.locator('a[href="/Marco_Ponce_Resume.pdf"]')).toHaveCount(1);
    await expect(contact.locator('a[href*="calendly.com"]')).toHaveCount(1);
    await expect(contact.locator('a[href^="mailto:"]')).toHaveCount(1);
  });
});

test.describe("phone hamburger", () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); });

  test("is three lines (not the word 'menu'), has an accessible name, and turns into an X when open", async ({ page }) => {
    await boot(page);
    const btn = page.locator(".pos-menu-btn");
    await expect(btn).toBeVisible();
    expect((await btn.innerText()).trim()).toBe("");              // no visible word
    await expect(btn.locator(".pos-burger i")).toHaveCount(3);     // three horizontal lines
    await expect(btn).toHaveAttribute("aria-label", "menu");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-label", "close");
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    // the middle line fades out, the outer two cross: that is the X
    await expect.poll(() => btn.locator(".pos-burger i").nth(1).evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  });

  test("it is a thumb-sized square, and tapping a section jumps there and closes the sheet", async ({ page }) => {
    await boot(page);
    const box = (await page.locator(".pos-menu-btn").boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await openMenuIfPhone(page);
    await page.locator(".pos-sheet a", { hasText: "research" }).click();
    await expect(page.locator(".pos-sheet")).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.getElementById("research")!.getBoundingClientRect().top), { timeout: 5000 }).toBeLessThan(200);
  });

  test("no horizontal scroll with the sheet open", async ({ page }) => {
    await boot(page);
    await openMenuIfPhone(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe("preset messages (tap instead of type)", () => {
  test("shell chips run the command and echo it like a typed one", async ({ page }) => {
    await boot(page);
    const chips = page.locator(".pos-quick-btn");
    await expect(chips.first()).toBeVisible();
    await page.locator(".pos-quick-btn", { hasText: "whoami" }).click();
    await expect(terminalText(page)).toContainText("marco@ponce-os:~$ whoami");
    await page.locator(".pos-quick-btn", { hasText: "stack" }).click();
    await expect(terminalText(page).locator(".cmd")).toHaveCount(2);
  });

  test("the keel chip opens the channel and the row switches to keel's questions", async ({ page }) => {
    await boot(page);
    await page.locator(".pos-quick-btn", { hasText: "talk to keel" }).click();
    await expect(page.locator(".pos-term-input .ps1")).toHaveText("keel>");
    await expect(page.locator(".pos-quick")).toHaveAttribute("aria-label", "ask keel");
    await page.locator(".pos-quick-btn", { hasText: "pirateflow" }).click();
    await expect(terminalText(page)).toContainText(/hackathon winner/i);
    await page.locator(".pos-quick-btn", { hasText: "hire marco" }).click();
    await expect(terminalText(page)).toContainText(/sudo hire-marco/i);
    await page.locator(".pos-quick-btn", { hasText: "leave channel" }).click();
    await expect(terminalText(page)).toContainText(/channel closed/i);
    await expect(page.locator(".pos-quick")).toHaveAttribute("aria-label", "quick commands");
  });

  test("every keel chip lands on a real answer (not the 'scrambled' fallback)", async ({ page }) => {
    await boot(page);
    await runCmd(page, "keel");
    const labels = await page.locator(".pos-quick-btn").allInnerTexts();
    for (const l of labels.filter((x) => x !== "leave channel")) {
      await page.locator(".pos-quick-btn", { hasText: l }).click();
      await page.waitForTimeout(150);
    }
    await expect(terminalText(page)).not.toContainText(/scrambled|tide gives no answer|hold the course; marco does the talking|noted in the ship's log/i);
  });

  test("tapping a chip does not steal focus into the keyboard on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await page.locator(".pos-quick-btn", { hasText: "help" }).click();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("INPUT");
  });

  test("chips are thumb-sized on a phone and keyboard operable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    for (const h of await page.locator(".pos-quick-btn").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(43.5);
    await page.locator(".pos-quick-btn").first().focus();
    await page.keyboard.press("Enter");
    await expect(terminalText(page)).toContainText("marco@ponce-os:~$ help");
  });
});
