# MEZA — Customer Journey Audit

Simulating a restaurant owner going through the product today (pre-fix, current disk state).

1. **Sign up** — Works. Real Supabase signup, redirects to dashboard on success. *Friction*: no email verification gate, so a typo'd email is never caught; no password-strength guidance beyond a 6-char minimum.
2. **Create restaurant** — Works (`app/create-restaurant`). *Friction*: none major, form is simple (name, location, timezone, capacity).
3. **Import POS data** — Backend exists (`app/api/pos-orders` CSV bulk import), but **there is no page/UI that calls it**. `api-client.ts` even calls a nonexistent `/pos-orders/upload` endpoint (actual route is `/pos-orders` POST with `FormData`) — so even a developer wiring this up by copying the existing client method would hit a 404. **A real owner cannot get their POS data in today without an engineer manually calling the API.** This is the single biggest customer-facing gap given "upload CSV" is the advertised Day 1 flow.
4. **Configure tables** — No dedicated table-configuration UI; `table_sessions` exist in the schema but there's no page to define a restaurant's table layout/count up front (only `max_capacity` on the restaurant record).
5. **Configure zones** — Not implemented at all (no concept of "zone" in the schema or UI beyond table regions hardcoded in the CV script for a specific camera).
6. **Configure staff** — Not implemented (no roles/members table, no staff-invite flow — see SAAS_READINESS.md).
7. **Upload historical data** — Same gap as #3; the CSV import route supports arbitrary date ranges (uses `order_time`/`order_date`/`timestamp` from the row), so historical backfill is technically supported by the backend, but again has no UI entry point.
8. **View analytics** — Would work once data exists **and** the auth bug is fixed — dashboard/revenue/occupancy pages are real and correctly wired to real endpoints.
9. **Receive recommendations** — **Cannot happen.** No code generates recommendation rows; the panel will always show "0 pending recommendations."
10. **Understand ROI** — Partially possible manually (experiment before/after revenue), but nothing computes or surfaces ROI automatically; the owner would need to read raw numbers and do the math themselves.

## Points of friction, ranked by severity

1. **Nothing works at all today** — every API call 401s due to the broken server-side auth context (PRODUCTION_AUDIT.md / SECURITY_AUDIT.md #1). This must be fixed before any of the below matters.
2. **No CSV-upload UI** — the headline "Day 1: upload CSV" flow has no button/page for a real user to click, despite the backend supporting it.
3. **No recommendations ever appear** — a customer told "get AI recommendations" will see an empty panel forever.
4. **No password reset** — a locked-out customer has no self-service path; this becomes a support burden at any scale beyond a handful of pilot users.
5. **No staff/role support** — blocks selling to any restaurant where the day-to-day data entry person isn't the account owner.
6. **[id]-route bug** — once auth is fixed, single-resource fetch/update/delete (view one restaurant, edit one experiment) will still silently fail because dynamic route params aren't read correctly (see PRODUCTION_AUDIT.md). Would surface as "can't update my restaurant name" type bug reports.

## Bottom line

The backend/data model can support the intended journey, but a real restaurant owner cannot complete it today — not because of missing features so much as broken wiring at nearly every step (auth, CSV-upload UI, id-routes) plus one entirely missing intelligence feature (recommendations). Fixing the auth-context bug and adding a CSV-upload page would unlock a genuinely usable Day-1 pilot experience; recommendations and staff roles can reasonably follow after.
