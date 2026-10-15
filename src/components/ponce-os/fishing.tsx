// cast — the deck-side fishing minigame. Lives OUTSIDE the terminal so visitors who
// don't want to type still get something to play with. Self-contained: one canvas
// overlay and two small sibling modules (leaderboard, journal). Nothing else can break.
//
// loop: CAST -> WAIT -> APPROACH (you SEE the fish swim up) -> BITE -> HOOK
//       -> REEL (tension) -> LANDED/LOST -> [cooldown] -> CAST AGAIN (explicit)
//
// deliberate design notes:
//  - the approach is the telegraph: you watch it come, so the strike is earned, not luck.
//  - every run varies: side, depth, speed, and sometimes it's a false alarm that noses
//    the bait and turns away. that's what keeps it from being a metronome.
//  - after a catch you must press CAST AGAIN. no space-spam auto-recast. breathe, read
//    the line, then go again.

import { useEffect, useRef, useState, useCallback } from "react";
import { fetchBoard, submitScore, getName, setName as saveName, type Entry } from "./leaderboard";
import { discover } from "./memory";
import { FLAG, achievements, journalProgress, loadStats, recordCatch, saveStats, type Stats } from "./fishing-journal";

type Phase =
  | "idle" | "casting" | "waiting" | "approach" | "bite"
  | "reeling" | "landed" | "lost";

type Catch = {
  name: string; art: string; pts: number;
  rarity: "junk" | "common" | "rare" | "relic" | "legendary" | "phish";
  line: string;
  // 1..7 — drives the SHORTER bite window, the HARDER fight, and the LONGER reel.
  // points scale with it: nothing valuable should be easy.
  diff: number;
};

// exported so the roll can be unit-tested — a rigged probability table is the kind of
// bug you never see by playing, only by asserting.
// 23 species. INVARIANT (unit-tested): points scale with difficulty — nothing valuable
// is easy, nothing easy is valuable. `diff` shortens the bite window, strengthens the
// fight, and lengthens the reel, so a whale genuinely feels different from a sardine.
export const TABLE: { c: Catch; w: number }[] = [
  // --- junk: instant, worthless, mildly funny ---
  { w: 9, c: { name: "old boot", art: "🥾", pts: 1, diff: 1, rarity: "junk", line: "someone's been here before." } },
  { w: 8, c: { name: "tangled cable", art: "🔌", pts: 2, diff: 1, rarity: "junk", line: "cat5. still terminated wrong." } },
  { w: 7, c: { name: "driftwood", art: "🪵", pts: 2, diff: 1, rarity: "junk", line: "older than the ship. keeping it." } },
  { w: 6, c: { name: "kelp tangle", art: "🌿", pts: 3, diff: 1, rarity: "junk", line: "the ocean's cable management. no notes." } },
  // --- common: the bread and butter ---
  { w: 16, c: { name: "sardine", art: "🐟", pts: 4, diff: 1, rarity: "common", line: "small. honest work." } },
  { w: 12, c: { name: "shrimp", art: "🦐", pts: 5, diff: 1, rarity: "common", line: "barely resisted. barely counts." } },
  { w: 14, c: { name: "reef snapper", art: "🐠", pts: 7, diff: 2, rarity: "common", line: "fought harder than expected." } },
  { w: 10, c: { name: "crab", art: "🦀", pts: 8, diff: 2, rarity: "common", line: "sideways to the end. respect." } },
  { w: 9, c: { name: "pufferfish", art: "🐡", pts: 10, diff: 2, rarity: "common", line: "inflated its own threat model." } },
  // --- rare: you have to actually reel ---
  { w: 7, c: { name: "jellyfish", art: "🪼", pts: 12, diff: 3, rarity: "rare", line: "no brain, no spine, still won an argument." } },
  { w: 7, c: { name: "squid", art: "🦑", pts: 13, diff: 3, rarity: "rare", line: "ink deployed. countermeasure noted." } },
  { w: 5, c: { name: "sea turtle", art: "🐢", pts: 15, diff: 3, rarity: "rare", line: "released, obviously. she was here first." } },
  { w: 5, c: { name: "lobster", art: "🦞", pts: 16, diff: 3, rarity: "rare", line: "came up swinging. dinner-adjacent." } },
  { w: 4, c: { name: "seal", art: "🦭", pts: 18, diff: 4, rarity: "rare", line: "it was playing with you the whole time." } },
  { w: 4, c: { name: "dolphin", art: "🐬", pts: 20, diff: 4, rarity: "rare", line: "released. it seemed amused by the attempt." } },
  // --- relic: the wreck gives up its things ---
  { w: 4, c: { name: "wreck relic", art: "⚓", pts: 22, diff: 4, rarity: "relic", line: "off the hull down there. still holding." } },
  { w: 3, c: { name: "data packet", art: "📦", pts: 26, diff: 4, rarity: "relic", line: "unencrypted, in open water. rookie mistake." } },
  { w: 2, c: { name: "ancient key", art: "🗝️", pts: 32, diff: 5, rarity: "relic", line: "opens something. not saying what." } },
  // --- legendary: these will break your line ---
  { w: 2, c: { name: "SHARK", art: "🦈", pts: 45, diff: 5, rarity: "legendary", line: "you didn't catch it. it allowed this." } },
  { w: 2, c: { name: "treasure chest", art: "💰", pts: 55, diff: 6, rarity: "legendary", line: "the real treasure was the contact section. but this helps." } },
  { w: 1, c: { name: "WHALE", art: "🐋", pts: 70, diff: 6, rarity: "legendary", line: "the whole boat leaned. you let it go." } },
  { w: 1, c: { name: "THE KRAKEN", art: "🐙", pts: 100, diff: 7, rarity: "legendary", line: "you woke it. the ship is fine. probably." } },
  // --- the one you're supposed to NOT take ---
  { w: 6, c: { name: "phish", art: "📧", pts: -8, diff: 2, rarity: "phish", line: "\"URGENT: verify your credentials\" — you struck at it. we don't click it." } },
];

