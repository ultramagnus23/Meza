-- ============================================
-- SENSOR FIELDS (automated capture support)
-- ============================================
-- Extends environment_snapshots so rows can come from an edge sensor
-- collector (edge_sensors/collector.py) or a weather/AQI API poll
-- (edge_sensors/weather_fetch.py), not just the manual-entry form.
-- `lighting_brightness` (0-100 manual scale) is kept as-is for existing
-- rows/UI; `lux` is the new real sensor unit (BH1750) and is populated
-- alongside it going forward, not a replacement.

alter table environment_snapshots
    add column co2_ppm numeric(6,1),
    add column pm25_ugm3 numeric(6,1),
    add column outdoor_aqi integer,
    add column lux numeric(7,1),
    add column sound_level_db numeric(5,1),
    add column source text not null default 'manual'
        check (source in ('manual', 'sensor', 'weather_api'));

comment on column environment_snapshots.source is
    'How this row was populated: manual (owner-entered form), sensor (edge_sensors/collector.py), or weather_api (edge_sensors/weather_fetch.py).';
