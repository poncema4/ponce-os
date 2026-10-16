import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { timeAgo, eventVerb, fetchGitHub, parseGh } from "./github";

// The uplink panel is the one part of the site that depends on a third party. The two things that
// matter: the wording never lies about time, and a rate-limited API degrades instead of throwing
// something the page cannot handle.

describe("timeAgo", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  it("never says 0m (minimum 1m)", () => expect(timeAgo(ago(5_000))).toBe("1m ago"));
  it("minutes under an hour", () => expect(timeAgo(ago(15 * 60_000))).toBe("15m ago"));
  it("59 minutes is still minutes", () => expect(timeAgo(ago(59 * 60_000))).toBe("59m ago"));
  it("hours under a day", () => expect(timeAgo(ago(5 * 3_600_000))).toBe("5h ago"));
  it("days after that", () => expect(timeAgo(ago(3 * 86_400_000))).toBe("3d ago"));
});

describe("eventVerb", () => {
  it.each([
    ["PushEvent", "pushed to"], ["CreateEvent", "created"], ["PullRequestEvent", "opened PR on"],
    ["IssuesEvent", "filed issue on"], ["WatchEvent", "starred"], ["ForkEvent", "forked"],
    ["DeleteEvent", "cleaned branch on"], ["ReleaseEvent", "released on"], ["PublicEvent", "open-sourced"],
  ])("%s -> %s", (t, v) => expect(eventVerb(t)).toBe(v));

  it("unknown event types degrade to a readable word", () => {
    expect(eventVerb("GollumEvent")).toBe("gollum");
  });
});

describe("fetchGitHub", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });

  it("fetches user, repos and events, then caches the result", async () => {
    const fetchMock = vi.fn(async (u: string) =>
      u.includes("/repos") ? ok([{ name: "ponce-os" }]) : u.includes("/events") ? ok([{ type: "PushEvent" }]) : ok({ public_repos: 12, followers: 7 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await fetchGitHub();
    expect(first.user.public_repos).toBe(12);
    expect(first.repos[0].name).toBe("ponce-os");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const second = await fetchGitHub(); // within the 4 minute TTL: served from sessionStorage
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("an expired cache entry is refetched", async () => {
    store.set("ponceos-gh", JSON.stringify({ at: Date.now() - 5 * 60_000, data: { stale: true } }));
    const fetchMock = vi.fn(async () => ok([]));
    vi.stubGlobal("fetch", fetchMock);
    await fetchGitHub().catch(() => undefined);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("a rate limit throws a clear error (the panel shows UPLINK OFFLINE)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fail(403)));
    await expect(fetchGitHub()).rejects.toThrow(/uplink 403\/403/);
  });

  it("a failing events endpoint alone does not break the panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.includes("/events") ? fail(500) : u.includes("/repos") ? ok([]) : ok({ public_repos: 1, followers: 0 }))));
    const d = await fetchGitHub();
    expect(d.events).toEqual([]);
  });
});

describe("parseGh: a 200 with the wrong shape must not reach the renderer", () => {
  // Regression: a stubbed/proxied reply of `{}` for the repos call crashed the page with
  // "t.repos.map is not a function" and white-screened the entire site.
  it("rejects a repos payload that is not an array", () => {
    expect(() => parseGh({ public_repos: 1 }, {}, [])).toThrow(/bad repos payload/);
    expect(() => parseGh({ public_repos: 1 }, { message: "API rate limit exceeded" }, [])).toThrow(/bad repos payload/);
  });
  it("rejects a missing, null or array user", () => {
    for (const bad of [null, undefined, "x", 5, []]) expect(() => parseGh(bad, [], [])).toThrow(/bad user payload/);
  });
  it("drops malformed repo and event entries instead of passing them on", () => {
    const d = parseGh({ public_repos: "12", followers: null }, [{ name: "ok" }, null, { name: 5 }, "x"], [{ type: "PushEvent", repo: { name: "a/b" }, created_at: "2026-01-01" }, { type: "PushEvent" }, null]);
    expect(d.repos.map((r) => r.name)).toEqual(["ok"]);
    expect(d.events).toHaveLength(1);
    expect(d.user).toEqual({ public_repos: 12, followers: 0, created_at: "" });
  });
  it("events that are not an array become an empty list", () => {
    expect(parseGh({}, [], { nope: 1 }).events).toEqual([]);
  });
  it("fetchGitHub throws (so the panel shows offline) on a malformed 200, and ignores a poisoned cache", async () => {
    const store = new Map<string, string>([["ponceos-gh", JSON.stringify({ at: Date.now(), data: { user: {}, repos: "nope" } })]]);
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    vi.stubGlobal("fetch", vi.fn(async () => ok({})));
    await expect(fetchGitHub()).rejects.toThrow(/uplink/);
    vi.unstubAllGlobals();
  });
});