const RARITY_COLOR: Record<Catch["rarity"], string> = {
  junk: "#5f7a6e", common: "#3479d3", rare: "#2265ee",
  relic: "#a5c2fc", legendary: "#fbbf24", phish: "#f87171",
};
export const rarityColor = (r: Catch["rarity"]) => RARITY_COLOR[r];

// pure + deterministic for a given r in [0,1] — that's what makes it testable.
// Math.random() is injected by the caller, never called in here.
export function pickFrom(table: { c: Catch; w: number }[], r: number): Catch {
  const total = table.reduce((s, e) => s + e.w, 0);
  let n = Math.min(Math.max(r, 0), 0.999999) * total;
  for (const e of table) { n -= e.w; if (n < 0) return e.c; }
  return table[table.length - 1].c;
}

const roll = (): Catch => pickFrom(TABLE, Math.random());

// --- difficulty curves (exported: unit-tested so the tuning can't silently invert) ---
// harder fish give you LESS time to strike...
export const biteWindowMs = (diff: number) => Math.max(420, 1250 - diff * 120);
// ...pull HARDER against the reel...
export const fightMul = (diff: number) => 0.85 + diff * 0.16;
// ...and take LONGER to bring in.
export const reelTargetMs = (diff: number) => 1500 + diff * 320;

const BEST_KEY = "ponce-os:cast:best";

// the swimmer we draw during the approach
type Swimmer = {
  x: number; y: number; tx: number; ty: number;
  dir: 1 | -1; speed: number; wob: number;
  size: number; fake: boolean; turning: boolean;
  hooked?: boolean;   // on the line: drawn fighting, dragged toward the boat
};

// ---- optional sound + haptics (tied to the site's SND toggle; silent by default) ----
function makeBeeper() {
  let ctx: AudioContext | null = null;
  return (notes: number[], opts: { dur?: number; type?: OscillatorType; vol?: number; gap?: number } = {}) => {
    try {
      ctx ??= new AudioContext();
      if (ctx.state === "suspended") void ctx.resume();
      const { dur = 0.1, type = "sine", vol = 0.05, gap = 0.09 } = opts;
      notes.forEach((f, i) => {
        const t0 = ctx!.currentTime + i * gap;
        const o = ctx!.createOscillator(); const g = ctx!.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(ctx!.destination);
        o.start(t0); o.stop(t0 + dur + 0.03);
      });
    } catch { /* audio unavailable */ }
  };
}
const LAND_NOTES: Record<Catch["rarity"], number[]> = {
  junk: [196, 165], common: [523, 659], rare: [523, 659, 784], relic: [659, 784, 988],
  legendary: [523, 659, 784, 1047, 1319], phish: [140, 110],
};

const sr = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }; // stable pseudo-random

