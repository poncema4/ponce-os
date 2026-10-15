import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Deterministic stand-ins for the live GitHub API (60 req/hr unauthenticated would make the suite flaky). */
const GH_USER = { login: "poncema4", name: "Marco Ponce", public_repos: 12, followers: 7, created_at: "2019-01-01T00:00:00Z" };
const GH_REPOS = [{ name: "ponce-os", description: "this site", language: "TypeScript", stargazers_count: 1, html_url: "https://github.com/poncema4/ponce-os", pushed_at: "2026-07-16T12:00:00Z" }];
const GH_EVENTS = [{ type: "PushEvent", repo: { name: "poncema4/ponce-os" }, created_at: "2026-07-16T12:00:00Z" }];

export async function stubGitHub(page: Page) {
  await page.route("https://api.github.com/**", (route) => {
    const url = route.request().url();
    const body = url.includes("/repos") ? GH_REPOS : url.includes("/events") ? GH_EVENTS : GH_USER;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

/** Load the site and wait until the boot sequence is over and the terminal input exists. */
export async function boot(page: Page) {
  await stubGitHub(page);
  await page.goto("/");
  const term = page.locator("input").first();
  await term.waitFor({ state: "visible", timeout: 30_000 });
  return term;
}

/** Type a line into the terminal and press Enter. */
export async function runCmd(page: Page, cmd: string, settle = 300) {
  const input = page.locator(".pos-term-input input");
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await input.fill(cmd);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(settle);
}

export const terminalText = (page: Page) => page.locator(".pos-term-body");

/** The admin key lives in .env.local (gitignored). The test reads it; it is never written into a log or the repo. */
export function adminKey(): string | null {
  try {
    const env = fs.readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8");
    return env.match(/^VITE_ADMIN_KEY=(.+)$/m)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Open the phone menu if the viewport is small enough that the nav lives in it. */
export async function openMenuIfPhone(page: Page) {
  const btn = page.locator(".pos-menu-btn");
  if (await btn.isVisible()) {
    if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
    await expect(page.locator(".pos-sheet")).toBeVisible();
  }
}
