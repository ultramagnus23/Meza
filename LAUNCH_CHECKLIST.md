# MEZA — Launch Checklist

Status as of this audit. Historical audits in `docs/` (`SECURITY_AUDIT.md`,
`FAKE_IMPLEMENTATION_AUDIT.md`, `LAUNCH_ROADMAP.md`, etc.) describe an earlier
state of the codebase — several of their "Critical"/"BLOCKER" items are
already fixed (see "Resolved this pass" below). Treat this file, not those,
as the current source of truth.

## Done

- [x] **Identity/positioning**: GitHub repo description and topics rewritten
      to describe one product (occupancy/environment/revenue analytics),
      removing stale POS/Express/Prisma/FastAPI claims. README rewritten to
      match, with a 5-step "try it in 2 minutes" section and a demo-mode
      section.
- [x] **Demo mode**: `scripts/seed-demo.mjs` generates 60 days of realistic
      synthetic occupancy/environment/revenue/experiment/recommendation data
      for one demo restaurant. `supabase/migrations/003_demo_mode.sql` adds
      an `is_demo` flag and rewrites every write-side RLS policy so that
      restaurant's data is genuinely read-only at the database layer,
      regardless of who's signed in. "Try Demo" button wired into
      `/signin`, gated on `NEXT_PUBLIC_DEMO_EMAIL`/`NEXT_PUBLIC_DEMO_PASSWORD`
      being set.
- [x] **Dashboard page audit**: all five analytics pages (dashboard,
      occupancy, environment, experiments, recommendations) plus cameras and
      upload confirmed to have loading states, safe empty-array handling
      (no crashes on zero data), and explicit empty-state messaging. Added
      user-visible error toasts (`sonner`) on every failed data load —
      previously failures were silently swallowed to `console.error`, which
      looked indistinguishable from "no data yet."
- [x] **API/RLS audit** — two real bugs found and fixed:
  - `app/api/cameras/[id]/route.ts` GET/PATCH/DELETE didn't scope by
    restaurant ownership (RLS technically still blocked cross-tenant access,
    but the route lacked the same defense-in-depth filter every other
    `[id]` route uses — now fixed for consistency).
  - `app/recommendations/page.tsx`'s "Dismiss" button called the same
    "mark implemented" update as the "Implement" button. Added a real
    `DELETE /api/recommendations/[id]` route + `dismissRecommendation()` API
    client method and wired Dismiss to actually remove the recommendation.
- [x] **Auth-bypass bug fixes** (both broke real user flows, not just
      style): `app/create-restaurant/page.tsx` and
      `app/experiments/page.tsx`'s delete handler used raw `fetch()` instead
      of the `api` client, so neither ever attached the session's bearer
      token — every new user's first restaurant-creation request and every
      experiment delete would have 401'd in production. Both now go through
      `lib/api-client.ts`.
- [x] **cv_pipeline is now explicitly optional**: README and
      `cv_pipeline/README.md` reposition it as a hardware add-on, not a
      requirement — the app works via manual entry and POS CSV import with
      zero hardware. Added `--simulate` flag to
      `cv_pipeline/occupancy_detector.py` that posts realistic synthetic
      occupancy snapshots on a schedule with no RTSP stream, no detector
      model, and no `opencv-python` dependency required.
- [x] **Build is clean**: `npm run build` — zero type errors, zero
      lint warnings (previously 7 `react-hooks/exhaustive-deps` warnings,
      now suppressed with explicit comments since the omitted deps are
      intentional — re-including `router`/`load*` would cause fetch loops).
      `next.config.mjs` does not set `ignoreBuildErrors` (confirmed already
      fixed from the historical audit).

## Before a public/pilot launch

These are real gaps, not covered by this pass — prioritized by risk:

1. **Rate limiting** on `/api/auth/signin` and `/api/auth/signup`. Neither
   currently has any throttling — open to credential stuffing and signup
   spam. Cheapest fix: Vercel/Upstash Redis rate limiter, or configure
   Supabase Auth's built-in rate limits at the project level.
2. **Error tracking / monitoring**. No Sentry, no structured logging. Right
   now a production bug is only visible via Vercel/Render function logs.
   Wire up Sentry (client + API routes) before relying on this for real
   customers.
3. **Password reset flow**. Supabase supports `resetPasswordForEmail()`, but
   no reset page/flow exists in the app yet. Users who forget their password
   have no self-serve path.
4. **Single-owner-per-restaurant model**. There's no team/role concept
   (owner/manager/staff) — matches the current schema
   (`restaurants.owner_id`) but blocks multi-person accounts. Fine for an
   MVP pilot, a real gap for team accounts.
5. **CSV upload hardening** (`app/api/pos-orders` POST): no file-size limit
   or row cap, and inserts are one-by-one rather than batched. A large CSV
   is a slow request and a real cost/DoS vector against Supabase's request
   quota.
6. **Recommendation generation is manual only**. The `/recommendations`
   page and API are fully real (this pass added the missing Dismiss/DELETE
   path), but nothing in the codebase computes a recommendation from
   occupancy/revenue/environment data automatically — every recommendation
   in the demo seed is hand-written. Either build a simple rule-based
   generator or keep messaging honest that this is a manual/future feature.
7. **CV pipeline accuracy is unvalidated** against real restaurant camera
   angles (generic pretrained SSD model, not fine-tuned) — see
   `docs/ML_AUDIT.md`. Not a blocker since it's now explicitly optional, but
   don't market it as production-accurate until validated at a pilot site.
8. **Screenshots**: this session's sandbox couldn't capture real screenshots
   (headless preview timed out). Run `npm run dev`, sign in via Try Demo,
   and capture `/dashboard`, `/occupancy`, `/environment`, `/experiments`,
   `/recommendations` into `docs/screenshots/`, then link them from the
   README's Screenshots section (placeholder instructions already there).

## Deploy steps (once the above is acceptable for your launch bar)

1. Supabase: run `supabase/setup.sql` (or the three migrations in order) on
   a real project. Set **Auth → Confirm email** on, and **Site URL** to your
   deployed domain once known.
2. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` on
   Vercel or Render (see `docs/DEPLOYMENT.md`).
3. Optional demo mode: set `SUPABASE_SERVICE_ROLE_KEY` locally only, run
   `npm run seed:demo`, then set `NEXT_PUBLIC_DEMO_EMAIL` /
   `NEXT_PUBLIC_DEMO_PASSWORD` on the deploy platform and redeploy.
4. Deploy, verify `/signin` loads, sign up a real test account, create a
   restaurant, upload a sample POS CSV, confirm the dashboard populates.
5. Confirm the Try Demo button (if enabled) signs in and every page renders
   with data, and that no write action on the demo account succeeds
   (expect an RLS-driven error toast).
