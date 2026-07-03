-- ============================================
-- DEMO MODE
-- ============================================
-- Adds a `is_demo` flag to restaurants and rewrites every write-side RLS
-- policy (insert/update/delete) so a demo restaurant's data can be viewed
-- by anyone signed into the demo account but never mutated - the demo
-- account is genuinely read-only, enforced at the database layer rather
-- than in application code (which could be bypassed by calling the API
-- directly). SELECT policies are untouched, so reads keep working exactly
-- as before for both demo and real restaurants.

alter table restaurants add column is_demo boolean not null default false;

-- Restaurant-level write check: true only if the caller owns the
-- restaurant AND it is not flagged as a demo restaurant.
create or replace function is_writable_restaurant(rid uuid, uid uuid)
returns boolean as $$
    select exists (
        select 1 from restaurants where id = rid and owner_id = uid and is_demo = false
    );
$$ language sql stable security definer;

-- Same check, one level down (experiment_results / pos_order_items are
-- scoped by experiment_id / order_id rather than restaurant_id directly).
create or replace function is_writable_experiment(eid uuid, uid uuid)
returns boolean as $$
    select exists (
        select 1 from experiments e
        join restaurants r on r.id = e.restaurant_id
        where e.id = eid and r.owner_id = uid and r.is_demo = false
    );
$$ language sql stable security definer;

create or replace function is_writable_order(oid uuid, uid uuid)
returns boolean as $$
    select exists (
        select 1 from pos_orders o
        join restaurants r on r.id = o.restaurant_id
        where o.id = oid and r.owner_id = uid and r.is_demo = false
    );
$$ language sql stable security definer;

-- ============================================
-- RESTAURANTS
-- ============================================

drop policy "Owners can update their restaurants" on restaurants;
create policy "Owners can update their restaurants"
    on restaurants for update
    using (owner_id = auth.uid() and is_demo = false);

-- Prevent the demo account from using its real session to spin up
-- additional (non-demo) restaurants under its own id.
drop policy "Owners can create restaurants" on restaurants;
create policy "Owners can create restaurants"
    on restaurants for insert
    with check (
        owner_id = auth.uid()
        and not exists (
            select 1 from restaurants r2 where r2.owner_id = auth.uid() and r2.is_demo
        )
    );

-- ============================================
-- OCCUPANCY
-- ============================================

drop policy "Owners can insert occupancy data" on occupancy_snapshots;
create policy "Owners can insert occupancy data"
    on occupancy_snapshots for insert
    with check (is_writable_restaurant(restaurant_id, auth.uid()));

drop policy "Owners can update their occupancy data" on occupancy_snapshots;
create policy "Owners can update their occupancy data"
    on occupancy_snapshots for update
    using (is_writable_restaurant(restaurant_id, auth.uid()));

-- ============================================
-- TABLE SESSIONS
-- ============================================

drop policy "Owners can insert table sessions" on table_sessions;
create policy "Owners can insert table sessions"
    on table_sessions for insert
    with check (is_writable_restaurant(restaurant_id, auth.uid()));

-- ============================================
-- ENVIRONMENT
-- ============================================

drop policy "Owners can insert environment data" on environment_snapshots;
create policy "Owners can insert environment data"
    on environment_snapshots for insert
    with check (is_writable_restaurant(restaurant_id, auth.uid()));

-- ============================================
-- OPERATIONAL
-- ============================================

drop policy "Owners can insert operational data" on operational_snapshots;
create policy "Owners can insert operational data"
    on operational_snapshots for insert
    with check (is_writable_restaurant(restaurant_id, auth.uid()));

-- ============================================
-- EXPERIMENTS (separate SELECT policy is untouched - reads still work)
-- ============================================

drop policy "Owners can manage their experiments" on experiments;
create policy "Owners can manage their experiments"
    on experiments for all
    using (is_writable_restaurant(restaurant_id, auth.uid()));

-- ============================================
-- EXPERIMENT RESULTS
-- ============================================

drop policy "Owners can insert experiment results" on experiment_results;
create policy "Owners can insert experiment results"
    on experiment_results for insert
    with check (is_writable_experiment(experiment_id, auth.uid()));

-- ============================================
-- RECOMMENDATIONS (separate SELECT policy is untouched)
-- ============================================

drop policy "Owners can manage their recommendations" on recommendations;
create policy "Owners can manage their recommendations"
    on recommendations for all
    using (is_writable_restaurant(restaurant_id, auth.uid()));

-- ============================================
-- POS ORDERS
-- ============================================

drop policy "Owners can insert orders" on pos_orders;
create policy "Owners can insert orders"
    on pos_orders for insert
    with check (is_writable_restaurant(restaurant_id, auth.uid()));

-- ============================================
-- POS ORDER ITEMS
-- ============================================

drop policy "Owners can insert order items" on pos_order_items;
create policy "Owners can insert order items"
    on pos_order_items for insert
    with check (is_writable_order(order_id, auth.uid()));

-- ============================================
-- CAMERAS (separate SELECT policy is untouched)
-- ============================================

drop policy "Owners can manage their cameras" on cameras;
create policy "Owners can manage their cameras"
    on cameras for all
    using (is_writable_restaurant(restaurant_id, auth.uid()))
    with check (is_writable_restaurant(restaurant_id, auth.uid()));
