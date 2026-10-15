# Security notes

A static portfolio plus one small serverless function (`api/leaderboard.ts`). This is the threat
model, what is hardened, and what is knowingly left alone.

## Hardened (OWASP Top 10 pass, 2026-10-15)

| Area | What is in place |
|---|---|
| A05 Security misconfiguration | `vercel.json` sends a strict **Content-Security-Policy** (`script-src 'self'`, `connect-src 'self' https://api.github.com`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (camera/mic/geo off), `Cross-Origin-Opener-Policy`, HSTS. The whole e2e suite runs against these exact headers. |
| A03 Injection / XSS | No `dangerouslySetInnerHTML`, no `eval`. User-visible text is rendered by React. Leaderboard names are stripped of `< > & " ' \`` and control characters on **both** client and server. |
| A04 Insecure design | The leaderboard cannot be made safe against fakes without accounts, so it is bounded instead: max score 5000, 10 submissions per IP per 60 s, names capped at 14 chars, lower re-submits cannot lower a best. |
| A06 Vulnerable components | `npm audit fix` (non-breaking) took advisories from 19 to 10. What remains is build-time Tailwind/PostCSS tooling that never ships to the browser, and one moderate `react-router` advisory that needs a breaking v7 upgrade (the app has two plain routes and no user-controlled redirects). |
| A09 Logging / errors | The API never returns stack traces; failures are a generic `leaderboard unavailable` and the game falls back to local scores. |
| Privacy | The `scan` command and the site's memory (visits, sections reached, discoveries) stay in the browser. Nothing is sent anywhere. Fonts are self-hosted, so no third party sees visitors. |

## Known limits (stated, not hidden)

1. **`VITE_ADMIN_KEY` is not a secret.** Vite inlines `VITE_*` variables into the public JavaScript
   bundle, so anyone can read it. It only unlocks a joke `cat secrets.txt`. Never reuse that value
   anywhere that matters. If it is unset in production, the `su` command simply always fails.
2. **The leaderboard is public and unauthenticated** (see A04 above): spoofable by design, bounded.
3. **CSP allows `style-src 'unsafe-inline'`** because React injects the stylesheet and inline `style`
   attributes. Scripts remain locked to `'self'`, which is the part that stops XSS.
4. **Preview/dev servers do not send these headers** (they come from `vercel.json` on Vercel).
