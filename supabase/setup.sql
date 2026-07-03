-- MEZA: combined schema setup (001 + 002 + 003).
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Generated from supabase/migrations/; keep those as the source of truth.

-- ============================================
-- EXPERIENCE INTELLIGENCE PLATFORM
-- Supabase PostgreSQL Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- TENANTS
-- ============================================

create table restaurants (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    location text not null,
    timezone text not null default 'Asia/Kolkata',
    max_capacity integer,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_restaurants_owner on restaurants(owner_id);

alter table restaurants enable row level security;

create policy "Owners can view their restaurants"
    on restaurants for select
    using (owner_id = auth.uid());

create policy "Owners can create restaurants"
    on restaurants for insert
    with check (owner_id = auth.uid());

create policy "Owners can update their restaurants"
    on restaurants for update
    using (owner_id = auth.uid());

-- ============================================
-- OCCUPANCY (from CV/CCTV)
-- ============================================

create table occupancy_snapshots (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    timestamp timestamptz not null default now(),
    occupancy_percentage numeric(5,2),
    occupied_tables integer,
    available_tables integer,
    people_count integer,
    queue_length integer,
    wait_time integer,
    total_tables integer
);

create index idx_occupancy_restaurant_time on occupancy_snapshots(restaurant_id, timestamp desc);

alter table occupancy_snapshots enable row level security;

create policy "Owners can view their occupancy data"
    on occupancy_snapshots for select
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can insert occupancy data"
    on occupancy_snapshots for insert
    with check (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can update their occupancy data"
    on occupancy_snapshots for update
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

-- ============================================
-- TABLE SESSIONS (from occupancy + POS)
-- ============================================

create table table_sessions (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    table_number integer not null,
    party_size integer,
    start_time timestamptz not null,
    end_time timestamptz,
    dwell_time integer,
    order_value numeric(10,2),
    item_count integer,
    dessert_count integer default 0,
    drink_count integer default 0
);

create index idx_sessions_restaurant_time on table_sessions(restaurant_id, start_time desc);
create index idx_sessions_table on table_sessions(restaurant_id, table_number);

alter table table_sessions enable row level security;

create policy "Owners can view their table sessions"
    on table_sessions for select
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can insert table sessions"
    on table_sessions for insert
    with check (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

-- ============================================
-- ENVIRONMENTAL DATA
-- ============================================

create table environment_snapshots (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    timestamp timestamptz not null default now(),
    temperature numeric(5,2),
    humidity numeric(5,2),
    weather text,
    rainfall boolean default false,
    music_genre text,
    music_volume numeric(5,2),
    lighting_brightness numeric(5,2),
    lighting_temperature numeric(5,2),
    promotion_active boolean default false,
    special_event text,
    staff_count integer
);

create index idx_env_restaurant_time on environment_snapshots(restaurant_id, timestamp desc);

alter table environment_snapshots enable row level security;

create policy "Owners can view their environment data"
    on environment_snapshots for select
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can insert environment data"
    on environment_snapshots for insert
    with check (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

-- ============================================
-- OPERATIONAL DATA
-- ============================================

create table operational_snapshots (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    timestamp timestamptz not null default now(),
    staff_count integer,
    kitchen_load numeric(5,2),
    service_time numeric(8,2),
    order_prep_time numeric(8,2)
);

create index idx_ops_restaurant_time on operational_snapshots(restaurant_id, timestamp desc);

alter table operational_snapshots enable row level security;

create policy "Owners can view their operational data"
    on operational_snapshots for select
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can insert operational data"
    on operational_snapshots for insert
    with check (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

-- ============================================
-- EXPERIMENTS
-- ============================================

create table experiments (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    experiment_name text not null,
    hypothesis text not null,
    variable_changed text not null,
    control_condition text,
    test_condition text,
    start_time timestamptz not null,
    end_time timestamptz,
    status text not null default 'planned'
);

create index idx_experiments_restaurant on experiments(restaurant_id);

alter table experiments enable row level security;

create policy "Owners can view their experiments"
    on experiments for select
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can manage their experiments"
    on experiments for all
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

-- ============================================
-- EXPERIMENT RESULTS
-- ============================================

create table experiment_results (
    id uuid primary key default gen_random_uuid(),
    experiment_id uuid not null references experiments(id) on delete cascade,
    revenue_delta numeric(10,2),
    average_order_value_delta numeric(10,2),
    dwell_time_delta numeric(8,2),
    dessert_delta numeric(8,2),
    drink_delta numeric(8,2),
    confidence_score numeric(5,2),
    measured_at timestamptz not null default now()
);

alter table experiment_results enable row level security;

create policy "Owners can view their experiment results"
    on experiment_results for select
    using (experiment_id in (
        select id from experiments where restaurant_id in (
            select id from restaurants where owner_id = auth.uid()
        )
    ));

create policy "Owners can insert experiment results"
    on experiment_results for insert
    with check (experiment_id in (
        select id from experiments where restaurant_id in (
            select id from restaurants where owner_id = auth.uid()
        )
    ));

-- ============================================
-- RECOMMENDATIONS
-- ============================================

create table recommendations (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    timestamp timestamptz not null default now(),
    recommendation text not null,
    confidence numeric(5,2),
    expected_revenue_impact numeric(10,2),
    implemented boolean default false,
    implemented_at timestamptz
);

create index idx_recs_restaurant_time on recommendations(restaurant_id, timestamp desc);

alter table recommendations enable row level security;

create policy "Owners can view their recommendations"
    on recommendations for select
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can manage their recommendations"
    on recommendations for all
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

-- ============================================
-- POS ORDERS (Phase 1)
-- ============================================

create table pos_orders (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    external_id text,
    timestamp timestamptz not null default now(),
    order_type text default 'DINE_IN',
    channel text default 'DIRECT',
    subtotal numeric(10,2) default 0,
    tax numeric(10,2) default 0,
    discount numeric(10,2) default 0,
    total_amount numeric(10,2) not null,
    payment_method text,
    guest_count integer,
    table_number integer,
    status text default 'COMPLETED',
    created_at timestamptz not null default now()
);

create index idx_pos_orders_restaurant_time on pos_orders(restaurant_id, timestamp desc);
create index idx_pos_orders_external on pos_orders(restaurant_id, external_id);

alter table pos_orders enable row level security;

create policy "Owners can view their orders"
    on pos_orders for select
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can insert orders"
    on pos_orders for insert
    with check (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

-- ============================================
-- POS ORDER ITEMS
-- ============================================

create table pos_order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references pos_orders(id) on delete cascade,
    item_name text not null,
    category text,
    quantity integer not null,
    price numeric(10,2) not null,
    total numeric(10,2) not null,
    is_dessert boolean default false,
    is_drink boolean default false,
    created_at timestamptz not null default now()
);

create index idx_order_items_order on pos_order_items(order_id);

alter table pos_order_items enable row level security;

create policy "Owners can view their order items"
    on pos_order_items for select
    using (order_id in (
        select id from pos_orders where restaurant_id in (
            select id from restaurants where owner_id = auth.uid()
        )
    ));

create policy "Owners can insert order items"
    on pos_order_items for insert
    with check (order_id in (
        select id from pos_orders where restaurant_id in (
            select id from restaurants where owner_id = auth.uid()
        )
    ));

-- ============================================
-- FUNCTIONS
-- ============================================

-- Helper: get restaurant IDs for current user
create or replace function get_restaurant_ids_for_user()
returns setof uuid as $$
    select id from restaurants where owner_id = auth.uid();
$$ language sql stable security definer;

-- ============================================
-- CAMERAS (per-restaurant CV pipeline config)
-- ============================================
-- Each restaurant can register one or more cameras. Each camera carries
-- its own RTSP source, snapshot interval, and the table/queue regions
-- the CV pipeline should watch. This makes cv_pipeline/occupancy_detector.py
-- fully data-driven per install: nothing camera-specific is hardcoded in
-- Python, it is all fetched from this table at process start via
-- CAMERA_ID env var.

create table cameras (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    name text not null,
    rtsp_url text not null,
    status text not null default 'inactive' check (status in ('active', 'inactive', 'error')),
    snapshot_interval_seconds integer not null default 300,
    fps numeric(4,1) not null default 1,
    -- Table ROI regions as percentage-of-frame coordinates:
    -- [{ "table_number": 1, "x1": 0.1, "y1": 0.2, "x2": 0.3, "y2": 0.5 }, ...]
    table_regions jsonb not null default '[]'::jsonb,
    -- Queue ROI as a single percentage-of-frame region, nullable if no queue area is tracked
    queue_region jsonb,
    last_snapshot_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_cameras_restaurant on cameras(restaurant_id);

alter table cameras enable row level security;

create policy "Owners can view their cameras"
    on cameras for select
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

create policy "Owners can manage their cameras"
    on cameras for all
    using (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ))
    with check (restaurant_id in (
        select id from restaurants where owner_id = auth.uid()
    ));

-- Edge devices report status/errors back via a service-role or dedicated
-- "device" credential, not the owner's session — see cv_pipeline README
-- for the recommended service-key setup. This policy only covers the
-- owner-facing dashboard CRUD above; the edge write path uses the
-- Supabase service role key directly (bypasses RLS by design, scoped to
-- one deployment's backend, never shipped to the browser).

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
