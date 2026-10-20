// Ctrl+K "jump to anything". Everything here is pure (no DOM, no React) so the ranking and the
// keyboard maths are unit-tested; palette.tsx is only the dialog around it.
import type { Lang } from "./memory";

export type PaletteGroup = "go" | "do" | "open";
export interface PaletteItem { id: string; label: string; group: PaletteGroup; keywords?: string }

/** Lowercase and strip accents so "menu" finds "menú" and "diario" finds "Diário". */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** 0 = no match. Higher = better: label prefix > word prefix > in label > in keywords > all words somewhere. */
export function score(item: PaletteItem, query: string): number {
  const q = norm(query);
  if (!q) return 1;
  const label = norm(item.label);
  const kw = norm(item.keywords ?? "");
  if (label.startsWith(q)) return 100;
  if (label.split(/[\s/()-]+/).some((w) => w.startsWith(q))) return 80;
  if (label.includes(q)) return 60;
  if (kw.includes(q)) return 40;
  const hay = `${label} ${kw}`;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => hay.includes(w))) return 30;
  return 0;
}

/** Best matches first; ties keep the original (curated) order. An empty query returns everything as-is. */
export function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  if (!norm(query)) return items;
  return items
    .map((item, i) => ({ item, i, s: score(item, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}

/** Arrow-key movement that wraps around the ends. */
export function moveIndex(i: number, n: number, dir: 1 | -1): number {
  if (n <= 0) return 0;
  return (i + dir + n) % n;
}

export const isPaletteHotkey = (e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey?: boolean; shiftKey?: boolean }) =>
  (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k";

export const hotkeyLabel = (platform: string) => (/mac|iphone|ipad/i.test(platform) ? "⌘K" : "Ctrl K");

export const SECTION_IDS = ["terminal", "service-log", "case-files", "uplink", "research", "credentials", "contact"] as const;

const COPY = {
  en: {
    placeholder: "jump to a section or run something...", empty: "nothing matches that", title: "Jump to anything", hint: "enter to run, esc to close",
    go: "go to", do: "do", open: "open",
    fish: "Cast a line (fishing game)", fire: "Fire the cannons", lang: "Switch language (EN / ES)", synth: "Toggle the synthwave",
    sound: "Toggle key sounds", log: "Open the captain's log", resume: "Download resume (PDF)", chat: "Book a chat",
    email: "Send an email", github: "Open GitHub", linkedin: "Open LinkedIn", cyber: "Open the Cyber Brief (security + AI news)",
  },
  es: {
    placeholder: "ve a una seccion o ejecuta algo...", empty: "nada coincide", title: "Ir a cualquier parte", hint: "enter para ejecutar, esc para cerrar",
    go: "ir a", do: "hacer", open: "abrir",
    fish: "Lanzar el anzuelo (juego de pesca)", fire: "Disparar los canones", lang: "Cambiar idioma (EN / ES)", synth: "Activar el synthwave",
    sound: "Activar sonido de teclas", log: "Abrir el diario del capitan", resume: "Descargar CV (PDF)", chat: "Agendar una llamada",
    email: "Enviar un correo", github: "Abrir GitHub", linkedin: "Abrir LinkedIn", cyber: "Abrir el Resumen Ciber (noticias de seguridad e IA)",
  },
} as const;

export const paletteCopy = (lang: Lang) => COPY[lang];

/** The curated list. `sectionLabels` are the site's own nav labels, so the palette never drifts from the nav. */
export function buildItems(lang: Lang, sectionLabels: Record<string, string>): PaletteItem[] {
  const c = COPY[lang];
  return [
    ...SECTION_IDS.map((id): PaletteItem => ({ id: `go:${id}`, label: sectionLabels[id] ?? id, group: "go", keywords: id.replace(/-/g, " ") })),
    { id: "resume", label: c.resume, group: "open", keywords: "cv pdf download hire" },
    { id: "chat", label: c.chat, group: "open", keywords: "calendar calendly meeting call schedule" },
    { id: "email", label: c.email, group: "open", keywords: "mail contact message reach" },
    { id: "cyber", label: c.cyber, group: "open", keywords: "cyber brief news security ai anthropic openai breach threat noticias" },
    { id: "github", label: c.github, group: "open", keywords: "code repos git" },
    { id: "linkedin", label: c.linkedin, group: "open", keywords: "profile network" },
    { id: "fish", label: c.fish, group: "do", keywords: "game cast play minigame" },
    { id: "fire", label: c.fire, group: "do", keywords: "cannons broadside ship" },
    { id: "log", label: c.log, group: "do", keywords: "discoveries secrets achievements" },
    { id: "lang", label: c.lang, group: "do", keywords: "spanish english espanol idioma" },
    { id: "synth", label: c.synth, group: "do", keywords: "music audio sound" },
    { id: "sound", label: c.sound, group: "do", keywords: "keyboard clicks audio" },
  ];
}
