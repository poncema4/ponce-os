# ponce-os: what to build next (ideas, ranked)

Written 2026-10-15. Filter used: would this make a stranger stay, share it, or come back, and is it
something a template or an AI-generated portfolio would NOT have? Everything here is hand-built and
grounded in things already true about Marco's work. No fake testimonials, no invented numbers.

## Do these first (best return for effort)

1. **Daily catch.** The fishing game picks the day's fish pool and weather from the date, so everyone
   fishes the same sea that day, with a per-day top 3 on the existing leaderboard. A reason to return
   tomorrow, and something to share ("beat my catch today"). Reuses the leaderboard and journal.
2. **Ctrl+K "jump to anything".** Type to jump to a section, open the resume, GitHub, the fishing game,
   fire the cannons, switch language. Fast for recruiters on a laptop, delightful for developers. The
   hamburger already covers phones.
3. **Case studies with proof.** One page per flagship project (PirateFlow first): the problem, the
   architecture diagram, what broke, what the numbers actually measured. Substance is what makes a
   hiring manager stay; the numbers already on the site just need a home. Each page gets its own
   social preview image so a shared link looks specific.
4. **A hand-written "now" line.** One dated sentence in the terminal (`now`) and the hero: what Marco
   is working on this month. Updated by hand. Proves the site is alive, and it can never be AI filler.

## Worth doing next

5. **The sea follows the visitor's local time.** Dusk, deep night or pre-dawn sky behind the ship.
   Returning visitors at different hours see a different scene. Subtle, memorable, cheap.
6. **More terminal depth, all real:** `cat papers.bib` (BibTeX for both ACM papers), `git log` (the real
   recent commits from the GitHub data already fetched), `man marco`. Each one is a small discovery for
   the captain's log and a reason to poke around.
7. **`?for=recruiter` link.** Opens with a 60-second summary view (impact numbers, papers, how to reach
   me) and a "see the full ship" button. Marco can put that exact link on a resume.
8. **Optional ambient ocean sound** next to SND and SYNTH, off by default.
9. **Per-section share cards**, so a link to `#research` previews the papers, not the homepage.

## Quality work that keeps it good

- **Performance budget in CI**: fail the build if the main bundle or the 3D chunk grows past a limit, and
  track Lighthouse scores per push. The site is heavy by design; a budget keeps it from drifting.
- **Real-device check**: run the phone flow on an actual iPhone and an older Android once (the suite uses
  Chromium emulation, which cannot catch Safari-only issues such as 100vh behaviour and audio unlock).
- **Test speed** (done in part): the boot animation is skipped in tests that are not about booting, about
  30% faster. Next: run the specs that do not need the 3D scene without WebGL (about 2x faster again).

## Deliberately not doing

- A third-party AI chatbot (needs a paid key; the offline Keel plus preset messages cover it honestly).
- Testimonial carousels, "trusted by" logos, auto-generated blog posts, or generic stock imagery.
- Anything that collects visitor data. The site's promise is that nothing leaves the browser.
