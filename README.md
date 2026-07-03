# MEZA — Experience Intelligence Platform

Restaurant experience intelligence: understand how occupancy, environment, and
operational conditions influence customer behavior and revenue, using
anonymous occupancy analytics and revenue data. Not a POS system — MEZA reads
signals (CCTV-derived occupancy, environment, POS exports) and turns them into
dashboards, experiments, and recommendations.

## Try it in 2 minutes

No signup, no camera, no setup:

1. Open the deployed app (or run `npm install && npm run dev` locally).
2. On the sign-in page, click **Try Demo**.
3. You're in a read-only demo restaurant ("Meza Demo Bistro") with 60 days of
   realistic occupancy, environment, and revenue data already loaded.
4. Click through **Dashboard → Occupancy → Environment → Experiments →
   Recommendations** — every chart and table is populated, including a
   completed experiment with real measured results.
5. Nothing you click can modify the data (enforced by Row Level Security, not
   just the UI) — explore freely.

If the demo button isn't visible, it hasn't been configured for this
deployment yet — see [Demo mode](#demo-mode) below to set it up.

## Screenshots

_Screenshots aren't checked into this repo yet — this session's sandbox
couldn't capture them (headless preview rendering timed out). To add them:
run `npm run dev`, sign in via **Try Demo**, and capture `/dashboard`,
`/occupancy`, `/environment`, `/experiments`, and `/recommendations` into
`docs/screenshots/`, then reference them here, e.g.:_

```markdown
![Dashboard](docs/screenshots/dashboard.png)
![Occupancy Analytics](docs/screenshots/occupancy.png)
```

## Features

- **Occupancy Analytics** - Real-time table and people counting from existing CCTV
- **Environmental Tracking** - Temperature, music, lighting, weather correlations
- **Revenue Analytics** - Daily revenue trends and order analysis
- **Experimentation** - Design and track A/B tests for environment optimization
- **Recommendations** - Data-driven suggestions for improving experience

## Privacy

This system does NOT collect:
- Customer names, phone numbers, or IDs
- Facial recognition or biometric data
- Images (processed and discarded immediately)
- WiFi device tracking

This system DOES collect:
- Anonymous occupancy counts
- Table utilization metrics
- Queue length and wait times
- Environmental conditions (temperature, music, lighting)

## Setup

1. Create a Supabase project at https://supabase.com
2. Run the SQL migrations in order: `supabase/migrations/001_initial_schema.sql`, then `002_cameras.sql`, then `003_demo_mode.sql` (or paste the combined `supabase/setup.sql`)
3. Copy `.env.example` to `.env.local` and add your Supabase credentials
4. Install dependencies: `npm install`
5. Run development server: `npm run dev`

## Demo mode

MEZA can seed a fully-populated, read-only demo restaurant so anyone can
explore the product without signing up or connecting real data:

```bash
# .env.local also needs SUPABASE_SERVICE_ROLE_KEY (Project Settings -> API)
npm run seed:demo
```

This creates one demo auth account and one restaurant flagged `is_demo =
true`, then generates 60 days of occupancy, environment, revenue, experiment,
and recommendation data shaped like a real restaurant (weekday/weekend
patterns, lunch/dinner peaks). Set `NEXT_PUBLIC_DEMO_EMAIL` /
`NEXT_PUBLIC_DEMO_PASSWORD` (same values used above) to make the **Try Demo**
button appear on `/signin`. Read-only is enforced by `003_demo_mode.sql`'s RLS
policies at the database layer, not just in the UI — see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#4-demo-mode-optional-but-recommended-for-a-publicpilot-launch)
for the full walkthrough.

## Deployment

One-click-ish deploys to **Vercel** (`vercel.json`) or **Render** (`render.yaml` Blueprint) are configured in-repo. Full step-by-step guide, including Supabase setup and post-deploy verification: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Architecture

- **Frontend**: Next.js 14 (App Router) + React + TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email/password)
- **CV Pipeline** *(optional hardware add-on)*: Python script for edge device (Raspberry Pi / Jetson Nano) — has a `--simulate` mode that needs no camera; see [cv_pipeline/README.md](cv_pipeline/README.md)
- **Charts**: Recharts

## Project Structure

```
app/
  api/           # API routes (restaurants, occupancy, revenue, etc.)
  signin/ signup/ create-restaurant/  # Auth & onboarding pages
  dashboard/     # Main dashboard
  occupancy/     # Occupancy analytics
  environment/   # Environmental tracking
  experiments/   # Experiment management
  recommendations/ # Data-driven recommendations
  cameras/       # CCTV camera & table-region configuration
  upload/        # POS CSV import
components/      # React components
lib/            # Supabase client, types, store, API client
cv_pipeline/    # Python CV pipeline for edge devices (optional add-on)
scripts/        # Demo data seed script
supabase/       # Database migrations
```

## MVP Deployment

- **Cost**: Free to launch (Vercel/Render + Supabase free tiers). Optional CV hardware add-on: under ₹10,000 (Raspberry Pi 4 + cables)
- **Timeline**: Live in minutes with demo mode; 2-4 weeks for a camera-equipped pilot
- **Data**: Manual entry and POS CSV import work with zero hardware; existing CCTV cameras are an optional automation layer
- **Privacy**: Zero PII collected
