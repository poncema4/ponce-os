import { test, expect, type Page } from "@playwright/test";
import { boot } from "./helpers";

/* ─────────────────────────────────────────────────────────────────────────────
   CAST: the fishing minigame. site.spec.ts already covers opening it, the telegraph, space-spam and
   ESC. This file covers what the rebuild added or fixed: it behaves like a real dialog (focus, Tab
   trap, no page scroll behind it), you can play it by tapping the water, the fish journal and the
   flag, and a complete catch from cast to journal.
   ──────────────────────────────────────────────────────────────────────────── */

const FLAG = "ponce{d33p-w4t3r-4ngl3r}";

async function openGame(page: Page) {
  await page.locator(".cast-launch").scrollIntoViewIfNeeded();
  await page.locator(".cast-launch").click();
  await expect(page.locator(".cast-panel")).toBeVisible();
}

async function withStats(page: Page, stats: Record<string, unknown>) {
  await page.addInitScript((s) => localStorage.setItem("ponce-os:cast:stats", JSON.stringify(s)), stats);
}

test.describe("cast: it behaves like a real dialog", () => {
  test("focus moves into the game, the page behind does not scroll, and focus returns on close", async ({ page }) => {
    await boot(page);
    await page.locator(".cast-launch").focus();
    await openGame(page);
    await expect(page.locator(".cast-wrap")).toHaveAttribute("aria-modal", "true");
    await expect(page.locator(".cast-btn")).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator(".cast-panel")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect(page.locator(".cast-launch")).toBeFocused();
  });

  test("Tab and Shift+Tab never leave the dialog", async ({ page }) => {
    await boot(page);
    await openGame(page);
    const inside = () => page.evaluate(() => !!document.activeElement?.closest(".cast-panel"));
    for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); expect(await inside(), `after Tab #${i + 1}`).toBe(true); }
    for (let i = 0; i < 8; i++) { await page.keyboard.press("Shift+Tab"); expect(await inside(), `after Shift+Tab #${i + 1}`).toBe(true); }
  });

  test("clicking outside the panel closes it", async ({ page }) => {
    await boot(page);
    await openGame(page);
    await page.locator(".cast-wrap").click({ position: { x: 4, y: 4 } });
    await expect(page.locator(".cast-panel")).toHaveCount(0);
  });

  test("every control inside is a thumb-sized target", async ({ page }) => {
    await boot(page);
    await openGame(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll(".cast-panel button")].map((b) => { const r = b.getBoundingClientRect(); return { n: (b.textContent || "").trim().slice(0, 18), h: Math.round(r.height), w: Math.round(r.width) }; })
        .filter((b) => b.h < 43.5 || b.w < 43.5));
    expect(small, "controls smaller than 44px").toEqual([]);
  });

  test("the dialog never overflows the screen", async ({ page }) => {
    await boot(page);
    await openGame(page);
    const vp = page.viewportSize()!;
    const box = (await page.locator(".cast-panel").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
  });
});

test.describe("cast: playing", () => {
  test("tapping the water casts (you do not need the button, or a keyboard)", async ({ page }) => {
    await boot(page);
    await openGame(page);
    await expect(page.locator(".cast-btn")).toHaveText("CAST");
    await page.locator(".cast-cv").click({ position: { x: 120, y: 60 } });
    await expect(page.locator(".cast-btn")).toHaveText(/casting|waiting for a bite/i);
  });

  test("space casts too, and the page behind does not scroll", async ({ page }) => {
    await boot(page);
    await openGame(page);
    const y0 = await page.evaluate(() => scrollY);
    await page.keyboard.press("Space");
    await expect(page.locator(".cast-btn")).toHaveText(/casting|waiting for a bite/i);
    expect(await page.evaluate(() => scrollY)).toBe(y0);
  });

  test("striking before the bite spooks the fish", async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);
    await openGame(page);
    await page.keyboard.press("Space");
    await expect(page.locator(".cast-btn")).toHaveText(/something's coming|waiting for a bite/i, { timeout: 15_000 });
    await page.keyboard.press("Space"); // too early
    await expect(page.locator(".cast-msg")).toContainText(/struck too early/i);
  });

  test("typing a name with a space in the leaderboard box does not cast", async ({ page }) => {
    await boot(page);
    await withStats(page, { catches: 1, species: ["sardine"], bestStreak: 1, legendary: 0, phish: 0, flag: false });
    await page.reload();
    await page.locator("input").first().waitFor();
    await openGame(page);
    // the name box only exists once you have a score, so type a space from an input the handler must ignore
    await page.evaluate(() => {
      const i = document.createElement("input");
      i.id = "probe"; document.querySelector(".cast-panel")!.appendChild(i); i.focus();
    });
    await page.keyboard.press("Space");
    await page.waitForTimeout(800);
    await expect(page.locator(".cast-btn")).toHaveText("CAST");
  });
});

