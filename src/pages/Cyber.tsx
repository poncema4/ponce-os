import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CSS } from "@/components/ponce-os/styles";
import type { Lang } from "@/components/ponce-os/memory";
import {
  CB, agoLabel, hostOf, isBriefPage, isSafeHref, pageList, parseJump, pickBaseline,
  type BriefItem, type BriefPage,
} from "@/components/ponce-os/cyber-brief";

const REFRESH_MS = 10 * 60_000;

// Pinned for the browser session so a reload does not erase the "new" marks; the stored
// last-visit time moves forward on every load.
function readBaseline(): number {
  try {
    const base = pickBaseline(sessionStorage.getItem("cb-baseline"), localStorage.getItem("cb-last"));
    sessionStorage.setItem("cb-baseline", String(base));
    localStorage.setItem("cb-last", String(Date.now()));
    return base;
  } catch {
    return 0;
  }
}

function Post({ item, now, baseline, lang }: { item: BriefItem; now: number; baseline: number; lang: Lang }) {
  const t = CB[lang];
  const isNew = baseline > 0 && item.published > baseline;
  return (
    <article className="cb-post">
      <h3>
        {isSafeHref(item.url)
          ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
          : item.title}
      </h3>
      <div className="cb-meta">
        {item.flag === "model" && <span className="cb-badge model">{t.modelBadge}</span>}
        {item.flag === "alert" && <span className="cb-badge alert">{t.alertBadge}</span>}
        {isNew && <span className="cb-badge new">{t.newBadge}</span>}
        <span>{item.source}</span>
        <span className="cb-dim">{item.topic === "ai" ? t.topicAi : t.topicCyber}</span>
        <span className="cb-dim">{agoLabel(item.published, now, lang)}</span>
        <span className="cb-dim">{hostOf(item.url)}</span>
      </div>
      {item.snippet && <p className="cb-snip">{item.snippet}</p>}
    </article>
  );
}

function Pager({ page, pages, lang, go }: { page: number; pages: number; lang: Lang; go: (n: number) => void }) {
  const t = CB[lang];
  const [typed, setTyped] = useState("");
  if (pages <= 1) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseJump(typed, pages);
    setTyped("");
    if (n !== null && n !== page) go(n);
  };
  return (
    <nav className="cb-pager" aria-label={t.pageN}>
      <button type="button" disabled={page <= 1} aria-label={t.prev} onClick={() => go(page - 1)}><span className="cb-word">{t.prev}</span><span className="cb-arrow" aria-hidden="true">&lt;</span></button>
      {pageList(page, pages).map((slot, k) => {
        if (slot === "gap") return <span key={`g${k}`} aria-hidden="true">...</span>;
        if (slot === "jump") {
          return (
            <form key="jump" onSubmit={submit} style={{ display: "contents" }}>
              <input
                className="cb-jump" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} size={3}
                value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
                placeholder="_" aria-label={t.jump} title={t.jump} enterKeyHint="go"
              />
            </form>
          );
        }
        return <button key={slot} type="button" aria-current={slot === page ? "page" : undefined} aria-label={`${t.pageN} ${slot}`} onClick={() => go(slot)}>{slot}</button>;
      })}
      <button type="button" disabled={page >= pages} aria-label={t.next} onClick={() => go(page + 1)}><span className="cb-word">{t.next}</span><span className="cb-arrow" aria-hidden="true">&gt;</span></button>
    </nav>
  );
}

