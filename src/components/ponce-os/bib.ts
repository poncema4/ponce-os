// `cat papers.bib`: real BibTeX generated from the SAME paper data the Research section shows,
// so the terminal and the page can never disagree. Pure and unit-tested.

export interface PaperLike { id: string; title: string; venue: string; where: string; authors: string; doi: string }

/** "S. Anand" -> "Anand, S." (BibTeX wants family name first). Single tokens pass through. */
export function bibAuthor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
}

/** A BibTeX-safe key: lowercase letters and digits only. */
export function bibKey(paper: PaperLike): string {
  const first = paper.authors.split(",")[0].trim().split(/\s+/).pop() ?? "paper";
  const word = paper.title.split(/[:\s]+/)[0] ?? paper.id;
  return `${first}${word}2026`.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Escape what BibTeX treats as syntax inside a braced value. */
const esc = (s: string) => s.replace(/[{}\\]/g, "").replace(/&/g, "\\&").replace(/%/g, "\\%").replace(/#/g, "\\#");

export function toBibtex(p: PaperLike): string[] {
  const authors = p.authors.split(",").map((a) => bibAuthor(a)).join(" and ");
  return [
    `@inproceedings{${bibKey(p)},`,
    `  title     = {${esc(p.title)}},`,
    `  author    = {${esc(authors)}},`,
    `  booktitle = {${esc(p.venue)}},`,
    `  year      = {2026},`,
    `  address   = {${esc(p.where)}},`,
    `  doi       = {${p.doi.replace(/^https?:\/\/doi\.org\//, "")}},`,
    `  url       = {${p.doi}},`,
    `}`,
  ];
}

/** All papers, one blank line between entries. */
export const papersBib = (papers: PaperLike[]): string[] => papers.flatMap((p, i) => (i ? ["", ...toBibtex(p)] : toBibtex(p)));
