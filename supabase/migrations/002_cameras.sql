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
