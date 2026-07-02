# MEZA — Restaurant Operational Value Audit

## Value delivered at each stage (once the auth bug is fixed — see PRODUCTION_AUDIT)

**Day 1 (upload CSV only)**
A restaurant owner can sign up, create a restaurant, and upload a POS CSV export. They immediately get: total revenue/orders/AOV for the uploaded window, a revenue-by-day chart, and a channel breakdown (dine-in/delivery/etc.). This is genuine, real value from day one — it's the strongest part of the product because `pos_orders`/`pos_order_items` ingestion and the `revenue` route are fully real and correctly computed.

**Week 1**
If the owner also has occupancy data flowing in (either manual entry via the environment/occupancy pages, or the CV pipeline once deployed), they get hourly occupancy trends and can start correlating traffic with revenue. Experiment creation exists (hypothesis/control/test tracking) but experiment *results* require manually inserting `experiment_results` rows — there's no automatic before/after computation from the underlying snapshot data. Value here is real but requires manual data-science effort from the owner; it's not yet self-service insight.

**Month 1**
Intended value (per README): environment-to-outcome correlation, AI recommendations, ROI-quantified experiments. In practice, at month 1 an owner gets the same revenue/occupancy charts as week 1, just with more history — no compounding intelligence, because the "recommendations" table has no generator and experiment ROI isn't auto-computed. The product currently plateaus in value rather than deepening over time.

## Feature classification

| Feature | Classification | Rationale |
|---|---|---|
| Revenue analytics (CSV upload → charts/summary) | **Must have** | Fully real, immediate value, core to any restaurant analytics pitch. |
| Occupancy analytics | **Must have** | Real once fed data; differentiator vs. generic POS dashboards. |
| Menu mix / item-level analytics | **Should have** | `pos_order_items` captures category/dessert/drink flags but no route/UI aggregates them into menu-mix insight yet — cheap to build on existing data. |
| Environmental tracking (weather/music/lighting) | **Optional** | Real schema and manual-entry UI exist, but nothing correlates it to outcomes yet — value is speculative until an analysis layer exists. |
| Experimentation (A/B test tracking) | **Optional** | Useful for sophisticated operators, but requires the owner to compute their own results today; not self-service enough to be a headline feature at launch. |
| Recommendation engine | **Remove (for now) or must-have if kept** | Currently pure vaporware — a CRUD table with no generation logic. Either build a real (even simple, rule-based) generator before launch, or remove the UI/marketing claim; shipping an empty "Recommendations" panel actively damages trust with a paying customer. |
| CV occupancy pipeline (camera-based) | **Postpone** | Real but non-functional out of the box (missing model files, no restaurant-tuned accuracy validation, no deployment tooling). Good vision for v2, not an MVP dependency — manual occupancy entry or POS-derived table-turn data can substitute initially. |
| Labor/staffing analytics | **Should have** | `operational_snapshots` table exists (staff_count, kitchen_load, service_time) but has zero API/UI — cheap follow-on once revenue/occupancy are solid. |
| GST/tax export, daily summary reports | **Should have** | Was present in the old RestaurantApp (`app/api/reports/*`, now deleted) — Indian restaurant operators specifically need GST-compliant exports; worth rebuilding against the new schema rather than losing it. |
| Multi-role staff access | **Should have** | Needed to sell into any restaurant with more than one manager, but not needed for a single-owner pilot customer. |
| Billing/subscriptions | **Must have (for launch)**, not for pilot | Not needed to prove value to a single pilot customer, but blocks any second or third paying customer. |

## Bottom line

The honest value proposition today is: **"upload your POS CSVs, get real revenue analytics and (if you enter data) occupancy correlation."** That's a legitimate, sellable MVP for a design-partner/pilot customer. The "AI recommendations" and "environment-driven experience intelligence" positioning in the README is aspirational — the schema and UI scaffolding exist, but the intelligence layer that would justify the "Experience Intelligence Platform" name does not yet exist. Recommend either scoping the pitch down to what's real for the first paying customers, or prioritizing a minimal rule-based recommendation generator (e.g. "occupancy > 85% and queue > 5 → recommend adding evening staff") before using that language externally.
