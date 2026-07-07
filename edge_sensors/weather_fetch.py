"""
Weather/AQI fetcher (OPTIONAL, cron-style script)
Meant to run on a schedule (e.g. every 30-60 min via cron or a systemd
timer) from anywhere with outbound internet access - the edge device, a
small VM, or a laptop. Unlike collector.py, this needs no restaurant-site
hardware at all.

Fetches outdoor weather + air quality for a restaurant's `location` field
(free-text, e.g. "Bengaluru, India" - see restaurants.location) from
OpenWeatherMap, and posts ONLY the outdoor-facing fields to
environment_snapshots with source='weather_api':
  - weather      (text description, e.g. "Clouds", "Rain")
  - rainfall     (bool, true if current conditions include rain)
  - outdoor_aqi  (OpenWeatherMap's own 1-5 Air Quality Index: 1=Good,
                  2=Fair, 3=Moderate, 4=Poor, 5=Very Poor - NOT the US EPA
                  0-500 AQI scale. Converting to the EPA scale requires the
                  full per-pollutant breakpoint table, which is out of
                  scope here; storing OWM's own index as-is rather than
                  fabricating a false EPA-equivalent number.)

Deliberately does NOT touch `temperature`/`humidity` - those columns
represent the restaurant's own indoor+ambient readings (manual entry or
collector.py's sensors), and this script only ever knows outdoor
conditions at the location's lat/lon, not what's actually happening
inside the restaurant.

Required environment variables:
  RESTAURANT_ID           - id of the row in the `restaurants` table
  SUPABASE_URL            - e.g. https://your-project.supabase.co
  SUPABASE_SERVICE_KEY    - service role key (same as collector.py - keep
                             off any device other than a trusted backend/edge
                             box, never in a browser bundle)
  OPENWEATHERMAP_API_KEY  - https://openweathermap.org/api (free tier is enough)

Run once (intended usage - schedule this via cron):
  RESTAURANT_ID=<uuid> SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
  OPENWEATHERMAP_API_KEY=... python weather_fetch.py

Example crontab entry (every 30 minutes):
  */30 * * * * cd /opt/meza/edge_sensors && \
    RESTAURANT_ID=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
    OPENWEATHERMAP_API_KEY=... python3 weather_fetch.py >> weather_fetch.log 2>&1
"""

import json
import os
import sys

import requests

GEOCODE_URL = "https://api.openweathermap.org/geo/1.0/direct"
WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
AIR_POLLUTION_URL = "https://api.openweathermap.org/data/2.5/air_pollution"

RAIN_WEATHER_MAIN = {"Rain", "Drizzle", "Thunderstorm"}


class FetchError(RuntimeError):
    pass


def get_restaurant_location(supabase_url, service_key, restaurant_id):
    resp = requests.get(
        f"{supabase_url}/rest/v1/restaurants",
        params={"id": f"eq.{restaurant_id}", "select": "location"},
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        timeout=10,
    )
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        raise FetchError(f"No restaurant found with id={restaurant_id}")
    return rows[0]["location"]


def geocode(location, api_key):
    resp = requests.get(
        GEOCODE_URL,
        params={"q": location, "limit": 1, "appid": api_key},
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json()
    if not results:
        raise FetchError(f"OpenWeatherMap could not geocode location: {location!r}")
    return results[0]["lat"], results[0]["lon"]


def fetch_weather(lat, lon, api_key):
    resp = requests.get(
        WEATHER_URL,
        params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    weather_main = data["weather"][0]["main"] if data.get("weather") else None
    rainfall = weather_main in RAIN_WEATHER_MAIN
    return weather_main, rainfall


def fetch_aqi(lat, lon, api_key):
    resp = requests.get(
        AIR_POLLUTION_URL,
        params={"lat": lat, "lon": lon, "appid": api_key},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    entries = data.get("list") or []
    if not entries:
        return None
    return entries[0]["main"]["aqi"]  # OWM's 1-5 index, see module docstring


def post_snapshot(supabase_url, service_key, restaurant_id, weather, rainfall, outdoor_aqi):
    payload = {
        "restaurant_id": restaurant_id,
        "weather": weather,
        "rainfall": rainfall,
        "outdoor_aqi": outdoor_aqi,
        "source": "weather_api",
    }
    resp = requests.post(
        f"{supabase_url}/rest/v1/environment_snapshots",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        data=json.dumps(payload),
        timeout=10,
    )
    if resp.status_code not in (200, 201):
        raise FetchError(f"Failed to post weather snapshot: {resp.status_code} - {resp.text}")
    return resp.json()


def main():
    restaurant_id = os.environ.get("RESTAURANT_ID")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    owm_key = os.environ.get("OPENWEATHERMAP_API_KEY")

    if not all([restaurant_id, supabase_url, supabase_key, owm_key]):
        print(
            "Missing required environment variables. Set RESTAURANT_ID, "
            "SUPABASE_URL, SUPABASE_SERVICE_KEY and OPENWEATHERMAP_API_KEY "
            "(see this file's module docstring for details).",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        location = get_restaurant_location(supabase_url, supabase_key, restaurant_id)
        lat, lon = geocode(location, owm_key)
        weather, rainfall = fetch_weather(lat, lon, owm_key)
        outdoor_aqi = fetch_aqi(lat, lon, owm_key)
        post_snapshot(supabase_url, supabase_key, restaurant_id, weather, rainfall, outdoor_aqi)
        print(f"Posted weather_api snapshot for {location}: "
              f"weather={weather} rainfall={rainfall} outdoor_aqi={outdoor_aqi}")
    except (FetchError, requests.RequestException) as e:
        print(f"weather_fetch failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
