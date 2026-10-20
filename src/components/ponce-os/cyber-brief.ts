// Cyber Brief: client-side types, copy and helpers. The data comes from our own /api/cyber-brief
// (the CSP only allows connect-src 'self', and the edge function does the third-party fetching).

import type { Lang } from "./memory";

export interface BriefItem {
  id: string;
  title: string;
  url: string;
  source: string;
  topic: "cyber" | "ai";
  published: number;
  snippet: string;
  tag?: string;
  flag?: "model" | "alert";
}
export interface BriefSource { id: string; name: string; ok: boolean; count: number; note?: string }
export interface BriefPage {
  generated: number;
  total: number;
  page: number;
  pages: number;
  perPage: number;
  items: BriefItem[];
  archive: { ok: boolean; count: number; updated: number };
  sources: BriefSource[];
}

export const CB = {
  en: {
    host: "ponce-os",
    back: "home",
    eyebrow: "CYBER BRIEF",
    title: "The day in security and AI",
    cap: "Security and AI news from public feeds, newest first, refreshed every 30 minutes and kept in a searchable archive. Every title links to the original.",
    filterAll: "Both", filterCyber: "Security", filterAi: "AI",
    cyber: "Security news", ai: "AI news",
    updated: "Updated", ago: "ago", now: "just now",
    min: "min", hr: "h", day: "d",
    loading: "Loading today's brief...",
    error: "The brief could not be loaded right now. Try again in a minute.",
    retry: "Retry",
    empty: "Nothing new from this group in the last 7 days.",
    sources: "Sources",
    stories: "stories",
    sourceDown: "unavailable right now",
    read: "Read at",
    latest: "Recent posts",
    searchLabel: "Search the archive", searchPh: "search titles and summaries...", clear: "Clear",
    prev: "Previous", next: "Next", pageN: "Page", jump: "Go to page (type a number, press Enter)",
    newBadge: "NEW", modelBadge: "NEW MODEL", alertBadge: "ALERT",
    newSince: "new since your last visit",
    noResults: "No stories match that. Try fewer words.",
    archiveOn: "Archive", lastAdded: "newest story added", archiveOff: "Archive offline, showing live feeds only",
    storiesWord: "stories",
    topicCyber: "Security", topicAi: "AI",
    lang: "ES",
    langLabel: "Cambiar a espanol",
  },
  es: {
    host: "ponce-os",
    back: "inicio",
    eyebrow: "RESUMEN CIBER",
    title: "El dia en seguridad e IA",
    cap: "Noticias de seguridad e IA de fuentes publicas, las mas recientes primero, actualizadas cada 30 minutos y guardadas en un archivo con busqueda. Cada titulo enlaza al original.",
    filterAll: "Ambas", filterCyber: "Seguridad", filterAi: "IA",
    cyber: "Noticias de seguridad", ai: "Noticias de IA",
    updated: "Actualizado", ago: "hace", now: "justo ahora",
    min: "min", hr: "h", day: "d",
    loading: "Cargando el resumen de hoy...",
    error: "No se pudo cargar el resumen ahora. Intenta de nuevo en un minuto.",
    retry: "Reintentar",
    empty: "Nada nuevo de este grupo en los ultimos 7 dias.",
    sources: "Fuentes",
    stories: "noticias",
    sourceDown: "no disponible ahora",
    read: "Leer en",
    latest: "Publicaciones recientes",
    searchLabel: "Buscar en el archivo", searchPh: "buscar en titulos y resumenes...", clear: "Borrar",
    prev: "Anterior", next: "Siguiente", pageN: "Pagina", jump: "Ir a la pagina (escribe un numero, pulsa Enter)",
    newBadge: "NUEVO", modelBadge: "NUEVO MODELO", alertBadge: "ALERTA",
    newSince: "nuevas desde tu ultima visita",
    noResults: "Nada coincide. Prueba con menos palabras.",
    archiveOn: "Archivo", lastAdded: "ultima noticia agregada", archiveOff: "Archivo sin conexion, solo fuentes en vivo",
    storiesWord: "noticias",
    topicCyber: "Seguridad", topicAi: "IA",
    lang: "EN",
    langLabel: "Switch to English",
  },
} satisfies Record<Lang, Record<string, string>>;

