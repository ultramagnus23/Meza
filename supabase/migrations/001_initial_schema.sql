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
