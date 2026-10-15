// The leaderboard function must fail closed and quiet: a generic 503, never internal error text.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../../../api/leaderboard";

describe("api/leaderboard error handling", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) delete process.env[k];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { process.env = { ...saved }; vi.restoreAllMocks(); });

  it("returns 503 with a generic body when the backend is not configured", async () => {
    const res = await handler(new Request("http://x/api/leaderboard"));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "leaderboard unavailable" });
    expect(text).not.toMatch(/UPSTASH|KV_REST|token|url|Error:/i);
  });

  it("logs the real reason server-side only", async () => {
    await handler(new Request("http://x/api/leaderboard"));
    expect(console.error).toHaveBeenCalled();
  });

  it("never 500s and rejects unsupported methods without leaking", async () => {
    const res = await handler(new Request("http://x/api/leaderboard", { method: "DELETE" }));
    expect([405, 503]).toContain(res.status);
    expect(await res.text()).not.toMatch(/stack|at .*\(/i);
  });
});
