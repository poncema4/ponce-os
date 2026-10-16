# How ponce-os is tested

Latest pass/fail numbers live in [`TEST_RESULTS.md`](./TEST_RESULTS.md). This file is the
*how* and the *why*. ponce-os owns its test dependencies outright — it never borrows from
another project.

## Run everything

```bash
npm test            # unit + e2e (this is the pre-push gate)
```

## Run one layer

```bash
npm run test:unit   # Vitest — pure logic, ~1s
npm run test:e2e    # Playwright — real browser, desktop + mobile, ~5-7 min
```

`test:e2e` builds the **production bundle** and serves it, so what gets tested is what
Vercel actually ships. `vite dev` tolerates things the production build rejects — that is
why the e2e suite never points at the dev server.

## Security headers

`vercel.json` sends the CSP and friends, but `vite preview` does not. To test under the real headers,
serve `dist/` with a tiny server that applies `vercel.json` (see `SECURITY.md`) on port 4173 before
running Playwright; `reuseExistingServer` will pick it up.

## Also run before pushing

```bash
npx tsc --noEmit -p tsconfig.app.json   # typecheck
npm run build                            # production build must succeed
```

## The two local servers are NOT interchangeable

| Port | Command | Serves `/api`? | Use for |
|---|---|---|---|
| **:8080** | `npm run dev` | ❌ **no** | UI / game work (fast HMR) |
| **:3100** | `npx vercel dev --listen 3100` | ✅ **yes** | anything touching the leaderboard |

**The trap:** on `:8080` the leaderboard does not error. It silently falls back to
localStorage — the board populates, scores persist, everything *looks* correct. That
fallback is deliberate (the game must survive a backend outage), but it means **:8080 can
never tell you whether the backend works.** Use `:3100`, or:

```bash
curl -s http://localhost:3100/api/leaderboard
```

`vercel dev` needs the project linked first, or it 503s:

```bash
npx vercel link --project poncema4-github-io
npx vercel env pull .env.local     # never hand-paste secrets
```

Do **not** run `vercel dev --yes` unlinked — it silently *creates a new junk project*
rather than linking, and the function then runs with an empty env.

## Test layers, and why each exists

**Unit (Vitest) — `src/**/*.test.ts`**
Pure, deterministic logic only. The catch table, weighted selection, board ranking, name
sanitising. The load-bearing one is the **difficulty→points invariant**: a harder fish must
always score more. That rule is easy to break silently while tuning, and no visual check
would catch it.

**E2E (Playwright) — `tests/e2e/`**
Every test runs on **both** projects: `desktop` (Desktop Chrome) and `mobile` (Pixel 5).

| Spec | What it proves |
|---|---|
| `site.spec.ts` | shell boots, `help`/`whoami`, cast launch + a11y basics, mobile tap-to-focus chain, leaderboard fallback, GitHub degradation, `breach`, resume PDF, clean console |
| `mechanisms.spec.ts` | every terminal command, the `keel` assistant, `breach`, konami + matrix, `scan` privacy, resume download, every link, nav landing below the sticky bar, fallbacks, boot |
| `design.spec.ts` | layout at 5 sizes (1440, 1024, 768, 390, 360): nothing covered, no sideways scroll, sticky bar, 44px tap targets, contrast, skip link, landmarks, privacy, self-hosted fonts |
| `fishing.spec.ts` | the game as a real dialog (focus trap, scroll lock, focus return), tap/space/button input, early strikes spook the fish, the fish journal and flag, corrupt-save recovery, a full cast-to-land catch |
| `memory.spec.ts` | returning-visitor welcome, discoveries, captain's log dialog, the `fire` cannons, corrupt-save safety |
| `quick-actions.spec.ts` | hero declutter (resume/calendar/email stay in Contact), the phone hamburger (three lines, accessible name, becomes an X, thumb-sized), one-tap preset messages in the shell and in `keel`, no focus steal on phones |
| `helpers.ts` | shared `boot`, `runCmd`, `openMenuIfPhone` |

Smooth-scroll and CSS transitions are slow under software rendering, so landing/transition
checks **poll** (`expect.poll`) instead of sleeping for a fixed time.

**Running locally on a machine Playwright's own browser installer refuses**
This repo's Playwright wants a specific Chromium revision. If the installer refuses your OS,
point a local, uncommitted config at a Chromium you already have and add the SwiftShader
flags for WebGL (see `playwright.local.config.ts` if you made one, kept in `.git/info/exclude`):

```bash
npx playwright test -c playwright.local.config.ts
```

A full run under software rendering takes ~25-30 min (it is ~6-7 s per test). **Never run
`vite build` into `dist/` while an e2e run is going**, and note that `reuseExistingServer`
will happily serve a *stale* `dist/` from an old preview server: rebuild before you trust a
red result.

**Backend — manual, against real Upstash**
`vite preview` has no `/api`, so the e2e suite cannot reach the function. The API is
verified through `vercel dev` against the real database. Results in `TEST_RESULTS.md`.

## The GitHub API is stubbed, on purpose

The site fetches profile/repos/events from `api.github.com` on **every load**, unauthenticated
— GitHub allows **60 req/hr per IP**. Running the suite a few times exhausts that quota and
the run starts 403ing, which makes "did it pass?" a question about GitHub's rate limiter
rather than about this site. `boot()` stubs those endpoints so runs are hermetic.

The real-failure path is not ignored — it is asserted deliberately in
**third-party degradation**: the site must boot and stay fully usable when GitHub 403s or is
unreachable. That is a real scenario (shared/corporate NAT, GitHub outage).

This distinction matters: stubbing a flaky dependency is not the same as loosening an
assertion until it stops complaining. Never "fix" a red test by weakening what it checks.

## What these tests do NOT prove

Stated plainly so nobody reads more into a green run than is there:

1. **That a phone's on-screen keyboard physically appears.** That is an OS surface Playwright
   cannot observe. What IS proven is the chain that causes it — a tap must land focus on the
   input, since mobile browsers open the keyboard when `.focus()` runs inside a trusted user
   gesture. A regression (an overlay eating the tap, a z-index change) WOULD be caught. This
   is exactly how the launch-button bug was found: the depth gauge was silently swallowing
   taps on mobile.
2. **Real iOS Safari.** `mobile` is Pixel 5 = Chromium. For genuine Safari coverage:
   `npx playwright install webkit`, then switch to `devices["iPhone 13"]` in
   `playwright.config.ts`.
3. **That scores are trustworthy.** The leaderboard is public and unauthenticated, so it is
   spoofable. Mitigated (max score 5000, 10 submissions/IP/60s, sanitised names) — not
   prevented. It is a portfolio toy, not a tournament.

## Artifacts

Traces/screenshots from failures land in `tests/test-results/` (gitignored). On a failure,
Playwright writes an `error-context.md` per test — read it before guessing at a cause.
