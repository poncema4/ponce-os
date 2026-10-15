// ponce-os leaderboard — a Vercel Function. The site's first real backend.
//
// Storage: Upstash Redis (what Vercel KV became). One sorted set does the whole job:
//   ZADD  cast:board <score> <name>     -> submit
//   ZREVRANGE cast:board 0 9 WITHSCORES -> top 10
//
// THREAT MODEL, stated plainly: this endpoint is public and unauthenticated, so anyone
// can POST a fake score. That is unavoidable without real accounts. What we DO do:
//   - cap the score at something humanly reachable (MAX_SCORE)
//   - rate-limit per IP so nobody can flood the board
//   - sanitise + length-cap names (no HTML, no abuse vectors)
// This is a toy leaderboard on a portfolio, not a tournament. Cheap to fake, cheap to fix.

import { Redis } from "@upstash/redis";

const BOARD = "cast:board";
const MAX_SCORE = 5000;      // ~50 krakens. beyond this you didn't play, you POSTed.
const MAX_NAME = 14;
const RATE_MAX = 10;         // submissions per IP per window
const RATE_WINDOW = 60;      // seconds

// The Vercel<->Upstash integration injects EITHER the Upstash names OR the legacy KV
// names depending on how it provisions. Accept both so setup can't silently no-op.
function makeRedis(): Redis {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    "";
  if (!url || !token) {
    throw new Error(
      "leaderboard not configured: set UPSTASH_REDIS_REST_URL/_TOKEN (or KV_REST_API_URL/_TOKEN)"
    );
  }
  return new Redis({ url, token });
}

const clean = (s: unknown) =>
  String(s ?? "")
    // Mirrors cleanName() in src/components/ponce-os/leaderboard.ts, plus the control range.
    // \x00-\x1F written as ESCAPES, not raw bytes -- raw control bytes here made grep
    // treat this source as binary and are invisible in every editor.
    // eslint-disable-next-line no-control-regex -- stripping control characters from names is the whole point
    .replace(/[<>&"'`\x00-\x1F]/g, "")
    .trim()
    .slice(0, MAX_NAME) || "anon";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  try {
    const redis = makeRedis();

    if (req.method === "GET") {
      const raw = (await redis.zrange(BOARD, 0, 9, { rev: true, withScores: true })) as (string | number)[];
      const top: { name: string; score: number }[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        top.push({ name: String(raw[i]), score: Number(raw[i + 1]) });
      }
      return json({ top });
    }

    if (req.method === "POST") {
      // --- rate limit per IP ---
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const rlKey = `cast:rl:${ip}`;
      const hits = await redis.incr(rlKey);
      if (hits === 1) await redis.expire(rlKey, RATE_WINDOW);
      if (hits > RATE_MAX) return json({ error: "slow down" }, 429);

      const body = (await req.json().catch(() => ({}))) as { name?: string; score?: number };
      const name = clean(body.name);
      const score = Math.floor(Number(body.score));

      if (!Number.isFinite(score) || score <= 0) return json({ error: "bad score" }, 400);
      if (score > MAX_SCORE) return json({ error: "implausible score" }, 400);

      // only keep a player's BEST — GT means it never lowers an existing entry
      await redis.zadd(BOARD, { gt: true }, { score, member: name });

      const rank = await redis.zrevrank(BOARD, name);
      return json({ ok: true, name, score, rank: rank === null ? null : rank + 1 });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    // never 500 the game — the frontend falls back to local scores
    // the real reason goes to the server log only; visitors get a generic message (no env names, no stack)
    console.error("leaderboard error:", String(e).slice(0, 200));
    return json({ error: "leaderboard unavailable" }, 503);
  }
}
