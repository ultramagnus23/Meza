# MEZA — Security Audit

## Critical

**1. Broken server-side auth context (all API routes).**
`lib/supabase.ts` exports a single module-level `createClient(url, anonKey)` with no cookie handling and no `@supabase/ssr`/`@supabase/auth-helpers-nextjs` dependency. Every API route calls `supabase.auth.getUser()` on this shared client, but the caller's JWT is never attached (the frontend's `fetchAPI` in `lib/api-client.ts` sends no `Authorization` header, and no cookie-based session bridge exists). Practical impact:
- Every "protected" route either always returns `401` for legitimate users, or — because the client is a **shared, module-scoped singleton** reused across concurrent serverless invocations on a warm instance — there is a real risk that one user's transient auth state (if ever set via a server call to `signInWithPassword`/`signUp` on this shared object) could be read back by a *different* concurrent request. This is a session-confusion / cross-tenant-data-leak class bug, not just a broken feature.
- **Fix**: switch to `@supabase/ssr`'s `createServerClient` (cookie-based) or have the frontend send `Authorization: Bearer <access_token>` and construct a **per-request** client (`createClient(url, anonKey, { global: { headers: { Authorization } } })`) inside each route handler — never a module-level singleton holding session state.

**2. RLS is currently non-functional as a live safety net.**
Because `auth.uid()` never resolves (see #1), Postgres RLS policies silently return empty result sets instead of actively gatekeeping. The schema/policy design itself is correct (see PRODUCTION_AUDIT.md → Database) — this will self-resolve once #1 is fixed, but until then, RLS is not actually protecting anything in production traffic; the illusion of tenant isolation is more dangerous than an obvious lack of it.

## High

**3. No rate limiting anywhere**, including `app/api/auth/signup` and `app/api/auth/signin`. Open to credential-stuffing/brute-force on signin and mass fake-account signup spam. Recommend at minimum an IP-based rate limit (Vercel Edge Config/Upstash Redis, or Supabase's own auth rate limits if configured at the project level) before launch.

**4. No password reset flow.** Not a vulnerability per se, but the absence of a controlled reset path increases the chance of users reusing weak/shared credentials or asking support to reset accounts through an insecure side channel.

**5. `next.config.mjs`: `typescript.ignoreBuildErrors: true`.** Ships type errors to production silently, including logic bugs that can have security implications (e.g. an `undefined` variable used where an authorization check was intended). Remove before launch.

## Medium

**6. CSV upload (`app/api/pos-orders` POST) has no file-size limit or row-count cap.** A large/malicious CSV could cause excessive memory use or a long-running request (the loop performs a Supabase insert per order, serially — also a DoS-by-cost vector against Supabase's request quota). Add a max file size and row cap, and consider batching inserts.

**7. Broad `any` typing across API route bodies** (`const body = await req.json()` with no schema validation) — routes like `recommendations POST`, `experiments PATCH`, `restaurants PATCH` pass client-supplied objects close to directly into Supabase `.insert()/.update()` calls. Not classic SQL injection (Supabase's query builder parameterizes correctly), but it does allow a client to set fields it shouldn't (e.g. `implemented_at`, `updated_at`, or theoretically `owner_id`/`restaurant_id` on some payloads) if RLS doesn't independently block the write. Recommend an explicit allow-list of updatable fields per route, and schema validation (zod) on all POST/PATCH bodies.

**8. No CSRF protection**, but risk is low since these are JSON APIs (not form-encoded, and browsers won't auto-attach a fetch's custom `Content-Type: application/json` cross-origin without a preflight, which Next.js API routes don't currently validate `Origin` on). Recommend adding an `Origin`/`Referer` check on state-changing routes as defense-in-depth once billing exists.

**9. No SSRF surface found** — no route accepts a URL and fetches it server-side. Not applicable currently, but worth re-checking if a "connect your POS" webhook/integration is added later.

## Low / informational

- `.env.local` is correctly gitignored (`.env*` in `.gitignore`) and only contains the client-safe `NEXT_PUBLIC_*` Supabase keys — no secret leakage found in the repo.
- No hardcoded credentials found in committed code; the only credential-shaped strings are deliberate placeholders in `cv_pipeline/occupancy_detector.py` meant to be edited per-deployment.
- No `middleware.ts` exists — acceptable if RLS + fixed server auth become the actual gate, but currently means there is no edge-level session refresh, so once auth is fixed, session-expiry handling needs to be verified client-side (`onAuthStateChange` in `auth-provider.tsx` already handles this reasonably).
- No dependency-vulnerability scanning configured (no `npm audit` in CI, no Dependabot config observed).

## OWASP Top 10 mapping (summary)

| Category | Status |
|---|---|
| A01 Broken Access Control | **Critical** — see #1, #2 |
| A02 Cryptographic Failures | OK — Supabase manages auth token crypto; no custom crypto found |
| A03 Injection | OK — Supabase query builder parameterizes; no raw SQL string concatenation found |
| A04 Insecure Design | High — no rate limiting, no plan limits, singleton auth client design |
| A05 Security Misconfiguration | High — `ignoreBuildErrors`, no CI, no CSP/headers configured |
| A06 Vulnerable Components | Unknown — no audit tooling configured |
| A07 Identification/Auth Failures | Critical — see #1, #3, #4 |
| A08 Software/Data Integrity | Medium — no schema validation on write payloads (#7) |
| A09 Logging/Monitoring Failures | High — no error tracking or structured logs (see DEPLOYMENT_AUDIT.md) |
| A10 SSRF | Not applicable currently |
