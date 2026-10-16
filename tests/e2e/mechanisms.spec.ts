import { test, expect } from "@playwright/test";
import { boot, runCmd, terminalText, adminKey, openMenuIfPhone, stubGitHub } from "./helpers";

/* ─────────────────────────────────────────────────────────────────────────────
   MECHANISMS: every function the site claims to have, exercised for real.

   site.spec.ts covers boot, the cast game, input on phones and degradation. This file covers the rest
   of what a visitor can do: each terminal command, Keel, the breach minigame, the easter eggs, the
   language and sound controls, navigation, the resume download, every outbound link, and the two
   fallbacks (no WebGL, reduced motion).
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("terminal: every command", () => {
  // [command, what the output must contain]
  const COMMANDS: Array<[string, RegExp]> = [
    ["help", /available commands[\s\S]*whoami[\s\S]*breach/i],
    ["whoami", /started coding at 10[\s\S]*seton hall pirate/i],
    ["neofetch", /ponce-os 6\.0[\s\S]*b\.s\. computer science/i],
    ["ls", /terminal\/\s+service-log\/\s+case-files\/\s+uplink\/\s+research\/\s+credentials\/\s+contact\/[\s\S]*arcova\.txt\s+papers\.bib\s+motd/i],
    ["ls projects", /CF-001\s+PirateFlow[\s\S]*CF-006\s+TenantE/i],
    ["ls -a", /\.kraken/i],
    ["cat arcova.txt", /shipped a full-stack ai platform/i],
    ["cat motd", /deny by default, ship by friday/i],
    // real BibTeX for both ACM papers: two entries, each with its own DOI, braces balanced
    ["cat papers.bib", /@inproceedings\{[\s\S]*RiskCast[\s\S]*doi\s*=\s*\{10\.1145\/3806007\.3810965\}[\s\S]*@inproceedings\{[\s\S]*BBKR[\s\S]*doi\s*=\s*\{10\.1145\/3806008\.3811702\}/i],
    ["cat secrets.txt", /permission denied \(root only\)/i],
    ["cat .kraken", /you found the hidden file/i],
    ["cat", /usage: cat <file>/i],
    ["cat nope.txt", /permission denied \(nice try\)/i],
    ["history", /cybersecurity consulting intern @ arcova/i],
    ["nmap marco", /22\/tcp\s+open\s+ssh[\s\S]*1337\/tcp\s+open/i],
    ["stack", /languages\s+python/i],
    ["sudo hire-marco", /access granted[\s\S]*marcpon8@gmail\.com/i],
    ["sudo rm -rf /", /zero trust means zero trust/i],
    ["sudo anything", /not in the sudoers file/i],
    ["ssh rtx", /permission denied/i],
    ["ping keel", /first mate of this machine/i],
    ["uname", /ponce-os 5\.0-arcova/i],
    ["pwd", /\/home\/marco/],
    ["echo hello pirate", /hello pirate/],
    ["vim", /no :q!/i],
    ["kraken", /the kraken acknowledges you/i],
    ["gg", /gg wp/],
    ["logout", /logout is retired/i],
    ["exit", /there is no escape/i],
    ["definitely-not-a-command", /command not found: definitely-not-a-command/i],
  ];

  for (const [cmd, expected] of COMMANDS) {
    test(`\`${cmd}\``, async ({ page }) => {
      await boot(page);
      await runCmd(page, cmd);
      await expect(terminalText(page)).toContainText(expected);
    });
  }

  test("`cat papers.bib` keeps its real capitalisation (the terminal is lowercase by design, citations must not be)", async ({ page }) => {
    await boot(page);
    await runCmd(page, "cat papers.bib");
    const t = await terminalText(page).innerText(); // innerText applies CSS text-transform, so this is what a visitor sees and copies
    expect(t).toContain("title     = {RiskCast: Behavioral Risk Forecasting Across Multi-Modal Security Streams}");
    expect(t).toContain("author    = {Anand, S. and Ponce, M. and Duong, D.}");
    expect(t).toContain("booktitle = {ACM IWSPA '26}");
    expect(t).toContain("title     = {BBKR: Behavior-Driven Key Rotation for Zero Trust Network Security}");
    expect(t).toContain("booktitle = {ACM SaT-CPS '26}");
  });

  test("`date` prints the current year", async ({ page }) => {
    await boot(page);
    await runCmd(page, "date");
    await expect(terminalText(page)).toContainText(String(new Date().getFullYear()));
  });

  test("`clear` empties the screen", async ({ page }) => {
    await boot(page);
    await runCmd(page, "whoami");
    await expect(terminalText(page)).toContainText(/started coding/i);
    await runCmd(page, "clear");
    await expect(terminalText(page)).not.toContainText(/started coding/i);
    await expect(page.locator(".pos-term-input input")).toBeVisible();
  });

  test("`lang es` switches the whole site to Spanish and `lang en` switches it back", async ({ page }) => {
    await boot(page);
    await runCmd(page, "lang es");
    await expect(terminalText(page)).toContainText(/idioma cambiado a espanol/i);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator(".pos-tagline")).toContainText(/Construyo sistemas de IA/);
    await runCmd(page, "lang en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator(".pos-tagline")).toContainText(/I build AI systems/);
    await runCmd(page, "lang fr");
    await expect(terminalText(page)).toContainText(/usage: lang es \| lang en/i);
  });

  test("`resume` triggers a real PDF download", async ({ page }) => {
    await boot(page);
    const dl = page.waitForEvent("download");
    await runCmd(page, "resume");
    const download = await dl;
    expect(download.suggestedFilename()).toBe("Marco_Ponce_Resume.pdf");
  });

  test("`matrix` runs the rain and then stops by itself", async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);
    await runCmd(page, "matrix");
    await expect(page.locator(".pos-matrix")).toBeVisible();
    await expect(page.locator(".pos-matrix")).toBeHidden({ timeout: 12_000 });
  });

  test("`scan` reports the visitor's own browser and sends nothing", async ({ page }) => {
    await boot(page);
    const outbound: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith("http://localhost")) outbound.push(r.url()); });
    await page.waitForTimeout(500); // let the uplink's own (stubbed) GitHub calls settle first
    outbound.length = 0;
    await runCmd(page, "scan", 900);
    await expect(terminalText(page)).toContainText(/initiating visitor assessment/i);
    await expect(terminalText(page)).toContainText(/fingerprint\s+0x[0-9a-f]{8}/i);
    await expect(terminalText(page)).toContainText(/data sent\s+0 bytes/i);
    expect(outbound, "scan must not make any request").toEqual([]);
  });

  test("`github` shows live telemetry through the uplink", async ({ page }) => {
    await boot(page);
    await runCmd(page, "github", 900);
    await expect(terminalText(page)).toContainText(/uplink live[\s\S]*12 public repos[\s\S]*7 followers/i);
    await expect(terminalText(page)).toContainText(/ponce-os/);
  });

  test("`music` toggles the synth on and off", async ({ page }) => {
    await boot(page);
    await runCmd(page, "music");
    await expect(terminalText(page)).toContainText(/synthwave engine online/i);
    // the visible SYNTH control reports it (the phone-menu copy of the button is hidden on desktop)
    const phone = (page.viewportSize()?.width ?? 1280) <= 800; // on a phone the only SYNTH button lives in the closed menu sheet
    const synth = page.locator(phone ? '.pos-sheet-ctl button[aria-pressed="true"]' : 'button[aria-pressed="true"]', { hasText: "SYNTH" });
    await expect(phone ? synth : synth.filter({ visible: true })).toHaveCount(1);
    await runCmd(page, "music");
    await expect(terminalText(page)).toContainText(/synthwave engine offline/i);
  });
});

test.describe("terminal: input behaviour", () => {
  test("Tab completes a unique command", async ({ page }) => {
    await boot(page);
    const input = page.locator(".pos-term-input input");
    await input.click();
    await input.fill("whoa");
    await page.keyboard.press("Tab");
    await expect(input).toHaveValue("whoami ");
  });

  test("Tab lists the choices when the prefix is ambiguous", async ({ page }) => {
    await boot(page);
    const input = page.locator(".pos-term-input input");
    await input.click();
    await input.fill("s");
    await page.keyboard.press("Tab");
    await expect(terminalText(page)).toContainText(/su\s+stack\s+scan|sudo|ssh|stack|scan/);
  });

  test("ArrowUp recalls the previous command and ArrowDown goes forward again", async ({ page }) => {
    await boot(page);
    await runCmd(page, "pwd");
    await runCmd(page, "uname");
    const input = page.locator(".pos-term-input input");
    await input.click();
    await page.keyboard.press("ArrowUp");
    await expect(input).toHaveValue("uname");
    await page.keyboard.press("ArrowUp");
    await expect(input).toHaveValue("pwd");
    await page.keyboard.press("ArrowDown");
    await expect(input).toHaveValue("uname");
  });

  test("an empty line does nothing and does not crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await boot(page);
    await runCmd(page, "");
    await runCmd(page, "    ");
    expect(errors).toEqual([]);
  });
});

test.describe("terminal: root access", () => {
  test("a wrong password is refused", async ({ page }) => {
    await boot(page);
    await runCmd(page, "su");
    await runCmd(page, "definitely-wrong");
    await expect(terminalText(page)).toContainText(/su: authentication failure/i);
    await expect(page.locator(".pos-term-title")).toContainText(/guest/i);
  });

  test("the real admin key grants root, secrets open, and exit drops back to guest", async ({ page }) => {
    const key = adminKey();
    test.skip(!key, "no VITE_ADMIN_KEY in .env.local, nothing to authenticate with");
    await boot(page);
    await runCmd(page, "su");
    await runCmd(page, key!);
    await expect(terminalText(page)).toContainText(/root session granted/i);
    await expect(page.locator(".pos-term-title")).toContainText(/root@ponce-os.*admin/i);
    await runCmd(page, "cat secrets.txt");
    await expect(terminalText(page)).toContainText(/root eyes only/i);
    await runCmd(page, "whoami");
    await expect(terminalText(page)).toContainText(/root, but the machine still belongs to marco/i);
    await runCmd(page, "exit");
    await expect(terminalText(page)).toContainText(/root session closed/i);
    await expect(page.locator(".pos-term-title")).toContainText(/guest/i);
  });

  test("the password is never echoed in clear text", async ({ page }) => {
    await boot(page);
    await runCmd(page, "su");
    await runCmd(page, "hunter2-visible-secret");
    await expect(terminalText(page)).not.toContainText("hunter2-visible-secret");
  });
});

test.describe("keel (first mate chat)", () => {
  test("opens a channel, answers, speaks on request and closes", async ({ page }) => {
    await boot(page);
    await runCmd(page, "keel");
    await expect(terminalText(page)).toContainText(/channel open\. keel on deck/i);
    await expect(page.locator(".pos-term-input .ps1")).toHaveText("keel>");

    await runCmd(page, "pirateflow");
    await expect(terminalText(page)).toContainText(/hackathon winner/i);
    await runCmd(page, "how do i hire marco");
    await expect(terminalText(page)).toContainText(/sudo hire-marco/i);
    await runCmd(page, "tell me a joke");
    await expect(terminalText(page).locator(".keel").last()).toBeVisible();
    await runCmd(page, "voice on");
    await expect(terminalText(page)).toContainText(/voice online/i);
    await runCmd(page, "voice off");
    await expect(terminalText(page)).toContainText(/voice offline/i);

    await runCmd(page, "exit");
    await expect(terminalText(page)).toContainText(/channel closed\. fair winds/i);
    await expect(page.locator(".pos-term-input .ps1")).toHaveText("marco@ponce-os:~$");
  });

  test("shell commands do not leak into the chat and the shell returns afterwards", async ({ page }) => {
    await boot(page);
    await runCmd(page, "keel");
    await runCmd(page, "pwd");
    await expect(terminalText(page)).not.toContainText("/home/marco");
    await runCmd(page, "exit");
    await runCmd(page, "pwd");
    await expect(terminalText(page)).toContainText("/home/marco");
  });
});

test.describe("breach minigame", () => {
  test("rejects anything that is not a 4-digit pin", async ({ page }) => {
    await boot(page);
    await runCmd(page, "breach");
    await expect(terminalText(page)).toContainText(/crack the 4-digit pin/i);
    await expect(page.locator(".pos-term-input .ps1")).toHaveText("breach>");
    await runCmd(page, "abc");
    await expect(terminalText(page)).toContainText(/firewall expects a 4-digit pin/i);
    await runCmd(page, "12");
    await expect(terminalText(page).locator(".warn")).toHaveCount(2);
  });

  test("its feedback is correct: checked against the pin it reveals on abort", async ({ page }) => {
    await boot(page);
    await runCmd(page, "breach");
    await runCmd(page, "1234");
    const body = (await terminalText(page).innerText()).toLowerCase();
    const m = body.match(/(\d) right & in place · (\d) right digit, wrong spot · (\d) tries left/);
    expect(m, "feedback line").not.toBeNull();
    await runCmd(page, "exit");
    const pin = (await terminalText(page).innerText()).match(/the pin was (\d{4})/i)?.[1];
    expect(pin, "revealed pin").toBeDefined();
    // recompute the two numbers independently
    const guess = "1234";
    let exact = 0, present = 0;
    const pl: string[] = [], gl: string[] = [];
    for (let i = 0; i < 4; i++) { if (guess[i] === pin![i]) exact++; else { pl.push(pin![i]); gl.push(guess[i]); } }
    for (const c of gl) { const k = pl.indexOf(c); if (k !== -1) { present++; pl.splice(k, 1); } }
    expect([Number(m![1]), Number(m![2]), Number(m![3])]).toEqual([exact, present, 5]);
  });

  test("six wrong guesses lock you out (0000 can never be right: the pin has 4 different digits)", async ({ page }) => {
    await boot(page);
    await runCmd(page, "breach");
    for (let i = 0; i < 6; i++) await runCmd(page, "0000", 200);
    await expect(terminalText(page)).toContainText(/lockout/i);
    await expect(page.locator(".pos-term-input .ps1")).toHaveText("marco@ponce-os:~$");
  });
});

test.describe("easter eggs", () => {
  test("the konami code releases the penguins and then they leave", async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);
    await page.locator("body").click({ position: { x: 5, y: 200 } });
    for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]) await page.keyboard.press(k);
    await expect(page.locator(".pos-penguin-msg")).toContainText(/achievement unlocked/i);
    await expect(page.locator(".pos-penguins")).toBeHidden({ timeout: 12_000 });
  });
});

test.describe("controls", () => {
  test("language toggle flips EN <-> ES and the document language follows", async ({ page, isMobile }) => {
    await boot(page);
    await openMenuIfPhone(page);
    const btn = isMobile ? page.locator(".pos-sheet-ctl button").first() : page.locator('.pos-status-right button[aria-label="switch language"]');
    await btn.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator(".pos-tagline")).toContainText(/Construyo sistemas/);
    await btn.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("sound and synth buttons report their state (aria-pressed)", async ({ page, isMobile }) => {
    await boot(page);
    await openMenuIfPhone(page);
    const scope = isMobile ? page.locator(".pos-sheet-ctl") : page.locator(".pos-status-right");
    const snd = scope.locator("button", { hasText: "SND" });
    const synth = scope.locator("button", { hasText: "SYNTH" });
    await expect(snd).toHaveAttribute("aria-pressed", "false");
    await snd.click();
    await expect(snd).toHaveAttribute("aria-pressed", "true");
    await snd.click();
    await expect(snd).toHaveAttribute("aria-pressed", "false");
    await synth.click();
    await expect(synth).toHaveAttribute("aria-pressed", "true");
    await synth.click();
    await expect(synth).toHaveAttribute("aria-pressed", "false");
  });

  test("the clock ticks", async ({ page }) => {
    await boot(page);
    const clock = page.locator(".pos-clock");
    test.skip(!(await clock.isVisible()), "the clock is hidden on phones");
    const a = await clock.textContent();
    await page.waitForTimeout(2200);
    expect(await clock.textContent()).not.toBe(a);
  });
});

test.describe("content and links", () => {
  test("the hero tells a recruiter who, what and how to reach me", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator("h1")).toContainText("Marco Ponce");
    await expect(page.locator(".pos-tagline")).toContainText("I build AI systems that respect Zero Trust.");
    await expect(page.locator(".pos-proof li")).toHaveCount(4);
    // The resume / calendar / email buttons used to repeat here AND in Contact; they now live only in
    // Contact (see quick-actions.spec.ts). The hero keeps the profile links and the nav leads to Contact.
    await expect(page.locator(".pos-hero .pos-links a[href='https://github.com/poncema4']")).toHaveCount(1);
    await expect(page.locator(".pos-hero .pos-links a[href*='linkedin.com/in/ponce-marco']")).toHaveCount(1);
    await expect(page.locator("#contact a[href='/Marco_Ponce_Resume.pdf']")).toHaveAttribute("download", "Marco_Ponce_Resume.pdf");
    await expect(page.locator("#contact a[href*='calendly.com/ponce-marco']")).toHaveCount(1);
    await expect(page.locator("#contact a[href='mailto:marcpon8@gmail.com']")).toHaveCount(1);
  });

  test("the resume link serves a real, current PDF", async ({ page, request }) => {
    await boot(page);
    const res = await request.get("/Marco_Ponce_Resume.pdf");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
    const body = await res.body();
    expect(body.length).toBeGreaterThan(50_000);
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("every external link is safe (noopener) and points where it says", async ({ page }) => {
    await boot(page);
    const links = await page.locator("a[target=_blank]").evaluateAll((as) => as.map((a) => ({ href: (a as HTMLAnchorElement).href, rel: a.getAttribute("rel") || "" })));
    expect(links.length).toBeGreaterThan(10);
    for (const l of links) {
      expect(l.rel, `rel on ${l.href}`).toMatch(/noopener/);
      expect(l.href, "external links are https").toMatch(/^https:\/\//);
    }
    const hrefs = links.map((l) => l.href);
    for (const must of ["https://github.com/poncema4", "https://www.linkedin.com/in/ponce-marco/", "https://calendly.com/ponce-marco/nj", "https://github.com/poncema4/PirateFlow", "https://github.com/arc53/DocsGPT", "https://doi.org/10.1145/3806007.3810965", "https://doi.org/10.1145/3806008.3811702"]) {
      expect(hrefs, must).toContain(must);
    }
  });

  test("six case files, each with its proof visible (nothing hidden behind hover)", async ({ page }) => {
    await boot(page);
    await page.locator("#case-files").scrollIntoViewIfNeeded();
    await expect(page.locator(".pos-file")).toHaveCount(6);
    await page.waitForTimeout(2600); // the declassify animation plays once as the cards arrive
    const lines = page.locator(".pos-redact");
    expect(await lines.count()).toBeGreaterThanOrEqual(15);
    // after the animation no redaction bar is left covering a fact
    const covering = await page.locator(".pos-redact").evaluateAll((els) =>
      els.filter((el) => {
        const cs = getComputedStyle(el, "::after");
        return parseFloat(cs.opacity) > 0.05 && cs.transform !== "none" && cs.transform !== "matrix(0, 0, 0, 1, 0, 0)";
      }).length);
    expect(covering, "redaction bars still covering text").toBe(0);
    await expect(page.locator(".pos-redact span").first()).toBeVisible();
  });

  test("experience: key roles open, the rest one click away, all ten present", async ({ page }) => {
    await boot(page);
    await page.locator("#service-log").scrollIntoViewIfNeeded();
    await expect(page.locator(".pos-log-entry:visible")).toHaveCount(4);
    await expect(page.locator("#service-log")).toContainText(/Cybersecurity Consulting Intern/);
    const summary = page.locator(".pos-more > summary");
    await expect(summary).toContainText(/6 earlier, research and teaching roles/);
    await summary.click();
    await expect(page.locator(".pos-log-entry:visible")).toHaveCount(10);
    await expect(page.locator("#service-log")).toContainText(/Game Developer/);
    await summary.click();
    await expect(page.locator(".pos-log-entry:visible")).toHaveCount(4);
  });

  test("numbers in the bullets are highlighted", async ({ page }) => {
    await boot(page);
    const metrics = await page.locator("#service-log strong.m").allTextContents();
    expect(metrics.join(" ")).toMatch(/300\+/);
    expect(metrics.join(" ")).toMatch(/95%/);
  });

  test("research (2 papers) and credentials (14 + 1) are all there", async ({ page }) => {
    await boot(page);
    await expect(page.locator(".pos-paper")).toHaveCount(2);
    await expect(page.locator(".pos-cert")).toHaveCount(15);
    await expect(page.locator(".pos-cert.aws")).toHaveCount(1);
  });

  test("the uplink renders live GitHub data and the globe canvas exists", async ({ page }) => {
    await boot(page);
    await page.locator("#uplink").scrollIntoViewIfNeeded();
    await expect(page.locator(".pos-uplink")).toContainText(/12 public repos/);
    await expect(page.locator(".pos-uplink-repo")).toHaveCount(1);
    await expect(page.locator(".pos-globe")).toBeVisible();
  });
});

test.describe("fallbacks", () => {
  test("no WebGL: the site still works and the 2D constellation takes over", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (/webgl/i.test(type)) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (orig as any).call(this, type, ...rest);
      } as typeof orig;
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await boot(page);
    await expect(page.locator(".pos-constellation")).toBeAttached();
    await runCmd(page, "whoami");
    await expect(terminalText(page)).toContainText(/started coding/i);
    expect(errors).toEqual([]);
  });

  test("reduced motion: skips the boot, no 3D scene, content fully visible", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await stubGitHub(page);
    await page.goto("/");
    await expect(page.locator("input").first()).toBeVisible({ timeout: 5000 }); // no boot sequence to wait for
    await expect(page.locator(".pos-scene3d")).toHaveCount(0);
    await expect(page.locator(".pos-constellation")).toBeAttached();
    // nothing is stuck invisible waiting for a scroll reveal
    const hidden = await page.locator(".pos-reveal").evaluateAll((els) => els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 1).length);
    expect(hidden).toBe(0);
    await ctx.close();
  });
});

test.describe("boot", () => {
  test("any key skips the boot sequence", async ({ page }) => {
    await stubGitHub(page);
    await page.goto("/");
    await page.waitForSelector(".pos-boot");
    await page.keyboard.press("Space");
    await expect(page.locator("input").first()).toBeVisible({ timeout: 3000 });
  });

  test("once booted, a reload in the same session goes straight to the site", async ({ page }) => {
    await boot(page);
    await page.reload();
    await expect(page.locator("input").first()).toBeVisible({ timeout: 4000 });
    await expect(page.locator(".pos-boot")).toHaveCount(0);
  });

  test("`reboot` clears that and plays the boot again", async ({ page }) => {
    await boot(page, { playBoot: true }); // about the boot itself: do not pre-seed the booted flag
    await runCmd(page, "reboot", 100);
    await page.waitForSelector(".pos-boot", { timeout: 8000 });
    await expect(page.locator(".pos-boot-inner")).toContainText(/PONCE-OS 6\.0/);
  });
});

test.describe("navigation", () => {
  const SECTIONS = ["terminal", "service-log", "case-files", "uplink", "research", "credentials", "contact"];

  for (const id of SECTIONS) {
    test(`nav -> #${id} lands with the heading visible, below the sticky bar`, async ({ page }) => {
      await boot(page);
      await openMenuIfPhone(page);
      const link = page.locator(`.pos-nav a[href="#${id}"], .pos-sheet a[href="#${id}"]`).filter({ visible: true });
      await link.first().click();
      const measure = () => page.evaluate((sid) => {
        const sec = document.getElementById(sid)!;
        const h = sec.querySelector("h2")!.getBoundingClientRect();
        const bar = document.querySelector(".pos-statusbar")!.getBoundingClientRect();
        return { headTop: h.top, headBottom: h.bottom, barBottom: bar.bottom, vh: innerHeight };
      }, id);
      // smooth scroll is slow under software rendering: poll until the heading has actually landed
      await expect.poll(async () => { const r = await measure(); return r.headBottom <= r.vh; }, { message: "heading must be on screen", timeout: 15_000 }).toBe(true);
      const r = await measure();
      expect(r.headTop, "heading must not hide under the bar").toBeGreaterThanOrEqual(r.barBottom - 1);
      await expect(page.locator(".pos-sheet")).toBeHidden(); // phone menu closes after a tap (always hidden on desktop)
    });
  }

  test("the nav beacon lights the section you are in", async ({ page, isMobile }) => {
    test.skip(isMobile, "the beacon is also in the phone menu; the desktop bar shows it directly");
    await boot(page);
    await page.locator("#case-files").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById("case-files")!.scrollIntoView());
    await page.waitForTimeout(900);
    await expect(page.locator('.pos-nav a[href="#case-files"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('.pos-nav a[href="#research"]')).not.toHaveClass(/\bon\b/);
  });

  test("the title link scrolls back to the top", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => document.getElementById("contact")!.scrollIntoView());
    await page.waitForTimeout(600);
    await page.locator(".pos-host").click();
    await expect.poll(() => page.evaluate(() => scrollY), { message: "smooth scroll back to the top", timeout: 15_000 }).toBeLessThan(40);
  });
});
