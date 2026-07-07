---
register: product
---

# MEZA — Product context

## What it is

A restaurant experience-intelligence platform. Reads occupancy (CCTV-derived
table/queue counts), environment (temperature, music, lighting, weather),
and POS export data, and turns it into dashboards, A/B-style experiments,
and rule-based recommendations. Not a POS system. Not a booking system.

## Users

Restaurant owner-operators and managers (India-first, `timezone` defaults to
`Asia/Kolkata`, currency is INR/₹). Single-owner pilot customers today, not
yet multi-role staff accounts. The primary user is glancing at this during
live service (a dim dining room, evening) as well as reviewing it the next
morning at a desk in daylight — both usage modes are real and current.

## Screens that exist today

- `/dashboard` — today's metrics (occupancy %, revenue, dwell time, queue),
  hourly occupancy chart, revenue trend chart, experiment/recommendation
  counts, quick actions.
- `/occupancy` — occupancy analytics over a date range.
- `/environment` — manual environment logging form + recent readings table
  + averages. Environment data can now also arrive from `edge_sensors/`
  (real hardware or `--mock`) or a weather API, tagged via
  `environment_snapshots.source` (`manual`/`sensor`/`weather_api`).
- `/experiments` — hypothesis/control/test tracking, list + create form.
- `/recommendations` — list of recommendation rows, mark-implemented action.
  Now has a real generator (`lib/recommendation-engine.ts`, Vercel Cron)
  behind it — correlation + threshold rules over real data, not manually
  authored.
- `/cameras` — camera CRUD: RTSP url, per-camera `table_regions` (each a
  `{ table_number, x1, y1, x2, y2 }` box in 0-1 fractional frame
  coordinates) and one optional `queue_region`. This is real per-camera
  floor geometry already stored in the schema, drawn today only as a form,
  never visualized as a plan.
- `/upload` — POS CSV import.
- `/signin`, `/signup`, `/create-restaurant` — auth + onboarding.
- `/` (`app/page.tsx`) — not a landing page today; immediately redirects to
  `/dashboard` or `/signin` depending on auth state. There is no marketing
  surface for logged-out visitors right now beyond the sign-in page's
  "Try Demo" button and one line of demo copy.

## Real data available for a floor-plan-style view

- `cameras.table_regions` — per-restaurant, per-camera table positions
  (fractional box coordinates + `table_number`), already both read and
  written via `/cameras`.
- `table_sessions` — `table_number`, `party_size`, `start_time`, `end_time`
  (null = currently seated), `dwell_time`, `order_value`, `dessert_count`,
  `drink_count`. A currently-occupied table is one with a `table_sessions`
  row whose `end_time is null`.
- `occupancy_snapshots` — aggregate counts (`occupancy_percentage`,
  `occupied_tables`, `queue_length`, `wait_time`) at a point in time, from
  either manual entry or the CV pipeline (`cv_pipeline/occupancy_detector.py`,
  currently YOLOv8n-based, per-camera).
- No API route today aggregates "which tables are occupied right now,
  mapped onto their `table_regions` positions" — this is new plumbing
  needed for a real floor-plan view, not just a new component.

## Backstage machinery (must never surface in copy/UI)

CCTV/YOLOv8 person detection, ROI regions, "detections", "frames",
"snapshots" as a technical noun. The product's own vocabulary in code/API
is already snapshot/detection-flavored (`occupancy_snapshots`, camera
`last_snapshot_at`) - that's fine as internal naming, but user-facing copy
should speak in tables, covers, turns, service, wait instead.

## Current design system (as of this pass, before redesign)

- Tailwind v4, CSS custom properties in `app/globals.css`, shadcn/ui
  component primitives in `components/ui/`.
- Dark mode via `next-themes`, `attribute="class"`, `defaultTheme="dark"`.
  **Bug found in recon**: `:root` and `.dark` currently define identical
  oklch values - there is no actual light mode today despite the toggle
  plumbing existing (`useStore.theme`, `next-themes`).
- Accent hue is 290 (blue-violet/purple) in `--accent`, `--chart-3`,
  `--sidebar-accent-foreground`-adjacent surfaces, and in three radial
  gradients painted behind the whole app as an ambient "wallpaper" for a
  macOS-vibrancy aesthetic (translucent blurred sidebar/header over it).
- Chart components (`MetricCard.tsx` sparklines, `RevenueChart.tsx`)
  render `linearGradient` fills under area/line charts.
- `MetricCard.tsx` is the hero-metric-card pattern (icon chip + big number +
  trend + sparkline), repeated across `/dashboard`.
- No custom display/mono fonts loaded - system font stack
  (`-apple-system`/`SF Pro`/`SF Mono`) throughout.
- No real floor-plan visualization exists anywhere yet.

## Anti-references (explicitly, from this redesign's brief)

Purple SaaS, black-with-neon "AI vision" dashboards, generic admin
templates, macOS-vibrancy glassmorphism (the current look), hero-metric
card grids, gradient fills/text, radar/scan-line effects.