export function Fishing({ onClose, onFlag, sound = false }: { onClose: () => void; onFlag?: (flag: string) => void; sound?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const panelR = useRef<HTMLDivElement>(null);
  const mainBtnR = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(BEST_KEY) || 0); } catch { return 0; } });
  const [last, setLast] = useState<Catch | null>(null);
  const [tension, setTension] = useState(50);
  const [ready, setReady] = useState(true);   // the breather gate
  const [early, setEarly] = useState(false);  // struck before the bite = spooked it
  const [board, setBoard] = useState<Entry[] | null>(null);
  const [online, setOnline] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [nameInput, setNameInput] = useState(() => getName());
  const [submitted, setSubmitted] = useState(false);
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [newFlag, setNewFlag] = useState(false);

  const phaseR = useRef(phase); phaseR.current = phase;
  const tensionR = useRef(tension); tensionR.current = tension;
  const readyR = useRef(ready); readyR.current = ready;
  const soundR = useRef(sound); soundR.current = sound;
  const streakR = useRef(0);
  const holdR = useRef(false);
  const spaceDownR = useRef(false);           // kills key auto-repeat spam
  const pendingR = useRef<Catch | null>(null);
  const swimR = useRef<Swimmer | null>(null);
  const timerR = useRef<number | null>(null);
  const fakeTimerR = useRef<number | null>(null);
  const reelR = useRef(0);
  const beeperR = useRef<ReturnType<typeof makeBeeper> | null>(null);
  // the catch arcing out of the water into the basket on the deck
  const flightR = useRef<{ x0: number; y0: number; start: number; art: string } | null>(null);

  const clearTimer = () => { if (timerR.current) { window.clearTimeout(timerR.current); timerR.current = null; } };
  const clearFake = () => { if (fakeTimerR.current) { window.clearTimeout(fakeTimerR.current); fakeTimerR.current = null; } };

  const fx = useCallback((notes: number[], opts?: Parameters<ReturnType<typeof makeBeeper>>[1]) => {
    if (!soundR.current) return;
    (beeperR.current ??= makeBeeper())(notes, opts);
  }, []);
  const buzz = useCallback((pattern: number | number[]) => {
    if (!soundR.current) return;
    try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
  }, []);

  // every result ends with a forced breather, then an explicit CAST AGAIN
  const rest = useCallback((ms = 900) => {
    setReady(false);
    clearTimer();
    timerR.current = window.setTimeout(() => setReady(true), ms);
  }, []);

  const land = useCallback((c: Catch) => {
    // don't vanish the fish: launch it out of the water into the basket
    const s = swimR.current;
    flightR.current = { x0: s ? s.x : 0, y0: s ? s.y : 0, start: performance.now(), art: c.art };
    swimR.current = null;
    setLast(c);
    setPhase("landed");
    discover("first-catch");
    setScore((sc) => {
      const next = Math.max(0, sc + c.pts);
      setBest((b) => {
        if (next > b) { try { localStorage.setItem(BEST_KEY, String(next)); } catch { /* storage blocked */ } return next; }
        return b;
      });
      return next;
    });
    streakR.current = c.rarity === "phish" ? 0 : streakR.current + 1;
    setStreak(streakR.current);
    setStats((prev) => {
      const next = recordCatch(prev, c, streakR.current);
      saveStats(next);
      if (!prev.flag && next.flag) { setNewFlag(true); onFlag?.(FLAG); discover("flag"); }
      return next;
    });
    fx(LAND_NOTES[c.rarity], c.rarity === "phish" ? { type: "sawtooth", vol: 0.06 } : { type: "triangle" });
    buzz(c.rarity === "legendary" ? [40, 40, 90] : c.rarity === "phish" ? 120 : 30);
    rest(950);
  }, [onFlag, rest, fx, buzz]);

  const miss = useCallback((why: Phase = "lost") => {
    swimR.current = null; pendingR.current = null;
    streakR.current = 0;
    setStreak(0); setPhase(why); rest(750);
    fx([196, 147], { type: "sine", vol: 0.045 });
  }, [rest, fx]);

  // a fish decides to come look. sometimes it's a tyre-kicker.
  const scheduleApproach = useCallback(() => {
    clearTimer();
    timerR.current = window.setTimeout(() => {
      const fake = Math.random() < 0.28;                          // false alarm
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      swimR.current = {
        x: 0, y: 0, tx: 0, ty: 0, dir,
        speed: 0.55 + Math.random() * 0.9,                        // varies every run
        wob: Math.random() * Math.PI * 2,
        size: 0.8 + Math.random() * 0.9,
        fake, turning: false,
      };
      if (!fake) pendingR.current = roll();
      setPhase("approach");
    }, 900 + Math.random() * 3400);                               // the wait varies too
  }, []);

  const cast = useCallback(() => {
    const p = phaseR.current;
    if (!readyR.current) return;                                  // breather
    if (p !== "idle" && p !== "landed" && p !== "lost") return;
    setLast(null); setNewFlag(false); swimR.current = null; pendingR.current = null;
    setPhase("casting");
    clearTimer();
    timerR.current = window.setTimeout(() => {
      setPhase("waiting");
      scheduleApproach();
    }, 520);
  }, [scheduleApproach]);

  const hook = useCallback(() => {
    const p = phaseR.current;
    // STRIKING EARLY SPOOKS IT. you have to wait for the bobber to actually go down.
    // this is what makes the telegraph a skill test instead of a "mash space" button.
    if (p === "approach" || p === "waiting") {
      clearTimer(); clearFake();
      setEarly(true);
      miss("lost");
      return;
    }
    if (p !== "bite" || !pendingR.current) return;
    clearTimer();
    setEarly(false);
    reelR.current = 0; setTension(50);
    // the fish is ON THE LINE now: keep it alive so it can be seen fighting
    if (swimR.current) { swimR.current.hooked = true; swimR.current.turning = false; }
    setPhase("reeling");
    fx([523], { type: "square", vol: 0.03, dur: 0.06 });
    buzz(25);
  }, [miss, fx, buzz]);

  // one action for every input (space, tap on the water, the big button): strike, or start reeling, or cast
  const press = useCallback(() => {
    const p = phaseR.current;
    if (p === "bite" || p === "approach" || p === "waiting") hook();   // early strikes spook it inside hook()
    else if (p === "reeling") holdR.current = true;
    else cast();
  }, [hook, cast]);
  const release = useCallback(() => { holdR.current = false; }, []);

  // reel: hold to pull, release to ease. keep it off both rails.
  useEffect(() => {
    if (phase !== "reeling") return;
    let raf = 0, prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - prev); prev = now;
      const c = pendingR.current;
      // the fight scales with difficulty: a whale genuinely fights back
      const fight = c ? fightMul(c.diff) : 1;
      const target = c ? reelTargetMs(c.diff) : 2100;
      const t = tensionR.current + (holdR.current ? 0.055 : -0.045) * dt * fight;
      if (t <= 0 || t >= 100) { miss(); return; }
      setTension(t);
      reelR.current += dt * (t > 28 && t < 78 ? 1 : 0.18);
      if (reelR.current >= target) { const got = pendingR.current; pendingR.current = null; if (got) land(got); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, land, miss]);

  // canvas: water, boat, line, and the fish you can actually watch coming
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c);

    let biteAt = 0, prevT = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      // real elapsed seconds: the fish swim at the same speed on a 60 Hz and a 144 Hz screen
      const dt = prevT ? Math.min(0.05, (t - prevT) / 1000) : 1 / 60;
      prevT = t;
      const r = c.getBoundingClientRect(), W = r.width, H = r.height;
      if (W < 2 || H < 2) return;
      const surf = H * 0.40;
      const bobX = W * 0.62;
      const p = phaseR.current;

      // sky, with stars and the moon
      const sky = ctx.createLinearGradient(0, 0, 0, surf);
      sky.addColorStop(0, "#040a1a"); sky.addColorStop(1, "#0d2748");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, surf);
      for (let i = 0; i < 38; i++) {
        const tw = 0.5 + 0.5 * Math.sin(t * 0.0015 + i * 3.1);
        ctx.fillStyle = `rgba(214,230,255,${0.18 + tw * 0.4})`;
        ctx.fillRect(sr(i) * W, sr(i + 50) * (surf - 8), 1.2, 1.2);
      }
      const mx = W - 46, my = 34;
      const glow = ctx.createRadialGradient(mx, my, 4, mx, my, 40);
      glow.addColorStop(0, "rgba(205,228,255,.38)"); glow.addColorStop(1, "rgba(205,228,255,0)");
      ctx.fillStyle = glow; ctx.fillRect(mx - 44, my - 44, 88, 88);
      ctx.fillStyle = "rgba(236,244,255,.92)";
      ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill();

      // water
      const g = ctx.createLinearGradient(0, surf, 0, H);
      g.addColorStop(0, "#0f4a7c"); g.addColorStop(1, "#040e20");
      ctx.fillStyle = g; ctx.fillRect(0, surf, W, H - surf);
      // moon glitter on the water
      for (let i = 0; i < 6; i++) {
        const wdt = 22 - i * 3 + Math.sin(t * 0.003 + i) * 3;
        ctx.fillStyle = `rgba(205,228,255,${0.1 - i * 0.012})`;
        ctx.fillRect(mx - wdt / 2 + Math.sin(t * 0.002 + i * 1.7) * 3, surf + 3 + i * 9, wdt, 1.6);
      }
      ctx.strokeStyle = "rgba(130,195,255,.32)"; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = surf + i * 8 + Math.sin(x * 0.028 + t * 0.0013 + i) * 2.2;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // the deck you're standing on, with the ship's lantern: the one warm light
      const lamp = ctx.createRadialGradient(34, surf - 24, 2, 34, surf - 24, 54);
      lamp.addColorStop(0, "rgba(255,186,110,.30)"); lamp.addColorStop(1, "rgba(255,186,110,0)");
      ctx.fillStyle = lamp; ctx.fillRect(0, surf - 80, 110, 130);
      ctx.fillStyle = "#1d232a";
      ctx.beginPath();
      ctx.moveTo(14, surf - 3); ctx.lineTo(92, surf - 3);
      ctx.lineTo(80, surf + 11); ctx.lineTo(26, surf + 11);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#3a5047"; ctx.beginPath();
      ctx.moveTo(60, surf - 3); ctx.lineTo(60, surf - 30); ctx.stroke();
      ctx.fillStyle = "#ffcf8a"; ctx.beginPath(); ctx.arc(34, surf - 22, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#3a5047"; ctx.beginPath(); ctx.moveTo(34, surf - 3); ctx.lineTo(34, surf - 20); ctx.stroke();

      // the basket on the deck: where the catch lands
      const bkX = 46, bkY = surf - 8;
      ctx.strokeStyle = "#4a6358"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bkX - 8, bkY); ctx.lineTo(bkX - 6, bkY + 7);
      ctx.lineTo(bkX + 6, bkY + 7); ctx.lineTo(bkX + 8, bkY);
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bkX, bkY, 8, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;

      // ambient fish, far below: the water is never empty
      ctx.fillStyle = "rgba(79,135,209,.13)";
      for (let i = 0; i < 4; i++) {
        const fx0 = (((t * 0.018 * (i % 2 ? 1 : -1) + i * 100) % (W + 60)) + W + 60) % (W + 60) - 30;
        const fy = H - 34 - i * 11 + Math.sin(t * 0.002 + i) * 3;
        ctx.beginPath(); ctx.ellipse(fx0, fy, 5.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      }

      const inWater = p === "waiting" || p === "approach" || p === "bite" || p === "reeling";
      let bobY = surf;
      const fishColor = (hooked: boolean, fake: boolean) => {
        if (fake) return "rgba(95,122,110,.75)";
        const cc = hooked ? pendingR.current : null;
        return cc ? RARITY_COLOR[cc.rarity] : "rgba(110,164,231,.85)"; // once hooked, its colour tells you what you have
      };

      // --- the swimmer: telegraph on approach, then it FIGHTS on the line ---
      const s = swimR.current;
      const drawFish = (hooked: boolean) => {
        if (!s) return;
        ctx.fillStyle = fishColor(hooked, s.fake);
        if (hooked && pendingR.current?.rarity === "legendary") { ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 14; }
        ctx.beginPath(); ctx.ellipse(0, 0, 9 * s.size, 4 * s.size, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-8 * s.size, 0); ctx.lineTo(-14 * s.size, -4 * s.size); ctx.lineTo(-14 * s.size, 4 * s.size);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#05070a";
        ctx.beginPath(); ctx.arc(4 * s.size, -1, 1.1, 0, Math.PI * 2); ctx.fill();
      };
      if (s && p === "reeling") {
        // dragged toward the boat as you make progress; thrashes the whole way
        const target = pendingR.current ? reelTargetMs(pendingR.current.diff) : 2100;
        const prog = Math.min(1, reelR.current / target);
        const tgtX = bobX + (66 - bobX) * prog * 0.75;
        const tgtY = surf + 8 - prog * 4;
        const k = 1 - Math.exp(-3.7 * dt); // frame-rate independent easing (was a fixed 0.06 per frame)
        s.x += (tgtX - s.x) * k;
        s.y += (tgtY - s.y) * k;
        const thrash = Math.sin(t * 0.045) * (5 - prog * 2);
        ctx.save();
        ctx.translate(s.x, s.y + thrash * 0.35);
        ctx.rotate(Math.sin(t * 0.05) * 0.4);
        ctx.scale(s.dir, 1);
        drawFish(true);
        ctx.restore();
        // splash flecks while it fights near the surface
        if (s.y < surf + 14) {
          ctx.fillStyle = "rgba(199,214,207,.5)";
          for (let i = 0; i < 3; i++) {
            const a = t * 0.02 + i * 2.1;
            ctx.fillRect(s.x + Math.cos(a) * 9, surf - 2 + Math.sin(a) * 3, 1.5, 1.5);
          }
        }
      }
      if (s && (p === "approach" || p === "bite")) {
        if (!s.tx) { // init on first frame, now that we know the canvas size
          s.tx = bobX; s.ty = surf + 6;
          s.x = s.dir === 1 ? -20 : W + 20;
          s.y = surf + 40 + Math.random() * Math.max(10, H - surf - 70);
        }
        if (p === "approach") {
          const dx = s.tx - s.x, dy = s.ty - s.y;
          const d = Math.hypot(dx, dy) || 1;
          // speeds are pixels per SECOND now (the old per-frame constants x60), so arrival time no
          // longer depends on the screen's refresh rate
          if (s.turning) { s.x -= (dx / d) * s.speed * 132 * dt; s.y += 30 * dt; }
          else { s.x += (dx / d) * s.speed * 96 * dt; s.y += (dy / d) * s.speed * 96 * dt; }
          if (!s.turning && d < 12) {
            if (s.fake) {
              s.turning = true;
              clearFake();
              fakeTimerR.current = window.setTimeout(() => { if (phaseR.current === "approach") { swimR.current = null; setPhase("waiting"); scheduleApproach(); } }, 700);
            } else {
              biteAt = t; setPhase("bite"); clearTimer();
              fx([880, 1318], { type: "triangle", vol: 0.05 });
              buzz(60);
              // harder fish give you a shorter window to react
              const win = pendingR.current ? biteWindowMs(pendingR.current.diff) : 1150;
              timerR.current = window.setTimeout(() => miss(), win);
            }
          }
          if (s.turning && (s.x < -40 || s.x > W + 40)) swimR.current = null;
        }
        // draw it: body + tail, facing travel
        const face = s.turning ? -s.dir : s.dir;
        const wob = Math.sin(t * 0.012 + s.wob) * 2;
        ctx.save();
        ctx.translate(s.x, s.y + wob);
        ctx.scale(face, 1);
        drawFish(false);
        ctx.restore();
      }

      if (inWater) {
        // THE LINE FOLLOWS THE FISH. once hooked, the bobber IS wherever the fish is:
        // it gets dragged back toward the rod as you win, which is the whole point of reeling.
        const hookedS = p === "reeling" ? swimR.current : null;
        const lineX = hookedS ? hookedS.x : bobX;
        const dip = p === "bite" ? Math.sin((t - biteAt) * 0.03) * 5 + 5 : Math.sin(t * 0.004) * 1.5;
        bobY = hookedS ? hookedS.y - 5 : surf + dip;

        // rod tip bends toward the fight; the line reddens as tension nears either rail
        const tipX = 60, tipY = surf - 30;
        const bend = p === "reeling" ? 10 : 0;
        const tn = tensionR.current;
        ctx.strokeStyle = p === "reeling"
          ? (tn < 20 || tn > 84 ? "rgba(248,113,113,.9)" : "rgba(214,226,220,.8)")
          : "rgba(214,226,220,.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.quadraticCurveTo((tipX + lineX) / 2, tipY - 16 + bend, lineX, bobY);
        ctx.stroke();

        // bobber rides the line; while hooked it sits on the fish
        ctx.fillStyle = p === "bite" ? "#f87171" : p === "reeling" ? "#7ba9e6" : "#f4b860";
        ctx.beginPath(); ctx.arc(lineX, bobY, p === "reeling" ? 2.6 : 4, 0, Math.PI * 2); ctx.fill();

        if (p === "bite") {
          const rr = (((t - biteAt) * 0.06) % 20) + 4;
          ctx.strokeStyle = `rgba(248,113,113,${Math.max(0, 0.55 - rr / 42)})`;
          ctx.beginPath(); ctx.arc(lineX, bobY, rr, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (p === "casting") {
        ctx.strokeStyle = "rgba(214,226,220,.35)";
        ctx.beginPath(); ctx.moveTo(60, surf - 30); ctx.lineTo(bobX * 0.8, surf - 20); ctx.stroke();
      }

      // --- the catch leaps out of the water and drops into the basket ---
      const fl = flightR.current;
      if (fl) {
        const DUR = 780;
        const k = Math.min(1, (performance.now() - fl.start) / DUR);
        if (k >= 1) { flightR.current = null; }
        else {
          const fx1 = fl.x0 + (bkX - fl.x0) * k;
          // parabola: up and over, landing in the basket mouth
          const fy = fl.y0 + (bkY - fl.y0) * k - Math.sin(k * Math.PI) * 46;
          ctx.save();
          ctx.translate(fx1, fy);
          ctx.rotate(k * Math.PI * 1.6);           // it tumbles through the air
          ctx.font = "16px system-ui, sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.globalAlpha = k > 0.92 ? (1 - k) / 0.08 : 1;
          ctx.fillText(fl.art, 0, 0);
          ctx.restore();
          ctx.globalAlpha = 1;
          // splash where it broke the surface
          if (k < 0.22) {
            ctx.strokeStyle = `rgba(214,226,220,${0.55 - k * 2})`;
            const rr = 4 + k * 40;
            ctx.beginPath(); ctx.arc(fl.x0, surf, rr, Math.PI, Math.PI * 2); ctx.stroke();
          }
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [miss, scheduleApproach, fx, buzz]);

  useEffect(() => () => { clearTimer(); clearFake(); }, []);

  // the leaderboard: pulled when opened (never blocks the game: falls back to local scores)
  const loadBoard = useCallback(async () => {
    const { top, online: on } = await fetchBoard();
    setBoard(top); setOnline(on);
  }, []);
  useEffect(() => { if (showBoard && !board) void loadBoard(); }, [showBoard, board, loadBoard]);

  const postScore = useCallback(async () => {
    if (!nameInput.trim() || score <= 0) return;
    saveName(nameInput.trim());
    setSubmitted(true);
    await submitScore(nameInput.trim(), score);
    setBoard(null);            // force a refetch so you see your new rank
    setShowJournal(false);
    setShowBoard(true);
    void loadBoard();
  }, [nameInput, score, loadBoard]);

  // keyboard: space is contextual, esc closes. auto-repeat is ignored.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.code !== "Space") return;
      // typing a name with a space must not cast: only act when focus is not in a text field
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      e.preventDefault();
      if (spaceDownR.current) return;        // no auto-repeat spam
      spaceDownR.current = true;
      press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if ((e.target as HTMLElement)?.tagName !== "INPUT") e.preventDefault(); // stop a focused button also "clicking" on release
      spaceDownR.current = false; release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [press, release, onClose]);

  // it is a modal: focus moves in, Tab stays inside, focus returns to where it was, the page behind does not scroll
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mainBtnR.current?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelR.current) return;
      const f = [...panelR.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      else if (!panelR.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      document.body.style.overflow = prevOverflow;
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  const resting = phase === "landed" || phase === "lost";
  const label =
    phase === "bite" ? "HOOK IT" :
    phase === "reeling" ? "HOLD TO REEL" :
    phase === "approach" ? "something's coming..." :
    phase === "waiting" ? "waiting for a bite..." :
    phase === "casting" ? "casting..." :
    resting ? (ready ? "CAST AGAIN" : "...") : "CAST";

  const armed = phase === "bite" || (resting && ready) || phase === "idle";
  const prog = journalProgress(stats, TABLE.length);
  const ach = achievements(stats, TABLE.length);
  const panelOpen = showBoard || showJournal;

  return (
    <div className="cast-wrap" role="dialog" aria-modal="true" aria-label="cast: fishing minigame"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cast-panel" ref={panelR}>
        <div className="cast-head">
          <span className="cast-title">cast<span className="cast-sub"> &mdash; off the port bow</span></span>
          <button className="cast-x" onClick={onClose} aria-label="close the fishing game">&#x2715;</button>
        </div>

        <div className="cast-stats">
          <span>score <b>{score}</b></span>
          <span>streak <b>{streak}</b></span>
          <span>best <b>{best}</b></span>
          <span className="cast-links">
            <button className="cast-link" aria-pressed={showBoard} onClick={() => { setShowJournal(false); setShowBoard((v) => !v); }}>
              {showBoard ? "back to the water" : "leaderboard"}
            </button>
            <button className="cast-link" aria-pressed={showJournal} onClick={() => { setShowBoard(false); setShowJournal((v) => !v); }}>
              {showJournal ? "back to the water" : `journal ${prog.got}/${prog.total}`}
            </button>
          </span>
        </div>

        {showBoard && (
          <div className="cast-board">
            <div className="cast-board-head">
              <span>top anglers</span>
              <span className="dim">{online ? "global" : "this device"}</span>
            </div>
            {board === null ? (
              <div className="dim cast-board-empty">hauling the board up...</div>
            ) : board.length === 0 ? (
              <div className="dim cast-board-empty">no one's landed anything yet. be first.</div>
            ) : (
              <ol className="cast-board-list">
                {board.map((e, i) => (
                  <li key={e.name + i}>
                    <span className="cast-rank">{i + 1}</span>
                    <span className="cast-who">{e.name}</span>
                    <span className="cast-pts">{e.score}</span>
                  </li>
                ))}
              </ol>
            )}
            {score > 0 && (
              <div className="cast-submit">
                <input
                  className="cast-name"
                  value={nameInput}
                  maxLength={14}
                  placeholder="your name"
                  onChange={(e) => setNameInput(e.target.value)}
                  aria-label="your name for the leaderboard"
                />
                <button className="cast-post" onClick={() => void postScore()} disabled={!nameInput.trim() || submitted}>
                  {submitted ? "posted" : `post ${score}`}
                </button>
              </div>
            )}
            {!online && board !== null && (
              <div className="dim cast-board-note">offline &mdash; showing this device's scores.</div>
            )}
          </div>
        )}

        {showJournal && (
          <div className="cast-journal">
            <div className="cast-board-head">
              <span>fish journal</span>
              <span className="dim">{prog.got} / {prog.total} species &middot; {stats.catches} landed</span>
            </div>
            <div className="cast-bar" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.got} aria-label="species logged">
              <span style={{ width: `${prog.pct}%` }} />
            </div>
            <ul className="cast-species">
              {TABLE.map(({ c }) => {
                const got = stats.species.includes(c.name);
                return (
                  <li key={c.name} className={`cast-sp${got ? " got" : ""}`} style={got ? { borderColor: RARITY_COLOR[c.rarity] } : undefined}
                    aria-label={got ? `${c.name}, ${c.rarity}, ${c.pts} points` : "not yet caught"}>
                    <span className="cast-sp-art" aria-hidden="true">{got ? c.art : "?"}</span>
                    <span className="cast-sp-name">{got ? c.name : "???"}</span>
                    {got && <span className="cast-sp-rar" style={{ color: RARITY_COLOR[c.rarity] }}>{c.rarity}</span>}
                  </li>
                );
              })}
            </ul>
            <ul className="cast-ach">
              {ach.map((a) => (
                <li key={a.id} className={a.done ? "done" : ""}>
                  <b>{a.done ? "done" : "to do"}</b> {a.name} <span>{a.hint}</span>
                </li>
              ))}
            </ul>
            {stats.flag && <div className="cast-flag">flag unlocked: <code>{FLAG}</code></div>}
          </div>
        )}

        <div className="cast-stage" style={panelOpen ? { display: "none" } : undefined}>
          <canvas ref={cv} className="cast-cv" aria-label="the water: tap to cast, strike and reel"
            onPointerDown={(e) => { e.preventDefault(); press(); }}
            onPointerUp={release} onPointerLeave={release} onPointerCancel={release} />
          {phase === "reeling" && (
            <div className="cast-tension" aria-hidden="true">
              <div className="cast-band" />
              <div className="cast-needle" style={{ left: `${tension}%` }} />
            </div>
          )}
          {last && (
            <div className="cast-card" key={`${last.name}-${score}-${stats.catches}`} style={{ borderColor: RARITY_COLOR[last.rarity] }} aria-hidden="true">
              <span className="cast-card-art">{last.art}</span>
              <span className="cast-card-name" style={{ color: RARITY_COLOR[last.rarity] }}>{last.name}</span>
              <span className="cast-card-pts">{last.pts >= 0 ? `+${last.pts}` : last.pts}</span>
            </div>
          )}
        </div>

        <div className="cast-msg" aria-live="polite">
          {last ? (
            <span style={{ color: RARITY_COLOR[last.rarity] }}>
              {last.art} {last.name} {last.pts >= 0 ? `+${last.pts}` : last.pts} &mdash; <i>{last.line}</i>
              {newFlag && <> <b className="cast-flag-inline">flag found: {FLAG}</b></>}
            </span>
          ) : phase === "lost" ? (
            early
              ? <span style={{ color: "#f87171" }}>you struck too early &mdash; spooked it. wait for the bobber to go red.</span>
              : <span className="dim">it got away. the sea keeps its own.</span>
          ) : phase === "approach" ? (
            <span className="dim">something's nosing the bait &mdash; not all of them commit. wait for the take.</span>
          ) : phase === "reeling" ? (
            <span className="dim">hold to pull, let go to ease. keep the needle in the bright zone.</span>
          ) : (
            <span className="dim">cast, watch the water, strike when the bobber goes red.</span>
          )}
        </div>

        <button
          ref={mainBtnR}
          className={`cast-btn ${phase === "bite" ? "hot" : ""} ${!armed && !["reeling"].includes(phase) ? "waiting" : ""}`}
          disabled={resting && !ready}
          onPointerDown={(e) => { e.preventDefault(); if (phase === "reeling") holdR.current = true; }}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          onClick={() => { if (phase === "bite") hook(); else cast(); }}
        >
          {label}
        </button>
        <p className="cast-keys">space, or tap the water, to cast, strike and reel &middot; esc to leave</p>
      </div>
    </div>
  );
}

export const FISHING_CSS = `
.cast-wrap { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; overscroll-behavior: contain;
  background: rgba(3,7,9,.78); backdrop-filter: blur(3px); animation: cast-in .18s ease-out; padding: 12px; }
@keyframes cast-in { from { opacity: 0 } to { opacity: 1 } }
.cast-panel { width: min(94vw, 600px); max-height: min(94svh, 780px); overflow: auto; background: var(--panel);
  border: 1px solid var(--line); border-radius: 14px; padding: 16px;
  box-shadow: 0 0 0 1px rgba(244,184,96,.1), 0 24px 60px rgba(0,0,0,.6); }
.cast-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cast-title { font-family: var(--serif); font-size: 24px; color: var(--txt); font-weight: 500; }
.cast-sub { font-family: var(--mono); font-size: 12px; color: var(--dim); font-weight: 400; }
.cast-x { background: none; border: 1px solid var(--line); color: var(--soft); border-radius: 8px;
  cursor: pointer; width: 44px; height: 44px; line-height: 1; font-size: 15px; }
.cast-x:hover { color: var(--amber-hi); border-color: var(--amber); }
.cast-stats { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; color: var(--soft); font-size: 12.5px; margin-bottom: 8px; }
.cast-stats b { color: var(--amber-hi); }
.cast-links { margin-left: auto; display: flex; gap: 4px; }
.cast-link { background: none; border: none; color: var(--cyan); cursor: pointer; min-height: 44px; padding: 0 8px;
  font: inherit; font-size: 12.5px; text-decoration: underline; border-radius: 6px; }
.cast-link:hover, .cast-link[aria-pressed="true"] { color: var(--amber-hi); }
.cast-board, .cast-journal { border: 1px solid var(--line); border-radius: 10px; padding: 12px; min-height: 210px; }
.cast-board-head { display: flex; justify-content: space-between; gap: 8px; color: var(--green-hi); font-size: 12.5px; margin-bottom: 8px; letter-spacing: .04em; }
.cast-board-empty, .cast-board-note { font-size: 12.5px; padding: 6px 2px; }
.cast-board-list { list-style: none; margin: 0; padding: 0; }
.cast-board-list li { display: flex; align-items: center; gap: 8px; padding: 5px 2px; font-size: 13px; border-bottom: 1px solid var(--line); }
.cast-rank { color: var(--dim); width: 20px; }
.cast-who { color: var(--txt); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cast-pts { color: var(--amber-hi); font-weight: 600; }
.cast-submit { display: flex; gap: 8px; margin-top: 10px; }
.cast-name { flex: 1; min-width: 0; background: var(--bg); border: 1px solid var(--line); min-height: 44px;
  color: var(--txt); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; }
.cast-name:focus { outline: none; border-color: var(--amber); }
.cast-post { background: transparent; border: 1px solid var(--amber); color: var(--amber-hi);
  border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; font-size: 13px;
  min-height: 44px; touch-action: manipulation; }
.cast-post:disabled { opacity: .4; cursor: default; }
.cast-post:not(:disabled):hover { background: rgba(244,184,96,.12); }
.cast-stage { position: relative; }
.cast-cv { width: 100%; height: clamp(180px, 36vw, 250px); display: block; border: 1px solid var(--line);
  border-radius: 10px; background: var(--bg); touch-action: none; cursor: pointer; }
.cast-tension { position: absolute; left: 10px; right: 10px; bottom: 10px; height: 10px;
  background: rgba(3,7,9,.8); border: 1px solid var(--line); border-radius: 999px; }
.cast-band { position: absolute; left: 28%; width: 50%; top: 0; bottom: 0; background: rgba(130,195,255,.32); }
.cast-needle { position: absolute; top: -4px; width: 3px; height: 16px; background: var(--amber);
  box-shadow: 0 0 8px var(--amber); transform: translateX(-1px); border-radius: 2px; }
.cast-card { position: absolute; top: 10px; right: 10px; display: flex; align-items: center; gap: 8px; padding: 6px 12px;
  background: rgba(8,14,26,.92); border: 1px solid var(--line); border-radius: 999px; font-size: 13px; animation: cast-card 2.2s ease both; pointer-events: none; }
.cast-card-art { font-size: 18px; }
.cast-card-pts { color: var(--amber-hi); font-weight: 700; }
@keyframes cast-card { 0% { opacity: 0; transform: translateY(-8px) scale(.94); } 12% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; } }
.cast-msg { min-height: 44px; display: flex; align-items: center; font-size: 13px; margin: 8px 2px; line-height: 1.4; }
.cast-flag-inline { color: var(--amber-hi); word-break: break-all; }
.cast-btn { width: 100%; min-height: 52px; padding: 12px; background: var(--amber);
  border: 1px solid var(--amber); color: #1a1205; border-radius: 10px; cursor: pointer; font-weight: 700;
  font: inherit; font-weight: 700; letter-spacing: .08em; transition: background .12s, color .12s, opacity .12s;
  user-select: none; touch-action: manipulation; }
.cast-btn:hover { background: var(--amber-hi); }
.cast-btn:disabled { opacity: .35; cursor: default; }
.cast-btn.waiting { background: transparent; border-color: var(--line); color: var(--soft); }
.cast-btn.hot { background: transparent; border-color: #f87171; color: #fca5a5; animation: cast-pulse .45s infinite alternate; }
@keyframes cast-pulse { to { background: rgba(248,113,113,.2) } }
.cast-keys { margin: 8px 0 0; text-align: center; color: var(--dim); font-size: 11.5px; }
.cast-bar { height: 6px; border-radius: 999px; background: var(--line); overflow: hidden; margin-bottom: 12px; }
.cast-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--green), var(--amber)); }
.cast-species { list-style: none; margin: 0 0 14px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 6px; }
.cast-sp { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 4px; border: 1px dashed var(--line); border-radius: 8px; text-align: center; color: var(--dim); }
.cast-sp.got { border-style: solid; color: var(--txt); background: rgba(255,255,255,.02); }
.cast-sp-art { font-size: 20px; line-height: 1.2; }
.cast-sp-name { font-size: 11.5px; }
.cast-sp-rar { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.cast-ach { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px; }
.cast-ach li { color: var(--dim); }
.cast-ach li b { display: inline-block; min-width: 4.2em; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; }
.cast-ach li span { display: block; color: var(--dim); font-size: 11.5px; padding-left: 4.5em; }
.cast-ach li.done { color: var(--txt); }
.cast-ach li.done b { color: var(--green-hi); }
.cast-flag { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--amber); border-radius: 8px; color: var(--amber-hi); font-size: 12.5px; word-break: break-all; }
.cast-flag code { color: var(--txt); }
/* the launcher is an ordinary link-style button in the hero (it used to float over the page corner) */
.cast-launch { cursor: pointer; font: inherit; }
@media (max-width: 640px) {
  .cast-panel { padding: 12px; }
  .cast-stats { gap: 10px; font-size: 12px; }
  .cast-links { margin-left: 0; width: 100%; justify-content: space-between; }
}
@media (max-height: 520px) { .cast-cv { height: 130px; } .cast-keys { display: none; } }
@media (prefers-reduced-motion: reduce) { .cast-wrap, .cast-btn.hot, .cast-card { animation: none; } }
`;
