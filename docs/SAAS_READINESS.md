# MEZA — Multi-Tenant SaaS Readiness Audit

Assumption: selling to hundreds of independent restaurants, each an isolated tenant.

## Authentication

| Capability | Status |
|---|---|
| Signup | Real (`app/api/auth/signup`, `supabase.auth.signUp`), minimal validation (email/password presence, 6-char min). No email-format validation, no password-strength policy beyond length. |
| Login | Real (`supabase.auth.signInWithPassword`). |
| Email verification | Not enforced anywhere in-app. Supabase project-level "confirm email" setting is unknown/unconfigured in-repo; nothing in the app blocks an unverified user from using the product. |
| Password reset | **Missing entirely** — no route, no page, no `supabase.auth.resetPasswordForEmail` call anywhere in the repo. A locked-out user has no self-service recovery path. |
| Session management | Client-side session lives in `supabase-js` (localStorage), refreshed via `onAuthStateChange`. **Server-side, sessions do not exist** — API routes never receive the client's JWT, so every "protected" route is unauthenticated in practice (see Security audit). This is the single largest SaaS blocker. |

## Authorization

Only one implicit role exists: **restaurant owner** (`restaurants.owner_id = auth.uid()`). There is no `manager`, `analyst`, or `staff` role anywhere in the schema, API, or UI — no `role` column, no permission checks beyond ownership. A restaurant cannot be shared with a second user at all (schema models one owner per restaurant, not a membership table). For a product sold to real restaurants (where staff, GMs, and owners need different access), this is a **must-build** gap, not a polish item.

## Tenant isolation

- **Schema-level**: strong — every table keys off `restaurant_id`, RLS policies scope by `owner_id = auth.uid()`. Design is correct.
- **Runtime**: currently non-functional, because `auth.uid()` never resolves (server client has no JWT context), so RLS silently returns empty sets rather than actively protecting live traffic. Once the auth-context bug is fixed, tenant isolation via RLS will work as designed.
- **API-level**: most routes additionally filter by `restaurantId` passed from the client, but only trust it because RLS is supposed to back it up — there's no app-level "does this restaurant belong to this user" check on most routes (a few `[id]` routes do check ownership, but those same routes are broken by the query-param-vs-path-param bug noted in [PRODUCTION_AUDIT.md](PRODUCTION_AUDIT.md)). Once auth is fixed this becomes low-risk (RLS is the real backstop), but it should not be the *only* line of defense for a paid product — recommend explicit ownership checks in the API layer as defense-in-depth.

## Billing readiness

- **Subscription support**: none. No Stripe/Paddle/LemonSqueezy integration, no `subscriptions`/`plans` table, no webhook handler.
- **Trial support**: none. No trial-expiry logic, no `trial_ends_at` field.
- **Plan limits**: none. No enforcement of e.g. "1 restaurant on free tier," "X snapshots/month," etc. — nothing in the schema or API caps usage per tenant.
- **Usage metering**: none. No counters for API calls, storage, snapshot volume, or seats.

This is the least-built area of the product. Realistically nothing here can go live-paying-customer without at least: a `plans`/`subscriptions` table, Stripe Checkout + webhook handler updating subscription status, and a single plan-limit check (e.g. max restaurants per account) enforced in the `restaurants` POST route.

## Summary

The **data model** for multi-tenant SaaS is sound (tenant-scoped tables + RLS). Everything layered on top of it — working server auth, password reset, roles, billing — is either broken or entirely unbuilt. Recommend treating "fix server-side auth wiring" as the literal first commit before anything else in this audit, since no other SaaS capability can be verified while every API call 401s.
