# MEZA Edge Sensor Collector (optional hardware add-on)

**This is optional.** MEZA's dashboard, revenue analytics, experiments, and
recommendations all work without any sensors — environmental data can also
be logged manually from the `/environment` dashboard page. This directory
is the automated way to fill `environment_snapshots` from real hardware
and a public weather API instead of by hand.

Two independent scripts, meant to run on (or near) the same Raspberry Pi
as `cv_pipeline/occupancy_detector.py` if that's also deployed at the
site, but neither depends on the other:

- **`collector.py`** — a long-running process reading indoor atmospherics
  (temp/humidity, CO2, PM2.5, lux, sound level) off wired sensors every
  `SNAPSHOT_INTERVAL_SECONDS` (default 300s) and posting one
  `environment_snapshots` row per cycle with `source: 'sensor'`.
- **`weather_fetch.py`** — a short-lived, cron-style script that looks up
  outdoor weather/AQI for the restaurant's `location` via OpenWeatherMap
  and posts `weather`/`rainfall`/`outdoor_aqi` only, with
  `source: 'weather_api'`. Run it from cron, not as a service.

## Try it without hardware: `--mock`

```bash
RESTAURANT_ID=<restaurant id from your MEZA account> \
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_KEY=<service role key> \
python collector.py --mock
```

`--mock` skips every real sensor read entirely (no smbus2/pyserial needed
— only `requests`) and posts a plausible synthetic reading each cycle
through the exact same code path a real sensor reading would use. Every
mock log line is prefixed `[MOCK]` so it can never be mistaken for a real
sensor value downstream — this is a genuine test of the ingestion path,
not a mock of it. Add `--once` to post a single cycle and exit instead of
looping, useful for a quick smoke test.

## Hardware list

| Sensor | Interface | Reads |
|---|---|---|
| SHT31 (or DHT22) | I2C (or GPIO) | temperature, humidity |
| SCD30 (or SCD41) | I2C | CO2 (ppm) |
| Plantower PMS5003 | UART | PM2.5 (µg/m³) |
| BH1750 | I2C | lux |
| I2S MEMS mic (e.g. INMP441) | I2S | sound level (dB(A)) |

Budget similar to `cv_pipeline`'s hardware target: all five sensors plus a
Pi 4 fit comfortably under typical maker-hardware budgets, and every
sensor here shares the Pi's I2C bus except the UART-based PM2.5 sensor and
the I2S mic.

## Wiring notes

- I2C sensors (SHT31, SCD30/SCD41, BH1750) share the Pi's SDA/SCL pins —
  each has its own I2C address, so no bus conflicts, but confirm no two
  boards default to the same address before wiring (SCD30/SCD41 and BH1750
  ship with different default addresses; double-check if using
  clone/breakout boards).
- PMS5003 needs a 5V supply and UART RX/TX (3.3V logic — most breakout
  boards handle level shifting; verify yours does before connecting
  directly to Pi GPIO).
- I2S mic needs the Pi's I2S pins (BCLK/LRCLK/DOUT), not a USB mic — USB
  mics work too but need a different capture library than
  `sounddevice`'s I2S path assumes.

## One-time setup

1. Note your restaurant's id from the MEZA dashboard (same id used
   elsewhere, e.g. in `cv_pipeline`'s `CAMERA_ID` lookups reference the
   same `restaurant_id`).
2. Wire up whichever sensors you have — each is independent; a partial
   sensor set is fine, `collector.py` posts `null` for any sensor that
   isn't read (see `_read()` in `collector.py`), it never fabricates a
   number for a missing sensor.
3. Implement the real read logic in the relevant adapter class(es) in
   `collector.py` (`TempHumiditySensor`, `CO2Sensor`, `PM25Sensor`,
   `LuxSensor`, `SoundLevelSensor`) — each currently raises
   `NotImplementedError` with a pointer to the recommended library, since
   exact I2C bus numbers/addresses and UART device paths vary by board and
   OS image.
4. Install dependencies: `pip install -r requirements.txt` (uncomment the
   hardware libraries you need for the sensors you wired up).
5. For `weather_fetch.py`, sign up for a free OpenWeatherMap API key at
   https://openweathermap.org/api.

## Running

```bash
# Long-running collector (indoor sensors)
RESTAURANT_ID=<uuid> SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
  python collector.py

# One-shot weather/AQI fetch (schedule via cron, not a long-running service)
RESTAURANT_ID=<uuid> SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
  OPENWEATHERMAP_API_KEY=... python weather_fetch.py
```

`SUPABASE_SERVICE_KEY` is a privileged credential — keep it on the edge
device only, never in a browser bundle or committed to source control
(same rule as `cv_pipeline`; it bypasses Row Level Security by design so
these scripts can write on behalf of the restaurant they're configured
for, since there's no restaurant-owner browser session for an unattended
device to use).

### systemd unit example (collector.py)

```ini
[Unit]
Description=MEZA edge sensor collector
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/meza/edge_sensors
Environment=RESTAURANT_ID=<uuid>
Environment=SUPABASE_URL=https://your-project.supabase.co
Environment=SUPABASE_SERVICE_KEY=<service role key>
Environment=SNAPSHOT_INTERVAL_SECONDS=300
ExecStart=/usr/bin/python3 /opt/meza/edge_sensors/collector.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### crontab example (weather_fetch.py)

```
*/30 * * * * cd /opt/meza/edge_sensors && \
  RESTAURANT_ID=<uuid> SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
  OPENWEATHERMAP_API_KEY=... python3 weather_fetch.py >> weather_fetch.log 2>&1
```

## Why `source` matters

Every row `collector.py` or `weather_fetch.py` writes sets
`environment_snapshots.source` (`'sensor'` or `'weather_api'`) so manual,
sensor, and weather-API data are always distinguishable later — see
`supabase/migrations/004_sensor_fields.sql`. Don't post without setting
`source` explicitly if you extend these scripts.

## AQI scale note

`outdoor_aqi` as populated by `weather_fetch.py` is OpenWeatherMap's own
1-5 Air Quality Index (1=Good … 5=Very Poor), **not** the US EPA 0-500
AQI scale that's more commonly displayed to consumers. Converting to the
EPA scale requires the full per-pollutant breakpoint table, which isn't
implemented here — see `fetch_aqi()` in `weather_fetch.py`. Don't display
this number to a restaurant owner as an EPA AQI without either doing that
conversion or clearly labeling it as OpenWeatherMap's index.
