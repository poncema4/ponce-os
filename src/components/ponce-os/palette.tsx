// The Ctrl+K dialog. A real modal (focus moves in, page behind does not scroll, Escape closes, focus
// returns) built on the ARIA combobox pattern so keyboard and screen-reader users get the same thing.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "./memory";
import { filterItems, moveIndex, paletteCopy, type PaletteItem } from "./palette-model";

// "go:terminal" is a valid id but an awkward one (it breaks CSS selectors), so ids are made selector-safe.
const optId = (id: string) => `pos-pal-${id.replace(/[^a-z0-9-]/gi, "-")}`;

export function CommandPalette({ items, lang, onRun, onClose }: {
  items: PaletteItem[]; lang: Lang; onRun: (id: string) => void; onClose: () => void;
}) {
  const c = paletteCopy(lang);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const shown = useMemo(() => filterItems(items, q), [items, q]);
  const idx = Math.min(active, Math.max(0, shown.length - 1));

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    input.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = prev; before?.focus?.({ preventScroll: true }); };
  }, []);

  // keep the highlighted row in view while arrowing through a long list
  useEffect(() => { list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [idx, shown]);

  const run = (item: PaletteItem | undefined) => { if (item) onRun(item.id); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(moveIndex(idx, shown.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(moveIndex(idx, shown.length, -1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(Math.max(0, shown.length - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(shown[idx]); }
    else if (e.key === "Tab") { e.preventDefault(); input.current?.focus(); } // the input is the only stop: nothing to tab out to
  };

  return (
    <div className="pos-pal-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pos-pal" role="dialog" aria-modal="true" aria-label={c.title} onKeyDown={onKey}>
        <input
          ref={input} className="pos-pal-input" value={q} placeholder={c.placeholder}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          role="combobox" aria-expanded="true" aria-controls="pos-pal-list" aria-autocomplete="list"
          aria-activedescendant={shown[idx] ? optId(shown[idx].id) : undefined}
          aria-label={c.title} spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off" enterKeyHint="go"
        />
        <ul className="pos-pal-list" id="pos-pal-list" role="listbox" ref={list} aria-label={c.title}>
          {shown.map((it, i) => (
            <li
              key={it.id} id={optId(it.id)} role="option" aria-selected={i === idx} className={i === idx ? "on" : ""}
              onMouseMove={() => i !== idx && setActive(i)} onClick={() => run(it)}
            >
              <span>{it.label}</span>
              <small>{c[it.group]}</small>
            </li>
          ))}
          {shown.length === 0 && <li className="none" role="presentation">{c.empty}</li>}
        </ul>
        <p className="pos-pal-foot" aria-hidden="true">{c.hint}</p>
      </div>
    </div>
  );
}

export const PALETTE_CSS = `
.pos-pal-wrap { position: fixed; inset: 0; z-index: 80; display: flex; justify-content: center; align-items: flex-start; padding: 14vh 16px 16px; background: rgba(2,4,10,.72); backdrop-filter: blur(4px); overscroll-behavior: contain; }
.pos-pal { width: min(560px, 100%); background: rgb(9,22,40); border: 1px solid var(--line, #183353); border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.55); overflow: hidden; }
.pos-pal-input { width: 100%; box-sizing: border-box; background: transparent; border: 0; border-bottom: 1px solid var(--line, #183353); outline: 0; color: var(--txt, #e6e1d2); font: inherit; font-size: 16px; padding: 16px 18px; caret-color: var(--amber, #f4b860); }
.pos-pal-input::placeholder { color: var(--dim, #8aa299); }
.pos-pal-list { list-style: none; margin: 0; padding: 6px; max-height: min(52dvh, 380px); overflow-y: auto; }
.pos-pal-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 12px; border-radius: 8px; color: var(--soft, #aebdb6); cursor: pointer; font-size: 14px; }
.pos-pal-list li.on { background: rgba(90,162,255,.14); color: var(--txt, #e6e1d2); }
.pos-pal-list li small { color: var(--dim, #8aa299); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; flex: none; }
.pos-pal-list li.none { cursor: default; color: var(--dim, #8aa299); justify-content: center; }
.pos-pal-foot { margin: 0; padding: 9px 16px; border-top: 1px solid var(--line, #183353); color: var(--dim, #8aa299); font-size: 11.5px; }
@media (max-width: 820px) { .pos-pal-wrap { padding-top: 10vh; } .pos-pal-list li { min-height: 48px; } }
`;
