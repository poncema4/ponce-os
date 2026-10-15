// "The site remembers you": returning-visitor welcome, a persistent set of discoveries (the captain's
// log), unlock toasts, and a lantern that follows the cursor. All state lives in this browser only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DISCOVERIES, DISCOVER_EVENT, SECTION_ORDER, Memory, Lang, loadMemory, saveMemory, recordVisit, markSeen, markFound,
  progress, allSectionsSeen, isNightOwl, welcomeLine, discover, emptyMemory,
} from "./memory";

const VISIT_FLAG = "ponceos-visit-counted";   // sessionStorage: a reload is not a new visit
const WELCOME_KEY = "ponceos-welcome";        // sessionStorage: what the previous visit looked like

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

export function useSiteMemory(lang: Lang, labelOf: (id: string) => string) {
  const memRef = useRef<Memory>(emptyMemory());
  const [mem, setMem] = useState<Memory>(emptyMemory());
  const [toast, setToast] = useState<string | null>(null);
  const [welcomeInfo, setWelcomeInfo] = useState<{ visits: number; prevLast: number; prevSection: string | null } | null>(
    () => safe(() => JSON.parse(sessionStorage.getItem(WELCOME_KEY) || "null"), null),
  );
  const toastTimer = useRef<number | undefined>(undefined);

  const commit = useCallback((next: Memory) => {
    memRef.current = next; setMem(next);
    saveMemory(safe(() => localStorage, null), next);
  }, []);

  const unlock = useCallback((id: string) => {
    const r = markFound(memRef.current, id, Date.now());
    if (!r.isNew) return;
    commit(r.mem);
    setToast(id);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, [commit]);

  // load, count the visit once per session, and unlock the ones that follow from it
  useEffect(() => {
    let m = loadMemory(safe(() => localStorage, null));
    const counted = safe(() => sessionStorage.getItem(VISIT_FLAG), null);
    if (!counted) {
      const r = recordVisit(m, Date.now());
      m = r.mem;
      const info = { visits: r.mem.visits, prevLast: r.prev.last, prevSection: furthestOf(r.prev) };
      safe(() => { sessionStorage.setItem(VISIT_FLAG, "1"); sessionStorage.setItem(WELCOME_KEY, JSON.stringify(info)); }, undefined);
      setWelcomeInfo(info.visits > 1 ? info : null);
    }
    memRef.current = m; setMem(m); saveMemory(safe(() => localStorage, null), m);
    if (m.visits >= 2) unlock("regular");
    if (isNightOwl(new Date())) unlock("night-owl");
  }, [unlock]);

  // anything on the page can announce a discovery
  useEffect(() => {
    const fn = (e: Event) => { const id = (e as CustomEvent<string>).detail; if (typeof id === "string") unlock(id); };
    window.addEventListener(DISCOVER_EVENT, fn);
    return () => window.removeEventListener(DISCOVER_EVENT, fn);
  }, [unlock]);

  // which sections has this visitor actually reached?
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      let next = memRef.current;
      for (const e of entries) if (e.isIntersecting) next = markSeen(next, e.target.id);
      if (next !== memRef.current) {
        commit(next);
        if (allSectionsSeen(next)) discover("explorer");
      }
    }, { threshold: 0.25 });
    for (const id of SECTION_ORDER) { const el = document.getElementById(id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, [commit]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const welcome = useMemo(
    () => (welcomeInfo ? welcomeLine(welcomeInfo, Date.now(), lang, labelOf) : null),
    [welcomeInfo, lang, labelOf],
  );
  return { mem, toast, welcome, dismissToast: () => setToast(null) };
}

const furthestOf = (m: Memory) => {
  let best = -1;
  for (const s of m.seen) best = Math.max(best, SECTION_ORDER.indexOf(s));
  return best < 0 ? null : SECTION_ORDER[best];
};

const COPY = {
  en: { title: "Captain's log", sub: "secrets on this site, remembered by your browser only", close: "close", unlocked: "Discovery unlocked", locked: "locked", btn: "log", visits: (n: number) => `${n} visit${n === 1 ? "" : "s"}` },
  es: { title: "Diario del capitan", sub: "secretos de este sitio, guardados solo en tu navegador", close: "cerrar", unlocked: "Descubrimiento desbloqueado", locked: "bloqueado", btn: "diario", visits: (n: number) => `${n} visita${n === 1 ? "" : "s"}` },
};

export function LogButton({ mem, lang, onOpen, className }: { mem: Memory; lang: Lang; onOpen: () => void; className?: string }) {
  const p = progress(mem);
  return (
    <button className={className} onClick={onOpen} aria-haspopup="dialog" title={COPY[lang].title}>
      {COPY[lang].btn} {p.got}/{p.total}
    </button>
  );
}

export function DiscoveryToast({ id, lang }: { id: string | null; lang: Lang }) {
  const d = DISCOVERIES.find((x) => x.id === id);
  return (
    <div className="pos-toast-slot" aria-live="polite" role="status">
      {d && (
        <div className="pos-toast" key={d.id}>
          <span className="pos-toast-k">{COPY[lang].unlocked}</span>
          <b>{d[lang].name}</b>
          <span>{d[lang].hint}</span>
        </div>
      )}
    </div>
  );
}

export function CaptainsLog({ mem, lang, onClose }: { mem: Memory; lang: Lang; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const c = COPY[lang];
  const p = progress(mem);

  // a real dialog: focus moves in, the page behind does not scroll, Escape closes, focus returns
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!panel.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; before?.focus?.({ preventScroll: true }); };
  }, [onClose]);

  return (
    <div className="pos-log-wrap" role="dialog" aria-modal="true" aria-label={c.title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pos-log-panel" ref={panel} tabIndex={-1}>
        <div className="pos-log-head">
          <div>
            <h2>{c.title}</h2>
            <p>{c.sub}</p>
          </div>
          <button className="pos-log-x" onClick={onClose} aria-label={c.close}>&times;</button>
        </div>
        <div className="pos-log-meter" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.got} aria-label={c.title}>
          <i style={{ width: `${p.pct}%` }} />
        </div>
        <p className="pos-log-count">{p.got} / {p.total} &middot; {c.visits(mem.visits)}</p>
        <ul className="pos-log-list">
          {DISCOVERIES.map((d) => {
            const at = mem.found[d.id];
            return (
              <li key={d.id} className={at ? "got" : "lock"}>
                <span className="pos-log-mark" aria-hidden="true">{at ? "✓" : "?"}</span>
                <span>
                  <b>{at ? d[lang].name : "???"}</b>
                  <small>{d[lang].hint}</small>
                </span>
                <span className="pos-log-state">{at ? new Date(at).toLocaleDateString(lang === "es" ? "es" : "en", { month: "short", day: "numeric" }) : c.locked}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** A warm light that follows the cursor. Mouse-only, rAF-batched, off under reduced motion. */
export function Lantern({ reduced }: { reduced: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0, x = innerWidth / 2, y = innerHeight / 3;
    const paint = () => { raf = 0; el.current?.style.setProperty("--mx", `${x}px`); el.current?.style.setProperty("--my", `${y}px`); };
    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; el.current?.setAttribute("data-on", "1"); if (!raf) raf = requestAnimationFrame(paint); };
    const leave = () => el.current?.removeAttribute("data-on");
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => { window.removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", leave); if (raf) cancelAnimationFrame(raf); };
  }, [reduced]);
  return <div className="pos-lantern" ref={el} aria-hidden="true" />;
}

export const LOG_CSS = `
.pos-welcome { margin: -6px 0 14px; font-family: var(--serif, "Newsreader", serif); font-style: italic; font-size: 17px; color: var(--amber-hi, #ffd28a); }

.pos-lantern { position: fixed; inset: 0; z-index: 4; pointer-events: none; opacity: 0; transition: opacity .5s;
  background: radial-gradient(340px circle at var(--mx, 50%) var(--my, 30%), rgba(244,184,96,.11), rgba(244,184,96,.04) 45%, transparent 72%); }
.pos-lantern[data-on] { opacity: 1; }

.pos-toast-slot { position: fixed; left: 50%; top: 64px; transform: translateX(-50%); z-index: 90; pointer-events: none; width: min(92vw, 380px); }
.pos-toast { display: grid; gap: 2px; padding: 12px 16px; background: rgb(9,22,40); border: 1px solid var(--amber, #f4b860); border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,.55), 0 0 0 4px rgba(244,184,96,.08); animation: pos-toast-in .45s cubic-bezier(.2,.9,.3,1.2) both, pos-toast-out .5s 3.7s ease-in forwards; }
.pos-toast-k { font: 600 11px/1 "JetBrains Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--amber, #f4b860); }
.pos-toast b { font-family: "Newsreader", serif; font-size: 20px; font-weight: 500; color: #f1ead8; }
.pos-toast span:last-child { font-size: 13px; color: #a9bdc0; }
@keyframes pos-toast-in { from { opacity: 0; transform: translateY(-14px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes pos-toast-out { to { opacity: 0; transform: translateY(-8px); } }
@media (prefers-reduced-motion: reduce) { .pos-toast { animation: pos-toast-out .01s 4.2s forwards; } }

.pos-log-wrap { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 16px; background: rgba(2,4,10,.78); backdrop-filter: blur(4px); overscroll-behavior: contain; }
.pos-log-panel { width: min(560px, 100%); max-height: min(88dvh, 760px); overflow: auto; padding: 22px; background: rgb(9,22,40); border: 1px solid var(--line, #183353); border-radius: 14px; outline: none; }
.pos-log-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.pos-log-head h2 { margin: 0; font-family: "Newsreader", serif; font-weight: 500; font-size: 28px; color: #f1ead8; }
.pos-log-head p { margin: 4px 0 0; font: 12px/1.4 "JetBrains Mono", monospace; color: #8fa8ab; }
.pos-log-x { min-width: 44px; min-height: 44px; border-radius: 8px; border: 1px solid var(--line, #183353); background: transparent; color: #d5dae3; font-size: 22px; cursor: pointer; }
.pos-log-x:hover, .pos-log-x:focus-visible { border-color: var(--amber, #f4b860); color: var(--amber-hi, #ffd28a); }
.pos-log-meter { height: 6px; margin-top: 16px; border-radius: 3px; background: #0f1930; overflow: hidden; }
.pos-log-meter i { display: block; height: 100%; background: linear-gradient(90deg, #5f91d4, var(--amber, #f4b860)); transition: width .6s ease; }
.pos-log-count { margin: 8px 0 14px; font: 12px "JetBrains Mono", monospace; color: #a9bdc0; }
.pos-log-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.pos-log-list li { display: grid; grid-template-columns: 28px 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--line, #183353); border-radius: 10px; }
.pos-log-list li.got { border-color: rgba(95,145,212,.5); background: rgba(95,145,212,.06); }
.pos-log-list li.lock { opacity: .8; border-style: dashed; }
.pos-log-mark { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; border: 1px solid currentColor; font: 700 13px "JetBrains Mono", monospace; color: #8fa8ab; }
.pos-log-list li.got .pos-log-mark { color: #5f91d4; }
.pos-log-list b { display: block; font: 600 14px "JetBrains Mono", monospace; color: #f1ead8; }
.pos-log-list small { display: block; margin-top: 2px; font-size: 12.5px; color: #a9bdc0; }
.pos-log-state { font: 11px "JetBrains Mono", monospace; color: #8fa8ab; text-transform: uppercase; letter-spacing: .08em; }
`;