test.describe("cast: the fish journal", () => {
  test("starts empty: 23 mystery species, nothing earned, no flag", async ({ page }) => {
    await boot(page);
    await openGame(page);
    await page.locator(".cast-link", { hasText: /journal/i }).click();
    await expect(page.locator(".cast-journal")).toBeVisible();
    await expect(page.locator(".cast-sp")).toHaveCount(23);
    await expect(page.locator(".cast-sp.got")).toHaveCount(0);
    await expect(page.locator(".cast-journal")).toContainText("0 / 23 species");
    await expect(page.locator(".cast-ach li")).toHaveCount(9);
    await expect(page.locator(".cast-ach li.done")).toHaveCount(0);
    await expect(page.locator(".cast-flag")).toHaveCount(0);
    await expect(page.locator(".cast-cv")).toBeHidden(); // the water is hidden while a panel is open
  });

  test("shows what you have caught, and the flag once six species are logged", async ({ page }) => {
    await withStats(page, { catches: 9, species: ["sardine", "crab", "shrimp", "reef snapper", "squid", "WHALE", "old boot"], bestStreak: 5, legendary: 1, phish: 0, flag: true });
    await boot(page);
    await openGame(page);
    await page.locator(".cast-link", { hasText: /journal/i }).click();
    await expect(page.locator(".cast-journal")).toContainText("7 / 23 species");
    await expect(page.locator(".cast-sp.got")).toHaveCount(7);
    await expect(page.locator(".cast-journal")).toContainText("WHALE");
    await expect(page.locator(".cast-flag")).toContainText(FLAG);
    const done = await page.locator(".cast-ach li.done").allTextContents();
    expect(done.join(" ")).toMatch(/First catch/);
    expect(done.join(" ")).toMatch(/Hot streak/);
    expect(done.join(" ")).toMatch(/Legend hunter/);
    expect(done.join(" ")).toMatch(/Deep-water flag/);
    expect(done.join(" ")).not.toMatch(/Completionist/);
  });

  test("progress saved by the old version still counts (species-only key)", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ponce-os:cast:caught", JSON.stringify(["sardine", "crab", "shrimp", "reef snapper", "squid", "lobster"])));
    await boot(page);
    await openGame(page);
    await page.locator(".cast-link", { hasText: /journal/i }).click();
    await expect(page.locator(".cast-journal")).toContainText("6 / 23 species");
    await expect(page.locator(".cast-flag")).toContainText(FLAG);
  });

  test("journal and leaderboard swap places, and 'back to the water' returns to the game", async ({ page }) => {
    await boot(page);
    await openGame(page);
    const board = page.locator(".cast-link").first();
    const journal = page.locator(".cast-link").nth(1);
    await journal.click();
    await expect(page.locator(".cast-journal")).toBeVisible();
    await board.click();
    await expect(page.locator(".cast-board")).toBeVisible();
    await expect(page.locator(".cast-journal")).toHaveCount(0);
    await board.click(); // "back to the water"
    await expect(page.locator(".cast-board")).toHaveCount(0);
    await expect(page.locator(".cast-cv")).toBeVisible();
  });

  test("a corrupt save does not break the game", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => { localStorage.setItem("ponce-os:cast:stats", "{not json"); localStorage.setItem("ponce-os:cast:caught", "also not json"); });
    await boot(page);
    await openGame(page);
    await page.locator(".cast-link", { hasText: /journal/i }).click();
    await expect(page.locator(".cast-journal")).toContainText("0 / 23 species");
    expect(errors).toEqual([]);
  });
});

test.describe("cast: a complete catch", () => {
  test("cast -> bite -> hook -> reel -> land: score, journal and storage all update", async ({ page }) => {
    test.slow();
    test.setTimeout(150_000);
    // a fixed random stream makes the fish, the wait and the species repeatable
    await page.addInitScript(() => { Math.random = () => 0.5; });
    await boot(page);
    await openGame(page);
    await page.keyboard.press("Space");                                    // cast

    // wait for the bite, then strike
    await expect(page.locator(".cast-btn")).toHaveText("HOOK IT", { timeout: 45_000 });
    await page.keyboard.press("Space");                                    // hook
    await expect(page.locator(".cast-btn")).toHaveText("HOLD TO REEL");

    // reel: hold space when the needle is low, let go when it is high, until the fish lands
    let landed = false;
    for (let i = 0; i < 600 && !landed; i++) {
      const left = await page.evaluate(() => {
        const n = document.querySelector<HTMLElement>(".cast-needle");
        return n ? parseFloat(n.style.left) : null;
      });
      if (left === null || Number.isNaN(left)) { landed = (await page.locator(".cast-card").count()) > 0; }
      else if (left < 56) await page.keyboard.down("Space");
      else await page.keyboard.up("Space");
      if (!landed) await page.waitForTimeout(40);
    }
    await page.keyboard.up("Space");
    await expect(page.locator(".cast-card")).toBeVisible({ timeout: 15_000 });

    // what the player sees
    const msg = (await page.locator(".cast-msg").textContent()) || "";
    expect(msg).toMatch(/[+-]\d+/);
    const score = Number((await page.locator(".cast-stats b").first().textContent()) || "0");
    expect(score).toBeGreaterThan(0);
    await expect(page.locator(".cast-btn")).toHaveText(/CAST AGAIN|\.\.\./);

    // what got saved
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ponce-os:cast:stats") || "{}"));
    expect(saved.catches).toBe(1);
    expect(saved.species).toHaveLength(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ponce-os:cast:caught") || "[]"))).toEqual(saved.species);

    // and the journal shows it
    await page.locator(".cast-link", { hasText: /journal/i }).click();
    await expect(page.locator(".cast-journal")).toContainText("1 / 23 species");
    await expect(page.locator(".cast-sp.got")).toHaveCount(1);
    await expect(page.locator(".cast-ach li.done")).toHaveCount(1); // "First catch"
  });
});

test.describe("cast: sound toggle", () => {
  test("playing with sound on does not throw (audio and haptics are optional and guarded)", async ({ page, isMobile }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await boot(page);
    // turn sound on through whichever control this layout has
    if (isMobile) { await page.locator(".pos-menu-btn").click(); await page.locator(".pos-sheet-ctl button", { hasText: "SND" }).click(); await page.locator(".pos-menu-btn").click(); }
    else await page.locator('.pos-status-right button', { hasText: "SND" }).click();
    await openGame(page);
    await page.keyboard.press("Space");
    await page.waitForTimeout(1500);
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
});
