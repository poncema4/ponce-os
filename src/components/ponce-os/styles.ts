// PONCE-OS design system and stylesheet (injected by PonceOS.tsx).
//
// DESIGN BRIEF (frontend-design: plan the tokens, then build):
//   Subject   one lantern on a dark sea. A software engineer who builds AI systems that respect Zero Trust.
//   Audience  recruiters and engineers. In ten seconds: who, what, proof, how to reach.
//   The one bold thing  the ship and its warm lantern on a cold night sea. Everything else stays quiet.
//   Palette   abyss ink, verdigris (the OS soul), bone text, and ONE warm accent: lantern amber, used
//             only for the things that matter (primary actions, key numbers). Cold sea + one warm light.
//   Type      Newsreader (serif, made for reading) for the voice; JetBrains Mono for the machine (terminal,
//             labels, dates). Both self-hosted: a Zero Trust site that asks nobody else for anything.
//   Rules     contrast >= 4.5:1 for text, targets >= 44px on touch, nothing fixed over content, the nav
//             always reachable, motion only where it carries meaning, all of it off under reduced motion.
import { FISHING_CSS } from "./fishing";
import { LOG_CSS } from "./captains-log";

export const CSS = `
@font-face { font-family: "Newsreader"; font-style: normal; font-weight: 200 800; font-display: swap;
  src: url("/fonts/newsreader-latin-wght-normal.woff2") format("woff2"); }
@font-face { font-family: "Newsreader"; font-style: italic; font-weight: 200 800; font-display: swap;
  src: url("/fonts/newsreader-latin-wght-italic.woff2") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-style: normal; font-weight: 100 800; font-display: swap;
  src: url("/fonts/jetbrains-mono-latin-wght-normal.woff2") format("woff2"); }

:root { color-scheme: dark; scrollbar-color: #2f6fc4 #060e1d; scrollbar-width: thin; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: #060e1d; }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #4a95f0, #2a5fb0); border-radius: 6px; border: 2px solid #060e1d; }
::-webkit-scrollbar-thumb:hover { background: #6aaeff; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

.pos-root, .pos-boot {
  /* surfaces */
  --bg: #050c1a; --panel: #091628; --panel-2: #0d1d33; --line: #183353;
  /* text (all >= 4.5:1 on --panel; checked in tests/e2e/design.spec.ts) */
  --txt: #e6e1d2; --soft: #aebdb6; --dim: #8aa299;
  /* accents */
  --green: #5aa2ff; --green-hi: #8fc2ff; --cyan: #7cc8ff; --amber: #f4b860; --amber-hi: #ffd08a; --red: #ee7b66;
  --serif: "Newsreader", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  --mono: "JetBrains Mono", ui-monospace, "Fira Code", Menlo, Consolas, monospace;
  --bar-h: 56px;
  background: var(--bg); color: var(--txt);
  font-family: var(--mono);
  min-height: 100vh;
}
/* clip, not hidden: "hidden" turns the root into a scroll container and silently breaks position: sticky */
.pos-root { overflow-x: clip; }
.pos-root *, .pos-boot * { box-sizing: border-box; }
.pos-root ::selection { background: rgba(90,162,255,.38); }
.pos-root a { color: inherit; }

/* keyboard focus is always visible (WCAG 2.4.7 / 2.4.11) */
.pos-root :focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; border-radius: 4px; }
.pos-skip { position: absolute; left: 12px; top: -64px; z-index: 200; background: var(--amber); color: #1a1205;
  padding: 10px 16px; border-radius: 6px; font-weight: 700; text-decoration: none; transition: top .15s; }
.pos-skip:focus { top: 10px; }

/* thin progress bar (decorative) */
.pos-progress { position: fixed; top: 0; left: 0; height: 2px; z-index: 70; pointer-events: none;
  background: linear-gradient(90deg, #3d7fe0, var(--green-hi)); box-shadow: 0 0 10px rgba(90,162,255,.55); }

/* boot */
.pos-boot { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column;
  align-items: flex-start; justify-content: center; padding: 8vh 6vw; cursor: pointer; }
.pos-boot-inner { font-size: clamp(11px, 1.6vw, 14px); line-height: 1.65; }
.pos-boot-inner .ok { color: var(--green); }
.pos-boot-cursor { display: inline-block; animation: pos-blink 1s steps(1) infinite; color: var(--green-hi); }
.pos-boot-skip { position: fixed; bottom: 24px; right: 28px; color: var(--dim); font-size: 12px; }
@keyframes pos-blink { 50% { opacity: 0; } }

/* ================= status bar: ALWAYS reachable, never covers what you scroll to ================= */
.pos-statusbar { position: sticky; top: 0; z-index: 50; /* below the fishing overlay (60) and the progress bar (70) */ min-height: var(--bar-h); display: flex; align-items: center; gap: 22px;
  padding: 0 clamp(14px, 3vw, 28px); background: rgba(5,12,26,.9); backdrop-filter: blur(10px) saturate(1.2);
  -webkit-backdrop-filter: blur(10px) saturate(1.2); border-bottom: 1px solid var(--line); font-size: 13px; }
.pos-host { color: var(--green-hi); font-weight: 700; text-decoration: none; white-space: nowrap; display: inline-flex; align-items: center; min-height: 44px; }
.pos-nav { display: flex; gap: 4px; }
.pos-nav a { color: var(--soft); text-decoration: none; padding: 8px 10px; border-radius: 6px; transition: color .15s, background .15s; white-space: nowrap; }
.pos-nav a:hover { color: var(--txt); background: rgba(255,255,255,.05); }
.pos-nav a.on { color: var(--amber-hi); }
.pos-status-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.pos-status-right button, .pos-menu-btn { background: transparent; border: 1px solid var(--line); color: var(--soft); font: inherit;
  font-size: 12px; min-height: 34px; padding: 0 12px; border-radius: 6px; cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
.pos-status-right button:hover, .pos-menu-btn:hover { border-color: var(--green); color: var(--txt); }
.pos-status-right button[aria-pressed="true"] { border-color: var(--amber); color: var(--amber-hi); background: rgba(244,184,96,.08); }
.pos-clock { color: var(--dim); font-variant-numeric: tabular-nums; min-width: 8ch; text-align: right; }
.pos-menu-btn { display: none; }
.pos-sheet { display: none; }

/* every in-page target stops below the sticky bar instead of hiding under it */
.pos-root section[id] { scroll-margin-top: calc(var(--bar-h) + 12px); }

/* ================= hero ================= */
.pos-hero { position: relative; min-height: calc(100svh - var(--bar-h)); display: flex; align-items: center;
  padding: clamp(40px, 8vh, 90px) clamp(18px, 6vw, 90px) 110px; }
/* a soft scrim keeps the headline readable over the moonlit water without hiding the water */
.pos-hero::before { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 90% at 0% 55%, rgba(5,12,26,.82) 0%, rgba(5,12,26,.55) 38%, rgba(5,12,26,0) 70%); }
.pos-constellation { position: absolute; inset: 0; width: 100%; height: 100%; }
.pos-hero-inner { position: relative; z-index: 2; width: min(100%, 640px); }
.pos-greet { color: var(--green-hi); font-size: 14px; margin: 0 0 18px; }
.pos-name { font-family: var(--serif); font-weight: 500; font-size: clamp(54px, 9.5vw, 132px); line-height: .92; letter-spacing: -0.025em;
  margin: 0 0 18px; color: var(--txt); font-optical-sizing: auto; text-wrap: balance; }
.pos-name em { font-style: italic; font-weight: 400; color: var(--amber-hi); }
.pos-tagline { font-family: var(--serif); font-style: italic; font-size: clamp(21px, 2.6vw, 30px); line-height: 1.25; color: var(--txt); margin: 0 0 30px; max-width: 24ch; text-wrap: balance; }
.pos-proof { display: grid; grid-template-columns: repeat(4, auto); justify-content: start; gap: 10px 28px; margin: 0 0 32px; padding: 0; list-style: none; }
.pos-proof li { display: flex; flex-direction: column; gap: 2px; }
.pos-proof b { font-family: var(--serif); font-weight: 500; font-size: clamp(28px, 3.4vw, 40px); line-height: 1; color: var(--amber-hi); font-variant-numeric: lining-nums; }
.pos-proof span { font-size: 12px; line-height: 1.35; color: var(--soft); max-width: 15ch; }
.pos-cta { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 22px; }
.pos-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; border-radius: 8px; font: inherit; font-size: 14px;
  font-weight: 700; text-decoration: none; cursor: pointer; border: 1px solid var(--line); background: rgba(8,14,26,.8); color: var(--txt);
  transition: transform .15s, border-color .15s, background .15s, color .15s; }
.pos-btn:hover { border-color: var(--green); transform: translateY(-1px); }
.pos-btn.primary { background: var(--amber); border-color: var(--amber); color: #1a1205; }
.pos-btn.primary:hover { background: var(--amber-hi); border-color: var(--amber-hi); }
.pos-links { display: flex; flex-wrap: wrap; gap: 4px 6px; font-size: 13.5px; }
.pos-links a, .pos-links button { color: var(--cyan); text-decoration: none; background: none; border: 0; font: inherit; cursor: pointer; min-height: 44px; display: inline-flex; align-items: center; padding: 0 9px; border-radius: 6px; }
.pos-links a:hover, .pos-links button:hover { color: #b6ccf7; background: rgba(95,137,224,.08); }
.pos-uptime { display: flex; align-items: baseline; gap: 10px; margin-top: 8px; color: var(--soft); font-size: 12.5px; }
.pos-uptime-num { color: var(--txt); font-variant-numeric: tabular-nums; }
.pos-hint { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 2; color: var(--soft); font-size: 12px; letter-spacing: .06em;
  text-align: center; pointer-events: none; user-select: none; text-shadow: 0 1px 14px #000; }
.pos-hint::after { content: ""; display: block; width: 1px; height: 28px; margin: 8px auto 0; background: linear-gradient(var(--amber), transparent); animation: pos-cue 2.2s ease-in-out infinite; }
@keyframes pos-cue { 0% { transform: scaleY(0); transform-origin: top; } 50% { transform: scaleY(1); transform-origin: top; } 51% { transform-origin: bottom; } 100% { transform: scaleY(0); transform-origin: bottom; } }

/* ================= sections ================= */
.pos-section { position: relative; z-index: 2; padding: clamp(38px, 6vw, 72px) clamp(18px, 5vw, 64px); max-width: 1180px; margin: clamp(20px, 3vw, 34px) auto;
  background: rgba(5,12,26,.9); border: 1px solid var(--line); border-radius: 16px; }
.pos-h2 { font-family: var(--serif); font-weight: 500; font-size: clamp(30px, 4.2vw, 46px); line-height: 1.05; letter-spacing: -0.015em; color: var(--txt); margin: 0 0 6px; text-wrap: balance; }
.pos-cap { color: var(--dim); font-size: 12.5px; margin: 0 0 clamp(22px, 3vw, 34px); }
.pos-sub { color: var(--soft); font-size: 14px; margin: 0 0 22px; }
.dim { color: var(--dim); }

/* reveal on scroll */
.pos-reveal { opacity: 0; transform: translateY(12px); transition: opacity .5s ease, transform .5s ease; }
.pos-reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .pos-reveal { opacity: 1; transform: none; transition: none; } }

/* ================= terminal ================= */
.pos-term { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #040b18; cursor: text; position: relative;
  box-shadow: 0 0 60px rgba(90,162,255,.08); text-transform: lowercase; }
.pos-term::after { content: ""; position: absolute; inset: 0; pointer-events: none; /* faint CRT lines live ONLY on the terminal now */
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 3px); }
.pos-term-bar { display: flex; align-items: center; gap: 7px; padding: 10px 14px; background: var(--panel); border-bottom: 1px solid var(--line); }
.pos-term-bar .dot { width: 11px; height: 11px; border-radius: 50%; }
.dot.r { background: #f87171; } .dot.y { background: #fbbf24; } .dot.g { background: #3479d3; }
.pos-term-title { margin-left: 8px; color: var(--dim); font-size: 12px; }
.pos-term-body { padding: 16px; height: 400px; overflow-y: auto; font-size: 14px; line-height: 1.6; overscroll-behavior: contain; }
.pos-term-body .tl { white-space: pre-wrap; word-break: break-word; }
.pos-term-body .cmd { color: var(--txt); }
.pos-term-body .dim { color: var(--dim); }
.pos-term-body .warn { color: var(--amber); }
.pos-term-body .hd { color: var(--green-hi); font-weight: 700; }
.pos-term-body .neo { color: var(--green); }
.pos-term-body .keel { color: var(--cyan); }
.pos-term-input { display: flex; gap: 8px; align-items: center; min-height: 32px; }
.pos-term-input .ps1 { color: var(--green-hi); white-space: nowrap; }
.pos-term-input input { flex: 1; min-width: 0; background: transparent; border: 0; outline: 0; color: var(--txt); font: inherit; caret-color: var(--amber); }
.pos-term-input input::placeholder { color: var(--dim); opacity: .8; }
.pos-term:focus-within { border-color: rgba(244,184,96,.45); }

/* ================= experience ================= */
.pos-log { display: flex; flex-direction: column; }
.pos-log-entry { display: grid; grid-template-columns: 200px 1fr; gap: 6px 32px; padding: 26px 0; border-top: 1px solid var(--line); }
.pos-log-entry:first-child { border-top: 0; padding-top: 4px; }
.pos-log-meta { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; align-content: start; }
.pos-log-period { color: var(--soft); }
.pos-log-id { color: var(--cyan); }
.pos-log-clearance { align-self: flex-start; color: var(--amber-hi); border: 1px solid rgba(244,184,96,.4); padding: 1px 8px; border-radius: 4px; font-size: 11.5px; }
.pos-log-body h3 { font-family: var(--serif); font-weight: 500; font-size: clamp(21px, 2.3vw, 26px); line-height: 1.2; margin: 0 0 4px; color: var(--txt); }
.pos-log-body .at { color: var(--green-hi); font-style: italic; }
.pos-log-body .loc { display: block; margin: 2px 0 12px; color: var(--dim); font-family: var(--mono); font-size: 12.5px; font-weight: 400; font-style: normal; }
.pos-log-body ul { margin: 0 0 14px; padding: 0; list-style: none; }
.pos-log-body li { position: relative; padding-left: 18px; margin: 7px 0; font-family: var(--serif); font-size: 17px; line-height: 1.5; color: var(--txt); }
.pos-log-body li::before { content: ""; position: absolute; left: 2px; top: .72em; width: 6px; height: 6px; border-radius: 50%; background: var(--green); }
.pos-log-body strong.m { color: var(--amber-hi); font-weight: 600; white-space: nowrap; }
.pos-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.pos-chips span { font-size: 12px; color: var(--green-hi); border: 1px solid var(--line); background: rgba(79,135,209,.05); padding: 3px 10px; border-radius: 999px; }
.pos-more { margin-top: 8px; border-top: 1px solid var(--line); }
.pos-more > summary { list-style: none; display: flex; align-items: center; gap: 10px; min-height: 56px; cursor: pointer; color: var(--amber-hi); font-size: 14px; font-weight: 700; }
.pos-more > summary::-webkit-details-marker { display: none; }
.pos-more > summary::before { content: "+"; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 1px solid var(--amber); border-radius: 50%; font-weight: 400; }
.pos-more[open] > summary::before { content: "\\2212"; }
.pos-more > summary:hover { color: #ffe3b3; }

/* ================= case files ================= */
.pos-files { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.pos-file { position: relative; display: flex; flex-direction: column; gap: 10px; text-decoration: none; color: inherit; overflow: hidden;
  border: 1px solid var(--line); border-radius: 12px; background: var(--panel); padding: 22px 24px 20px; transition: border-color .2s, transform .2s; }
.pos-files .pos-file:last-child:nth-child(even) { grid-column: 1 / -1; }
.pos-file.feature { grid-column: 1 / -1; background: linear-gradient(135deg, var(--panel-2), var(--panel)); border-color: rgba(244,184,96,.35); }
.pos-file:hover { border-color: rgba(244,184,96,.6); }
.pos-file-top { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; }
.pos-file-code { color: var(--cyan); }
.pos-file-status { color: var(--amber-hi); }
.pos-file h3 { font-family: var(--serif); font-weight: 500; font-size: clamp(26px, 3vw, 34px); line-height: 1.05; margin: 2px 0 0; color: var(--txt); }
.pos-file-brief { font-family: var(--serif); font-size: 17px; line-height: 1.5; color: var(--soft); margin: 0; }
.pos-redactions { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 2px; }
.pos-redact { position: relative; font-size: 13.5px; line-height: 1.5; padding-left: 16px; color: var(--txt); }
.pos-redact::before { content: "\\25B8"; position: absolute; left: 0; color: var(--amber); }
.pos-redact span { position: relative; z-index: 1; }
.pos-redact strong.m { color: var(--amber-hi); font-weight: 600; }
/* the declassify moment: a redaction bar covers each line, then lifts once, as the card arrives.
   Facts are in the DOM and readable the whole time (screen readers, no-JS, phones, reduced motion). */
.pos-redact::after { content: ""; position: absolute; inset: 2px 0 2px 16px; background: var(--line); border-radius: 3px; transform-origin: left; transform: scaleX(0); z-index: 2; }
.pos-file.in .pos-redact::after { animation: pos-unredact 1s cubic-bezier(.6,.05,.2,1) both; animation-delay: calc(.35s + var(--i, 0) * .18s); }
@keyframes pos-unredact { 0% { transform: scaleX(1); opacity: 1; } 100% { transform: scaleX(1); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .pos-file.in .pos-redact::after { animation: none; } }
.pos-file-bottom { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: auto; padding-top: 6px; }
.pos-file-date { color: var(--dim); font-size: 12px; white-space: nowrap; }

/* ================= research ================= */
.pos-papers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.pos-paper { position: relative; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); padding: 24px; text-decoration: none; color: inherit; transition: border-color .2s, transform .2s; }
.pos-paper:hover { border-color: rgba(95,137,224,.55); }
.pos-paper-stamp { display: inline-block; border: 1px solid rgba(123,169,230,.5); color: var(--green-hi); font-size: 11px; letter-spacing: .16em; padding: 2px 8px; border-radius: 3px; margin-bottom: 12px; }
.pos-paper-id { color: var(--cyan); font-size: 12px; margin-bottom: 8px; }
.pos-paper h3 { font-family: var(--serif); font-weight: 500; font-size: 22px; line-height: 1.25; margin: 0 0 12px; color: var(--txt); }
.pos-paper p { margin: 3px 0; font-size: 13px; color: var(--soft); }
.pos-paper-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 8px; color: var(--cyan); font-size: 13.5px; }

/* ================= skills, education, credentials ================= */
.pos-h3 { font-family: var(--serif); font-weight: 500; font-size: 24px; line-height: 1.2; color: var(--txt); margin: clamp(26px, 4vw, 40px) 0 14px; }
.pos-h3:first-of-type { margin-top: 4px; }
.pos-h3-note { font-family: var(--mono); font-size: 12.5px; color: var(--dim); font-weight: 400; margin-left: 8px; }
.pos-edu { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.pos-edu-card { display: flex; flex-direction: column; gap: 4px; padding: 18px 20px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
.pos-edu-when { color: var(--amber-hi); font-size: 12.5px; }
.pos-edu-card strong { font-family: var(--serif); font-weight: 500; font-size: 20px; line-height: 1.25; color: var(--txt); }
.pos-edu-school { color: var(--soft); font-size: 13px; }
.pos-tools { display: flex; flex-direction: column; }
.pos-tool-row { display: grid; grid-template-columns: 170px 1fr; gap: 6px 24px; align-items: baseline; padding: 14px 0; border-top: 1px solid var(--line); }
.pos-tool-row:first-child { border-top: 0; padding-top: 2px; }
.pos-tool-label { color: var(--soft); font-size: 12.5px; }

/* ================= certifications ================= */
.pos-certs { display: flex; flex-wrap: wrap; gap: 8px; }
.pos-cert { font-size: 13px; color: var(--txt); border: 1px solid var(--line); background: var(--panel); padding: 7px 14px; border-radius: 999px; transition: border-color .2s; }
.pos-cert:hover { border-color: var(--green); }
.pos-cert.aws { border-color: rgba(244,184,96,.45); color: var(--amber-hi); }

/* ================= contact: the treasure ================= */
.pos-contact { display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px 48px; align-items: center; }
.pos-contact .pos-contact-big { font-family: var(--serif); font-size: clamp(28px, 4vw, 46px); line-height: 1.1; letter-spacing: -0.015em; margin: 0 0 14px; color: var(--txt); text-wrap: balance; }
.pos-contact-big em { color: var(--amber-hi); }
.pos-contact p { margin: 0 0 18px; color: var(--soft); font-family: var(--serif); font-size: 18px; line-height: 1.5; }
.pos-contact-links { display: flex; flex-direction: column; gap: 8px; }
.pos-contact-links a { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 0 18px; border: 1px solid var(--line);
  border-radius: 10px; background: var(--panel); color: var(--txt); text-decoration: none; font-size: 14px; transition: border-color .2s, background .2s; }
.pos-contact-links a:hover { border-color: var(--amber); background: var(--panel-2); }
.pos-contact-links a.primary { background: var(--amber); border-color: var(--amber); color: #1a1205; font-weight: 700; }
.pos-contact-links a.primary:hover { background: var(--amber-hi); }
.pos-contact-links small { color: var(--dim); font-size: 12px; }
.pos-contact-links a.primary small { color: #4a3510; }

/* ================= footer ================= */
.pos-footer { position: relative; z-index: 2; display: flex; justify-content: space-between; gap: 10px 24px; flex-wrap: wrap; max-width: 1180px; margin: 0 auto;
  padding: 26px clamp(18px, 5vw, 64px) 40px; color: var(--dim); font-size: 12.5px; background: rgba(5,12,26,.86); border-top: 1px solid var(--line); border-radius: 16px 16px 0 0; }

/* ================= overlays & decoration ================= */
body.pos-dragging, body.pos-dragging * { user-select: none !important; -webkit-user-select: none !important; }
.pos-boot, .pos-penguins, .pos-boot-skip { user-select: none; }
.pos-matrix { position: fixed; inset: 0; z-index: 90; pointer-events: none; }
.pos-penguins { position: fixed; inset: 0; z-index: 95; pointer-events: none; overflow: hidden; }
.pos-penguins span { position: absolute; top: -40px; color: var(--green-hi); animation: pos-fall 3.2s linear forwards; }
@keyframes pos-fall { to { transform: translateY(110vh) rotate(360deg); } }
.pos-penguin-msg { position: absolute; bottom: 8vh; width: 100%; text-align: center; color: var(--green-hi); font-size: 13px; letter-spacing: .08em; text-shadow: 0 0 18px rgba(79,135,209,.5); padding: 0 16px; }

/* 3D voyage: persistent world behind the whole site */
.pos-scene3d { position: fixed; inset: 0; z-index: 0; }
.pos-scene3d canvas { width: 100% !important; height: 100% !important; display: block; }
.pos-root { background: transparent; }
.pos-hero, .pos-footer { position: relative; z-index: 2; }

/* depth gauge: a thin line on the far right edge. It never sits over text (it has no text on small screens). */
.pos-depth { position: fixed; right: 6px; top: 50%; transform: translateY(-50%); z-index: 55; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--green-hi); font-size: 10.5px; letter-spacing: .12em; user-select: none; }
.pos-depth-label { writing-mode: vertical-rl; text-shadow: 0 0 10px rgba(0,0,0,.9); }
.pos-depth-bar { width: 3px; height: 120px; border-radius: 2px; background: rgba(21,32,56,.7); overflow: hidden; display: block; }
.pos-depth-bar span { display: block; width: 100%; background: linear-gradient(180deg, var(--green-hi), #3d7fe0); }

/* satellite uplink */
.pos-uplink-wrap { position: relative; }
.pos-globe { display: block; width: 100%; height: 300px; margin-bottom: 8px; }
.pos-uplink { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); padding: 18px; font-size: 13px; }
.pos-uplink-off { color: var(--soft); }
.pos-uplink-head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; color: var(--green-hi); }
.pos-uplink-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); margin-right: 6px; animation: pos-pulse 1.6s ease-in-out infinite; }
.pos-uplink-dot.off { background: var(--amber); box-shadow: 0 0 8px var(--amber); animation: none; }
@keyframes pos-pulse { 50% { opacity: .35; } }
.pos-uplink-blink { animation: pos-blink 1s steps(1) infinite; }
.pos-uplink-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-bottom: 14px; }
.pos-uplink-repo { display: block; border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; text-decoration: none; color: inherit; transition: border-color .2s; }
.pos-uplink-repo:hover { border-color: rgba(95,137,224,.55); }
.pos-uplink-repo .name { color: var(--cyan); font-weight: 700; }
.pos-uplink-repo-top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.pos-uplink-repo p { margin: 0 0 6px; color: var(--soft); font-size: 12.5px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pos-uplink-feed { border-top: 1px dashed var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 3px; }
.pos-uplink-evt { display: flex; gap: 10px; color: var(--txt); font-size: 12.5px; }

/* ================= tablets and below ================= */
@media (max-width: 1000px) {
  .pos-nav a { padding: 8px 7px; font-size: 12.5px; }
  .pos-statusbar { gap: 12px; }
  .pos-log-entry { grid-template-columns: 1fr; gap: 10px; }
  .pos-log-meta { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
  .pos-contact { grid-template-columns: 1fr; }
}

/* ================= phones: menu sheet instead of a three-row header; nothing fixed over content ================= */
@media (max-width: 820px) {
  .pos-statusbar { gap: 8px; }
  .pos-nav, .pos-status-right .pos-opt, .pos-clock { display: none; }
  .pos-status-right .pos-menu-btn { display: inline-flex; align-items: center; min-height: 44px; min-width: 64px; justify-content: center; }
  .pos-term-input { min-height: 44px; }
  .pos-status-right { margin-left: auto; }
  .pos-sheet { display: block; position: absolute; left: 0; right: 0; top: 100%; background: rgb(5,12,26); border-bottom: 1px solid var(--line);
    padding: 6px 14px 16px; max-height: calc(100svh - var(--bar-h)); overflow-y: auto; }
  .pos-sheet[hidden] { display: none; }
  .pos-sheet a { display: flex; align-items: center; min-height: 48px; padding: 0 6px; color: var(--txt); text-decoration: none; font-size: 15px; border-bottom: 1px solid var(--line); }
  .pos-sheet-ctl { display: flex; gap: 8px; padding-top: 14px; flex-wrap: wrap; }
  .pos-sheet-ctl button { min-height: 44px; padding: 0 16px; background: transparent; border: 1px solid var(--line); color: var(--soft); border-radius: 8px; font: inherit; font-size: 13px; cursor: pointer; }
  .pos-sheet-ctl button[aria-pressed="true"] { border-color: var(--amber); color: var(--amber-hi); }
  /* the ship gets the top of the screen; the words sit below it. The hero is trimmed to make room. */
  .pos-hero { align-items: flex-end; padding: 20px 18px 70px; }
  .pos-hero::before { background: linear-gradient(0deg, rgba(5,12,26,.92) 0%, rgba(5,12,26,.8) 52%, rgba(5,12,26,0) 88%); }
  .pos-greet { margin-bottom: 8px; font-size: 13px; }
  .pos-name { font-size: clamp(46px, 14vw, 66px); margin-bottom: 10px; }
  .pos-tagline { font-size: 21px; margin-bottom: 18px; max-width: none; }
  .pos-proof { grid-template-columns: repeat(4, 1fr); gap: 8px 10px; margin-bottom: 18px; }
  .pos-proof b { font-size: 26px; }
  .pos-proof span { font-size: 10.5px; max-width: none; }
  .pos-cta { gap: 8px; margin-bottom: 8px; }
  .pos-cta .pos-btn { flex: 1 1 calc(50% - 4px); min-height: 48px; padding: 0 12px; font-size: 13.5px; }
  .pos-cta .pos-btn.primary { flex: 1 1 100%; }
  .pos-links { gap: 0; margin-left: -9px; }
  .pos-links a, .pos-links button { padding: 0 8px; font-size: 13px; }
  .pos-uptime { display: none; }
  .pos-hint { bottom: 12px; }
  .pos-hint::after { height: 18px; margin-top: 4px; }
  .pos-files, .pos-papers, .pos-edu { grid-template-columns: 1fr; }
  .pos-tool-row { grid-template-columns: 1fr; gap: 8px; }
  .pos-term-body { height: 340px; font-size: 13px; }
  .pos-globe { height: 220px; }
  .pos-depth-label { display: none; }
  .pos-depth-bar { height: 80px; }
}
@media (max-width: 480px) {
  .pos-proof { grid-template-columns: repeat(2, 1fr); gap: 12px 14px; }
  .pos-section { padding: 30px 16px; border-radius: 12px; margin: 14px 8px; }
  .pos-footer { padding: 22px 16px 34px; }
  .pos-log-body li, .pos-file-brief { font-size: 16.5px; }
}

${FISHING_CSS}
${LOG_CSS}
`;
