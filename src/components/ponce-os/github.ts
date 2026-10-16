// Live GitHub telemetry — unauthenticated public API, sessionStorage-cached
// so casual browsing never trips the 60 req/hr anonymous limit.

const USER = "poncema4";
const TTL = 4 * 60 * 1000;

export type GhData = {
  user: { public_repos: number; followers: number; created_at: string };
  repos: Array<{ name: string; html_url: string; description: string | null; stargazers_count: number; language: string | null; pushed_at: string }>;
  events: Array<{ type: string; repo: { name: string }; created_at: string }>;
};

/**
 * Trust nothing: a 200 with the wrong shape (a proxy page, an API change, a stale or hand-edited cache)
 * used to reach the renderer and white-screen the whole site. Anything malformed throws here instead,
 * which takes the same "uplink offline" path as a failed request.
 */
export function parseGh(u: unknown, r: unknown, e: unknown): GhData {
  const user = u as Partial<GhData["user"]> | null;
  if (!user || typeof user !== "object" || Array.isArray(user)) throw new Error("uplink: bad user payload");
  if (!Array.isArray(r)) throw new Error("uplink: bad repos payload");
  // Keep only entries the renderer can safely draw (it reads r.name and e.repo.name directly).
  const repos = r.filter((x) => x && typeof x === "object" && typeof x.name === "string");
  const events = Array.isArray(e) ? e.filter((x) => x && typeof x.type === "string" && x.repo && typeof x.repo.name === "string") : [];
  return {
    user: { public_repos: Number(user.public_repos) || 0, followers: Number(user.followers) || 0, created_at: typeof user.created_at === "string" ? user.created_at : "" },
    repos,
    events,
  };
}

export async function fetchGitHub(): Promise<GhData> {
  try {
    const cached = sessionStorage.getItem("ponceos-gh");
    if (cached) {
      const { at, data } = JSON.parse(cached);
      if (Date.now() - at < TTL) return parseGh(data?.user, data?.repos, data?.events);
    }
  } catch { /* unreadable or malformed cache: ignore it and fetch fresh */ }
  const [u, r, e] = await Promise.all([
    fetch(`https://api.github.com/users/${USER}`),
    fetch(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=6`),
    fetch(`https://api.github.com/users/${USER}/events/public?per_page=10`),
  ]);
  if (!u.ok || !r.ok) throw new Error(`uplink ${u.status}/${r.status}`);
  const data = parseGh(await u.json(), await r.json(), e.ok ? await e.json().catch(() => []) : []);
  sessionStorage.setItem("ponceos-gh", JSON.stringify({ at: Date.now(), data }));
  return data;
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function eventVerb(t: string): string {
  const map: Record<string, string> = {
    PushEvent: "pushed to", CreateEvent: "created", PullRequestEvent: "opened PR on",
    IssuesEvent: "filed issue on", WatchEvent: "starred", ForkEvent: "forked",
    DeleteEvent: "cleaned branch on", ReleaseEvent: "released on", PublicEvent: "open-sourced",
  };
  return map[t] || t.replace("Event", "").toLowerCase();
}
