---
register: product
---

# MEZA — Design system ("The Service Floor")

Calm, spatial, architect's-floor-plan-lit-for-evening-service. Not purple
SaaS, not black-with-neon "AI vision," not a generic admin template.

## Color

Strategy: **Restrained** - tinted neutrals + one accent (candle) at <=10% of
any viewport. OKLCH throughout, every neutral tinted warm (hue ~50-70),
never true gray, never `#000`/`#fff`.

Existing shadcn-style CSS variable names are kept (`--background`,
`--primary`, etc. - see `app/globals.css`) so every `components/ui/*`
primitive works unmodified; only the values changed. Poetic aliases
(`--room`, `--panel`, `--plaster`, `--candle`, `--sage`, `--ember`,
`--line`) are defined alongside for scene-specific work (inline SVG fills
especially read more clearly under their own name).

| Token | Role | Light | Dark |
|---|---|---|---|
| room (`--background`) | page bg | oklch(0.96 0.006 60) warm porcelain | oklch(0.19 0.012 50) warm charcoal |
| panel (`--card`) | surfaces | oklch(0.99 0.003 70) | oklch(0.24 0.014 50) |
| plaster (`--foreground`) | ink | oklch(0.25 0.02 50) | oklch(0.92 0.01 70) |
| candle (`--primary`) | single accent, <=10% of viewport | oklch(0.72 0.13 65) | oklch(0.76 0.14 65) (brighter) |
| sage (`--success`) | "turning well / free" | oklch(0.53 0.08 148) | oklch(0.68 0.09 148) |
| ember (`--destructive`/`--danger`) | real problems only | oklch(0.48 0.16 30) | oklch(0.62 0.18 25) |
| line (`--border`/`--input`) | hairlines | oklch(0.3 0.02 60 / 0.14) | oklch(0.88 0.02 60 / 0.1) |
| `--accent` | neutral hover/selection tint, NOT candle | oklch(0.9 0.01 60) | oklch(0.3 0.014 55) |
| `--candle-dim` | long-stayer dimming toward umber | oklch(0.55 0.06 58) | oklch(0.5 0.06 58) |

Charts: candle for tonight's series, plaster @ 40% opacity (`--chart-2`)
for comparison periods. No rainbow series, no gradient fills under lines
or areas (`RevenueChart`/`OccupancyChart`/`CorrelationScatter`).

## Typography

- Display (`font-display`): Archivo, 600/700 weight, wide tracking on
  headings - approximates "Archivo Expanded" (Google Fonts serves width as
  an axis of one family, not a separate static cut).
- Body (`font-sans`): Instrument Sans, 16px base.
- Data (`font-mono`): Spline Sans Mono - all counts, timers, timestamps,
  table numbers, currency values. `tabular-nums` on anything that updates.

All three loaded via `next/font/google` in `app/layout.tsx`.

## Components

- `StatLedger` (`components/StatLedger.tsx`) - a row of "tonight's
  numbers": mono digits, hairline dividers, no card chrome, no icon chips,
  no gradient sparkline. Replaces the hero-metric-card grid pattern
  (former `MetricCard.tsx`, deleted).
- `Ledger` (same file) - dense table with hairline row dividers, for lists
  of services/recommendations/experiments. Column headers should be real
  labels, not empty strings (a 2-column key/value summary should be a
  plain flex list instead, not a mis-keyed table - see `app/dashboard`'s
  "Tonight" section).
- `AppShell` - solid rail sidebar (no vibrancy/blur/translucency, no
  decorative traffic-light dots), header is a flat `bg-background` with a
  hairline bottom border. Active nav item: neutral `bg-sidebar-accent`
  tint + candle-colored icon only (not a colored stripe, not a filled
  candle background - that would blow the <=10% budget fast across a
  7-item nav list).
- `components/landing/FloorScene.tsx` - decorative, clearly-labeled
  simulated floor-plan replay for the landing hero only. Real data-backed
  floor plan (joining `cameras.table_regions` + live `table_sessions`) is
  separate follow-on work, not this component.

## Bans (still enforced - re-check before adding anything new)

Side-stripe borders >1px, gradient text/backgrounds, glassmorphism as
default, hero-metric-card blocks, identical icon-card grids, any purple,
radar/scan-line/"AI vision" effects, modals as first resort (destructive
confirms only), em dashes in copy, `bg-black`/`bg-white`/hardcoded hex
outside this file's token table.

## Known gaps / follow-on work

- Real floor-plan feature (Phase B, deferred by explicit user choice):
  data-backed SVG scene joining `cameras.table_regions` + `table_sessions`,
  click-to-side-panel table detail, dockable/collapsible panel workspace,
  "service mode" (hide-chrome keystroke), night-ledger sparkline table for
  historical services.
- `app/experiments`, `app/cameras`, `app/upload` were verified for banned
  patterns (none found) but not restyled beyond the global token change -
  they inherit correctly since they use `components/ui/*` primitives, but
  haven't had a copy/hierarchy pass the way `dashboard`/`occupancy`/
  `environment`/`recommendations` did.
