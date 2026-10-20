import { test, expect, type Route } from "@playwright/test";

const now = Date.now();
const mk = (n: number, topic: "cyber" | "ai", extra: Record<string, unknown> = {}) => ({
  id: `${topic}${n}`, title: `${topic} story ${n}`, url: `https://example.com/${topic}/${n}`, source: "Test Feed",
  topic, published: now - n * 3_600_000, snippet: `snippet ${n}`, ...extra,
});
// 45 stories, 3 pages of 20: the fake API pages, filters and searches like the real one.
const ALL = Array.from({ length: 45 }, (_, n) => mk(n, n % 3 === 0 ? "ai" : "cyber", n === 0 ? { flag: "model", title: "Introducing Claude Opus 9" } : {}));
const base = { generated: now, perPage: 20, archive: { ok: true, count: 45, updated: now }, sources: [{ id: "a", name: "Test Feed", ok: true, count: 45 }, { id: "b", name: "Dead Feed", ok: false, count: 0 }] };

async function fakeApi(route: Route) {
  const u = new URL(route.request().url());
  const topic = u.searchParams.get("topic");
  const q = (u.searchParams.get("q") ?? "").toLowerCase();
  const hit = ALL.filter((i) => (topic === "ai" || topic === "cyber" ? i.topic === topic : true) && i.title.toLowerCase().includes(q));
  const pages = Math.max(1, Math.ceil(hit.length / 20));
  const page = Math.min(pages, Math.max(1, Number(u.searchParams.get("page")) || 1));
  await route.fulfill({ json: { ...base, total: hit.length, page, pages, items: hit.slice((page - 1) * 20, page * 20) } });
}

test("cyber brief lists posts, pages through them and searches", async ({ page }) => {
  await page.route("**/api/cyber-brief*", fakeApi);
  await page.goto("/cyber");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The day in security and AI");
  await expect(page).toHaveTitle("Marco Ponce"); // same tab title as the rest of the site
  await expect(page.locator(".cb-post")).toHaveCount(20);
  await expect(page.locator(".cb-badge.model")).toHaveText("NEW MODEL");
  const link = page.locator(".cb-post h3 a").first();
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByText("Dead Feed - unavailable right now")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".cb-pager [aria-current=page]")).toHaveText("2");
  await page.getByRole("button", { name: "Page 3" }).click();
  await expect(page.locator(".cb-post")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  await page.getByLabel("Search the archive").fill("ai story 12");
  await expect(page.locator(".cb-post")).toHaveCount(1);
  await page.getByLabel("Search the archive").fill("nothing like this");
  await expect(page.getByText("No stories match that")).toBeVisible();
});

test("cyber brief long lists show 1 2 3 4, a jump box and the last page; typing a page number jumps there", async ({ page }) => {
  const pageOf = (r: Route) => Number(new URL(r.request().url()).searchParams.get("page")) || 1;
  await page.route("**/api/cyber-brief*", (r) => r.fulfill({ json: { ...base, total: 2000, page: pageOf(r), pages: 100, items: ALL.slice(0, 20) } }));
  await page.goto("/cyber");
  await expect(page.locator(".cb-post")).toHaveCount(20);
  const labels = () => page.locator(".cb-pager > button, .cb-pager > span").allTextContents();
  expect(await labels()).toEqual(["Previous", "1", "2", "3", "4", "100", "Next"]);
  const jump = page.getByLabel(/Go to page/);
  await expect(jump).toBeVisible();
  await jump.fill("57");
  await jump.press("Enter");
  await expect(page).toHaveURL(/page=57/);
  await expect(page.locator(".cb-pager [aria-current=page]")).toHaveText("57");
  expect(await labels()).toEqual(["Previous", "1", "...", "56", "57", "58", "100", "Next"]);
  await page.getByLabel(/Go to page/).fill("9999");   // past the end: clamps to the last page
  await page.getByLabel(/Go to page/).press("Enter");
  await expect(page).toHaveURL(/page=100/);
  await page.getByLabel(/Go to page/).fill("abc");    // letters are ignored entirely
  await expect(page.getByLabel(/Go to page/)).toHaveValue("");
});

test("cyber brief fits a phone, in Spanish too, and shows a retry state when the API is down", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/cyber-brief*", (r) => r.fulfill({ status: 503, json: { error: "x" } }));
  await page.goto("/cyber");
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await page.unroute("**/api/cyber-brief*");
  await page.route("**/api/cyber-brief*", fakeApi);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator(".cb-post")).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Cambiar a espanol" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("El dia en seguridad e IA");
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeVisible();
});
