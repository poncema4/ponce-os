// Run by .github/workflows/news-archive.yml every 30 minutes: fetch every source, merge into
// the archive, write news.json. The workflow commits it to the `news-data` branch only when it
// changed. Usage: tsx scripts/news-archive.ts <path to news.json>

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { archiveChanged, collectLive, isArchive, mergeArchive, type Archive, type Item } from "../api/_lib/brief";

const file = process.argv[2];
if (!file) {
  console.error("usage: news-archive.ts <news.json>");
  process.exit(2);
}

let old: Item[] = [];
if (existsSync(file)) {
  try {
    const data: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (isArchive(data)) old = data.items;
  } catch {
    console.error("existing archive unreadable, starting from the live feeds");
  }
}

const now = Date.now();
const live = await collectLive(now);
for (const s of live.sources) console.log(`${s.ok ? "ok  " : "DOWN"} ${s.name} (${s.count})`);

// If every source failed, keep the old file untouched rather than aging it out.
if (live.items.length === 0) {
  console.error("no items from any source; leaving the archive as it was");
  process.exit(old.length ? 0 : 1);
}

const items = mergeArchive(old, live.items, now);
if (!archiveChanged(old, items) && existsSync(file)) {
  console.log(`archive: ${old.length} items, nothing new`);
  process.exit(0);
}
const before = new Set(old.map((i) => i.url));
const added = items.filter((i) => !before.has(i.url)).length;
const next: Archive = { version: 1, updated: now, items };
writeFileSync(file, JSON.stringify(next));
console.log(`archive: ${old.length} -> ${items.length} items (+${added} new)`);
