# PONCE-OS

Marco Ponce's portfolio — built as an operating system, not a webpage.

Visitors boot into a workstation: a kernel boot sequence, a particle constellation,
a live "coding since age 10" uptime counter, and a terminal that actually works.

**Live:** https://poncema4.vercel.app

## The terminal is real

Type `help` in the terminal on the site. Highlights:

| Command | What it does |
|---|---|
| `neofetch` | System card with ASCII Tux |
| `nmap marco` | Skill set, presented as an open-port scan |
| `sudo hire-marco` | Recruitment protocol |
| `resume` | Downloads the actual resume PDF |
| `history` | Career timeline |
| `stack` | Languages and tools |
| `lang es` / `lang en` | Bilingual mode |
| `ping keel` | Say hello to the first mate |
| `reboot` | Replay the boot sequence |

There is also a hidden admin mode (`su`), a Konami code, and a few other things
left for visitors to find.

## Stack

- Vite + React 18 + TypeScript
- Hand-rolled canvas particle physics (no animation libraries)
- WebAudio-synthesized keystroke sounds (no audio files)
- Tailwind (base styles) + component-scoped CSS
- Deployed on Vercel — every push to `main` auto-deploys

## Structure

```
src/
  main.tsx                entry
  App.tsx                 router (/, /cyber, 404)
  pages/                  Index (mounts PonceOS), Cyber (the news page), NotFound
  components/PonceOS.tsx  the entire experience: data, terminal, sections, styles
public/
  Marco_Ponce_Resume.pdf  served by the `resume` command
```

The whole site is intentionally one self-contained component. Previous designs
live in git history (tag `stable-before-experiments` and earlier commits) rather
than as dead code in the tree.

## Cyber Brief (`/cyber`)

A news page for cybersecurity and AI (breaches, threats, new models, trends), newest first, 20 per
page, at most 100 pages, searchable, with a page-number box in the pager.

```
GitHub Action (every 30 min)          Vercel edge function              Browser
scripts/news-archive.ts  ->  news.json on   ->  api/cyber-brief.ts  ->  src/pages/Cyber.tsx
fetch all feeds, merge       branch news-data   archive + live feeds     list, search, pager
```

- **Sources** are a fixed allowlist in `api/_lib/brief.ts` (CISA advisories and KEV, BleepingComputer,
  The Hacker News, Krebs, Dark Reading, Schneier, SANS ISC, OpenAI news, Anthropic, Claude Code
  releases, Hugging Face, Google DeepMind, TechCrunch AI, MIT Technology Review). One feed being down
  never breaks the page. Anthropic publishes no feed, so that one is a community-generated mirror
  and is labelled as such on the page.
- **Storage** is `news.json` on the `news-data` branch (created by the first workflow run), kept to
  the newest 2,000 stories. The endpoint merges it with live feeds so the page is fresh even if a run is late.
- **Badges**: NEW MODEL (a lab announces a model), ALERT (actively exploited / breach), NEW (since your
  last visit, kept in this browser only). No visitor data is sent anywhere.
- Only titles, short excerpts and links are kept; every story links to the original.
- Cost and upkeep: free (public repo, about 20 seconds of Actions every 30 minutes). GitHub pauses
  scheduled workflows after 60 days with no activity in the repo; push anything, or run
  `gh workflow run news-archive.yml`, to wake it. A failed run never emails you (the steps
  are `continue-on-error`); a stuck archive shows as an old "newest story added" line on the page.
- To add a source, add one line to `SOURCES` and a test; to run the archive by hand:
  `npx tsx scripts/news-archive.ts /tmp/news.json`.

## Development

```bash
npm install
cp .env.example .env.local   # one optional variable (admin mode)
npm run dev                  # http://localhost:5173
npm run build                # production build
```

## License

Design and content (c) Marco Ponce. Template bones from the Vite/React ecosystem (MIT).