export default function Cyber() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  const q = params.get("q") ?? "";

  const [lang, setLang] = useState<Lang>(() => {
    try { return navigator.language.toLowerCase().startsWith("es") ? "es" : "en"; } catch { return "en"; }
  });
  const [data, setData] = useState<BriefPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState(q);
  const baseline = useRef<number | null>(null);
  if (baseline.current === null) baseline.current = readBaseline();
  const listTop = useRef<HTMLDivElement>(null);
  const t = CB[lang];

  const update = useCallback((next: { page?: number; q?: string }) => {
    const p = new URLSearchParams(params);
    const set = (k: string, v: string | number | undefined, drop: boolean) => { if (drop || v === undefined) p.delete(k); else p.set(k, String(v)); };
    if (next.q !== undefined) set("q", next.q, next.q === "");
    set("page", next.page, next.page === undefined || next.page <= 1);
    setParams(p);
  }, [params, setParams]);

  useEffect(() => {
    document.documentElement.lang = lang; // the tab title stays "Marco Ponce", like every page of the site
  }, [lang]);

  // Debounce typing into the URL; Enter / Clear apply immediately.
  useEffect(() => {
    if (draft === q) return;
    const id = window.setTimeout(() => update({ q: draft.trim(), page: 1 }), 350);
    return () => window.clearTimeout(id);
  }, [draft, q, update]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (q) qs.set("q", q);
      const res = await fetch(`/api/cyber-brief?${qs}`, { headers: { accept: "application/json" }, signal });
      if (!res.ok) throw new Error(String(res.status));
      const body: unknown = await res.json();
      if (!isBriefPage(body)) throw new Error("shape");
      setData(body);
      setFailed(false);
      setNow(Date.now());
    } catch (e) {
      if ((e as Error).name !== "AbortError") setFailed(true);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [page, q]);

  useEffect(() => {
    const ctl = new AbortController();
    void load(ctl.signal);
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    return () => { ctl.abort(); window.clearInterval(id); };
  }, [load]);

  const go = (n: number) => {
    update({ page: n });
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    listTop.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const newCount = data && baseline.current ? data.items.filter((i) => i.published > baseline.current!).length : 0;

  return (
    <div className="pos-root">
      <style>{CSS}</style>
      <header className="pos-statusbar">
        <Link className="pos-host" to="/">{t.host}</Link>
        <nav className="pos-nav" aria-label="primary"><Link to="/">{"<- " + t.back}</Link></nav>
        <div className="pos-status-right">
          <button type="button" onClick={() => setLang(lang === "en" ? "es" : "en")} aria-label={t.langLabel}>{t.lang}</button>
        </div>
      </header>

      <main>
        <section className="pos-section" aria-labelledby="cb-title">
          <p className="pos-paper-stamp">{t.eyebrow}</p>
          <h1 className="pos-h2" id="cb-title">{t.title}</h1>
          <p className="pos-cap">{t.cap}</p>

          <div className="cb-tools">
            <form className="cb-search" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: draft.trim(), page: 1 }); }}>
              <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.searchPh} aria-label={t.searchLabel} maxLength={80} />
              {(draft || q) && <button type="button" onClick={() => { setDraft(""); update({ q: "", page: 1 }); }}>{t.clear}</button>}
            </form>
          </div>

          {data && data.highlights && data.highlights.length > 0 && (
            <aside className="cb-hl" aria-labelledby="cb-hl-h">
              <h2 className="pos-h2" id="cb-hl-h" style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>{t.attention}</h2>
              <p className="cb-summary">{t.attentionCap}</p>
              <div className="cb-list">
                {data.highlights.map((it) => <Post key={`hl-${it.id}`} item={it} now={now} baseline={baseline.current ?? 0} lang={lang} />)}
              </div>
            </aside>
          )}

          <div ref={listTop} style={{ scrollMarginTop: 80 }}>
            <h2 className="pos-h2" style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>{t.latest}</h2>
            {data && (
              <p className="cb-summary" aria-live="polite">
                {data.total} {t.storiesWord}
                {newCount > 0 && <> - <b>{newCount} {t.newSince}</b></>}
                {" - "}{t.updated} {agoLabel(data.generated, now, lang)}
              </p>
            )}
          </div>

          {!data && !failed && <p className="cb-state" role="status">{t.loading}</p>}
          {failed && (
            <p className="cb-state" role="alert">{t.error}<button type="button" onClick={() => void load()}>{t.retry}</button></p>
          )}

          {data && (
            <div className={`cb-list cb-main${busy ? " cb-busy" : ""}`}>
              {data.items.length === 0
                ? <p className="cb-state">{q ? t.noResults : t.empty}</p>
                : data.items.map((it) => <Post key={it.id + it.url} item={it} now={now} baseline={baseline.current ?? 0} lang={lang} />)}
            </div>
          )}
          {data && <Pager page={data.page} pages={data.pages} lang={lang} go={go} />}
        </section>

        {data && (
          <section className="pos-section" aria-labelledby="cb-src">
            <h2 className="pos-h2" id="cb-src">{t.sources}</h2>
            <p className="pos-cap">
              {data.archive.ok
                ? `${t.archiveOn}: ${data.archive.count} ${t.storiesWord}, ${t.lastAdded} ${agoLabel(data.archive.updated, now, lang)}`
                : t.archiveOff}
            </p>
            <ul className="cb-sources">
              {data.sources.map((s) => (
                <li key={s.id} className={s.ok ? "" : "down"}>
                  {s.name}{!s.ok && ` - ${t.sourceDown}`}{s.note && <span className="cb-note"> ({s.note})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