export function ageLabel(ts: number, now: number, t: (typeof CB)[Lang]): string {
  const mins = Math.max(0, Math.floor((now - ts) / 60_000));
  if (mins < 1) return t.now;
  if (mins < 60) return `${mins} ${t.min}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} ${t.hr}`;
  return `${Math.floor(hrs / 24)} ${t.day}`;
}

// "5 min ago" / "hace 5 min"; "just now" stands alone.
export function agoLabel(ts: number, now: number, lang: Lang): string {
  const t = CB[lang];
  const a = ageLabel(ts, now, t);
  if (a === t.now) return a;
  return lang === "es" ? `${t.ago} ${a}` : `${a} ${t.ago}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Defence in depth: the API already filters, but never render a non-http(s) link.
export function isSafeHref(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function isBriefPage(v: unknown): v is BriefPage {
  const b = v as BriefPage | null;
  return (
    !!b && typeof b.generated === "number" && typeof b.total === "number" && typeof b.page === "number" &&
    typeof b.pages === "number" && Array.isArray(b.items) && Array.isArray(b.sources) && !!b.archive && typeof b.archive === "object"
  );
}

// Pager layout. Up to 6 pages: every number. More: a few numbers, a "jump" slot (a box you can
// type a page into) and the last page, so any page is one keystroke away. Your own page is
// always visible; "gap" is a plain ellipsis for skipped pages.
//   page 1-4:            1 2 3 4 [jump] last
//   in the middle:       1 ... c-1 c c+1 [jump] last
//   last three pages:    1 [jump] last-3 last-2 last-1 last
export type PagerSlot = number | "gap" | "jump";
export function pageList(current: number, total: number): PagerSlot[] {
  if (total <= 6) return Array.from({ length: total }, (_, n) => n + 1);
  if (current <= 4) return [1, 2, 3, 4, "jump", total];
  if (current >= total - 2) return [1, "jump", total - 3, total - 2, total - 1, total];
  return [1, "gap", current - 1, current, current + 1, "jump", total];
}

// What to do with what was typed into the jump box: a whole number inside 1..pages, or nothing.
export function parseJump(raw: string, pages: number): number | null {
  const digits = raw.trim();
  if (!/^\d{1,4}$/.test(digits)) return null;
  const n = Number(digits);
  return n >= 1 ? Math.min(n, pages) : null;
}

// "New since your last visit" needs a baseline that survives reloads within one visit:
// the first load of a browser session reads the stored last-visit time and pins it for the
// session; a first ever visit (nothing stored) has no baseline, so nothing is marked new.
export function pickBaseline(sessionVal: string | null, lastVal: string | null): number {
  const pinned = Number(sessionVal);
  if (sessionVal !== null && Number.isFinite(pinned)) return pinned;
  const last = Number(lastVal);
  return lastVal !== null && Number.isFinite(last) ? last : 0;
}

export const CYBER_CSS = `
.cb-tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 0 0 clamp(18px, 3vw, 26px); }
.cb-filters { display: flex; gap: 8px; flex-wrap: wrap; }
.cb-filters button, .cb-search button, .cb-state button { background: transparent; border: 1px solid var(--line); color: var(--soft); font: inherit; font-size: 13px;
  min-height: 44px; padding: 0 16px; border-radius: 8px; cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
.cb-filters button:hover, .cb-search button:hover, .cb-state button:hover { border-color: var(--green); color: var(--txt); }
.cb-filters button[aria-pressed="true"] { border-color: var(--amber); color: var(--amber-hi); background: rgba(244,184,96,.08); }
.cb-search { display: flex; gap: 8px; flex: 1 1 260px; min-width: 0; }
.cb-search input { flex: 1; min-width: 0; min-height: 44px; background: var(--panel); border: 1px solid var(--line); color: var(--txt);
  font: inherit; font-size: 14px; padding: 0 14px; border-radius: 8px; }
.cb-search input:focus-visible, .cb-filters button:focus-visible, .cb-pager button:focus-visible, .cb-post h3 a:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
.cb-summary { color: var(--dim); font-size: 12.5px; margin: 0 0 6px; }
.cb-summary b { color: var(--amber-hi); font-weight: 600; }
.cb-list { max-width: 820px; border-top: 1px solid var(--line); }
.cb-post { padding: clamp(18px, 2.6vw, 26px) 0; border-bottom: 1px solid var(--line); }
.cb-post h3 { font-family: var(--serif); font-weight: 500; font-size: clamp(21px, 2.6vw, 27px); line-height: 1.2; margin: 0 0 8px; overflow-wrap: anywhere; text-wrap: balance; }
.cb-post h3 a { color: var(--txt); text-decoration: underline; text-decoration-color: rgba(124,200,255,.45); text-underline-offset: 4px; text-decoration-thickness: 1px; transition: color .15s, text-decoration-color .15s; }
.cb-post h3 a:hover { color: var(--amber-hi); text-decoration-color: var(--amber); }
.cb-meta { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; color: var(--cyan); font-size: 12px; margin: 0 0 8px; }
.cb-meta .cb-dim { color: var(--dim); }
.cb-badge { font-size: 10.5px; letter-spacing: .12em; padding: 1px 7px; border-radius: 3px; border: 1px solid; text-transform: uppercase; }
.cb-badge.model { color: var(--amber-hi); border-color: rgba(244,184,96,.7); background: rgba(244,184,96,.08); }
.cb-badge.alert { color: var(--red); border-color: rgba(238,123,102,.6); }
.cb-badge.new { color: var(--green-hi); border-color: rgba(123,169,230,.6); }
.cb-snip { color: var(--soft); font-size: 14px; line-height: 1.6; margin: 0; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cb-pager { display: inline-flex; flex-wrap: wrap; margin: 28px 0 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.cb-pager > button, .cb-pager > span { min-height: 44px; min-width: 44px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center;
  background: transparent; color: var(--soft); font: inherit; font-size: 13px; border: 0; border-right: 1px solid var(--line); cursor: pointer; }
.cb-pager > :last-child { border-right: 0; }
.cb-pager > button:hover:not(:disabled):not([aria-current]) { background: rgba(255,255,255,.05); color: var(--txt); }
.cb-pager > button:disabled { color: var(--dim); cursor: default; opacity: .6; }
.cb-pager > button[aria-current="page"] { background: var(--amber); color: #1a1205; font-weight: 700; cursor: default; }
.cb-pager > span { color: var(--dim); cursor: default; }
.cb-pager .cb-arrow { display: none; }
.cb-pager .cb-jump { min-width: 52px; width: 52px; padding: 0 6px; text-align: center; background: var(--panel); color: var(--txt); font: inherit; font-size: 13px;
  border: 0; border-right: 1px solid var(--line); border-radius: 0; cursor: text; min-height: 44px; }
.cb-pager .cb-jump::placeholder { color: var(--dim); }
.cb-pager .cb-jump:focus-visible { outline: 2px solid var(--amber); outline-offset: -2px; background: rgba(244,184,96,.08); }
.cb-state { color: var(--soft); font-size: 14px; padding: 18px 0; }
.cb-state button { margin-left: 10px; color: var(--txt); }
.cb-sources { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.cb-sources li { border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px; font-size: 12px; color: var(--soft); }
.cb-sources li.down { color: var(--dim); border-style: dashed; }
.cb-sources .cb-note { color: var(--dim); }
/* the inline nav has no room for one more link between the hamburger breakpoint and 1100px (the statusbar test guards it) */
@media (max-width: 1100px) { .pos-nav a.pos-nav-cyber { display: none; } }
.cb-busy { opacity: .55; transition: opacity .15s; }
@media (max-width: 480px) { .cb-pager > button, .cb-pager > span { min-width: 38px; padding: 0 8px; } .cb-pager .cb-jump { min-width: 46px; width: 46px; } }
@media (max-width: 420px) { .cb-pager .cb-word { display: none; } .cb-pager .cb-arrow { display: inline; } }
@media (prefers-reduced-motion: reduce) { .cb-filters button, .cb-search button, .cb-post h3 a, .cb-busy { transition: none; } }
`;
