# Deploying MEZA

Three pieces, in this order:

1. **Supabase** — the database + auth (do this first, both platforms need its keys)
2. **Vercel** *or* **Render** — the Next.js web app (either works; configs for both are in the repo)
3. **Edge devices** (optional, per restaurant) — the CV pipeline, see [cv_pipeline/README.md](../cv_pipeline/README.md)

---

## 1. Supabase setup

1. Create a project at https://supabase.com/dashboard (any region close to your customers; free tier is fine to start).
2. Run the migrations, in order, in the SQL Editor (Dashboard → SQL Editor → New query) — or paste the combined `supabase/setup.sql` in one go:
   - paste and run `supabase/migrations/001_initial_schema.sql`
   - paste and run `supabase/migrations/002_cameras.sql`
   - paste and run `supabase/migrations/003_demo_mode.sql`

   (Alternatively, with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. Auth settings (Dashboard → Authentication):
   - **Providers → Email**: enabled by default — that's all the app uses.
   - **Confirm email**: recommended ON for production.
   - **URL Configuration → Site URL**: set to your deployed app URL (e.g. `https://meza.vercel.app`) once you have it, so email links point at the right domain.
4. Collect the two values the web app needs (Dashboard → Project Settings → API):
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   The anon key is safe to expose to browsers — every table is protected by Row Level Security. **Never** put the `service_role` key in the web app or any env var on Vercel/Render; it is only used on edge devices for the CV pipeline.

## 2a. Deploy on Vercel

The repo includes [vercel.json](../vercel.json); Vercel auto-detects Next.js, so this is mostly clicking through:

1. https://vercel.com/new → Import the GitHub repo (`ultramagnus23/Meza`).
2. Framework preset: **Next.js** (auto-detected). Leave build settings as-is.
3. Under **Environment Variables**, add (for Production, Preview, and Development):
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
4. Deploy. First build takes ~2 minutes.
5. Go back to Supabase → Authentication → URL Configuration and set **Site URL** to the Vercel URL.

Redeploys happen automatically on every push to the connected branch.

## 2b. Deploy on Render

The repo includes a [render.yaml](../render.yaml) Blueprint:

1. https://dashboard.render.com → **New → Blueprint** → connect the GitHub repo.
2. Render reads `render.yaml` and creates a `meza` web service (Node 20, `npm ci && npm run build`, `npm run start`).
3. The two Supabase env vars are declared `sync: false`, so Render will prompt you for them on first deploy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy, then set the Supabase **Site URL** to the Render URL as above.

Note: Render's free plan spins the service down when idle (cold starts of ~30s). Fine for demos; use the starter plan for anything customer-facing.

## 3. Verify the deployment

1. Open the deployed URL → you should land on `/signin`.
2. Sign up with a real email → create a restaurant → you should land on the dashboard.
3. Dashboard → Quick Actions → **Import POS Data (CSV)** → upload a CSV → revenue charts populate.
4. Dashboard → Quick Actions → **Configure Cameras & Tables** → add a camera (any RTSP URL for now) → note the camera id for edge-device setup.

If signin/signup fails with a 4xx from Supabase, re-check that both env vars are set on the platform *and* that you redeployed after setting them (`NEXT_PUBLIC_*` vars are baked in at build time — changing them requires a rebuild, not just a restart).

## 4. Demo mode (optional but recommended for a public/pilot launch)

To give visitors a "Try Demo" button on `/signin` that signs into a read-only sample restaurant with 60 days of realistic data, without them having to sign up:

1. Locally, set in `.env.local` (never on the deployed platform's public env):
   - `NEXT_PUBLIC_SUPABASE_URL` (same as above)
   - `SUPABASE_SERVICE_ROLE_KEY` — Dashboard → Project Settings → API → `service_role` (bypasses RLS; used only by the local seed script, never shipped to a browser)
   - optionally `DEMO_EMAIL` / `DEMO_PASSWORD` (defaults to `demo@meza.app` / `MezaDemo2026!`)
2. Run `npm run seed:demo`. This creates (or resets) one demo auth user + one restaurant flagged `is_demo = true`, then generates 60 days of occupancy, environment, and revenue data. Safe to re-run any time to refresh the data.
3. On Vercel/Render, set `NEXT_PUBLIC_DEMO_EMAIL` and `NEXT_PUBLIC_DEMO_PASSWORD` to the same credentials used in step 1, then redeploy — the "Try Demo" button on `/signin` only renders when both are set.
4. Migration `003_demo_mode.sql` enforces read-only at the database layer: RLS blocks every insert/update/delete against a restaurant where `is_demo = true`, regardless of which account is signed in, so the demo account can be shared publicly without risk of someone corrupting the sample data via the API directly.

## Build behavior without env vars

`next build` succeeds even when the Supabase env vars are missing or placeholders (module-level client creation falls back to an inert placeholder; `lib/supabase.ts` exports `isSupabaseConfigured` and every API route fails fast with a clear "Supabase is not configured" error at request time instead). This keeps CI/preview builds green — but the deployed app is only functional once real values are set.

## What is intentionally NOT deployed here

- **CV pipeline** — runs on hardware at the restaurant, not on Vercel/Render. See [cv_pipeline/README.md](../cv_pipeline/README.md).
- **Background jobs / cron** — none exist yet (see [DEPLOYMENT_AUDIT.md](DEPLOYMENT_AUDIT.md)).
- **Monitoring** — Sentry/PostHog not yet integrated (see [LAUNCH_ROADMAP.md](LAUNCH_ROADMAP.md)); until they are, check Vercel/Render function logs for API errors.
