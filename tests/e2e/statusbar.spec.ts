// The sticky status bar must never clip its own content, at ANY width. Regression: between 821 and ~950 px the
// full nav + buttons were wider than the bar and the right-hand buttons were cut off the screen.
import { test, expect } from "@playwright/test";
import { boot } from "./helpers";

const WIDTHS = [320, 360, 390, 600, 768, 820, 850, 899, 900, 901, 960, 1000, 1024, 1100, 1101, 1180, 1181, 1280, 1440, 1920];

test("the status bar fits at every width, and swaps nav for the hamburger at 900px", async ({ page, isMobile }) => {
  test.skip(isMobile, "sweeps its own viewport sizes on the desktop project");
  await boot(page);
  const failures: string[] = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(120);
    const m = await page.evaluate(() => {
      const bar = document.querySelector(".pos-statusbar") as HTMLElement;
      const vis = (sel: string) => { const e = document.querySelector(sel) as HTMLElement | null; return !!e && getComputedStyle(e).display !== "none"; };
      // the right-most thing a visitor can tap in the bar
      let right = 0;
      bar.querySelectorAll<HTMLElement>("a, button").forEach((e) => { if (e.offsetParent !== null && !e.closest(".pos-sheet")) right = Math.max(right, e.getBoundingClientRect().right); });
      return { clipped: bar.scrollWidth - bar.clientWidth, right, vw: innerWidth, nav: vis(".pos-nav"), burger: vis(".pos-menu-btn"), docOverflow: document.documentElement.scrollWidth - innerWidth };
    });
    if (m.clipped > 1) failures.push(`${w}px: bar content is ${m.clipped}px wider than the bar`);
    if (m.right > m.vw + 0.5) failures.push(`${w}px: a control sits ${Math.round(m.right - m.vw)}px off the right edge`);
    if (m.docOverflow > 0) failures.push(`${w}px: page scrolls sideways by ${m.docOverflow}px`);
    if (w <= 900 && (m.nav || !m.burger)) failures.push(`${w}px: expected the hamburger and no inline nav`);
    if (w > 900 && (!m.nav || m.burger)) failures.push(`${w}px: expected the inline nav and no hamburger`);
  }
  expect(failures).toEqual([]);
});

test("the palette button and clock only show where there is room for them", async ({ page, isMobile }) => {
  test.skip(isMobile, "sweeps its own viewport sizes on the desktop project");
  await boot(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".pos-palbtn")).toBeVisible();
  await expect(page.locator(".pos-clock")).toBeVisible();
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator(".pos-palbtn")).toBeHidden();
  await expect(page.locator(".pos-clock")).toBeHidden();
  // Ctrl+K still works when the button is hidden
  await page.keyboard.press("Control+k");
  await expect(page.locator(".pos-pal")).toBeVisible();
});
