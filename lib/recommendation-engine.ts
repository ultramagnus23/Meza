// V1 rules-based recommendation engine (see docs/ML_AUDIT.md - this is the
// deterministic version that audit recommends building before any learned
// model). Pulls recent occupancy/environment/table-session/POS data for a
// restaurant, computes Pearson correlations matching what
// components/CorrelationScatter.tsx visualizes, and applies a small set of
// auditable threshold rules to turn a strong correlation into a plain
// recommendation row.
//
// Every number written to `recommendations` is derived from real historical
// data pulled in this file - no fabricated confidence or revenue-impact
// figures. `confidence` comes from correlationConfidence() (Fisher
// z-transformation over the actual sample). `expected_revenue_impact` is
// only set when it can be computed from real average order/item prices for
// that restaurant; otherwise it is left null.

import { SupabaseClient } from '@supabase/supabase-js'
import { pearson, correlationConfidence, pairByNearestTimestamp, TimestampedValue } from './correlation'

const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000 // pair env <-> outcome readings within 2h
const MIN_SAMPLE_SIZE = 12
const MIN_CONFIDENCE = 0.8
const MIN_ABS_CORRELATION = 0.3

export type RestaurantData = {
  restaurantId: string
  environment: Array<{
    timestamp: string
    temperature: number | null
    sound_level_db: number | null
    music_volume: number | null
    lux: number | null
    co2_ppm: number | null
  }>
  occupancy: Array<{ timestamp: string; occupancy_percentage: number | null; queue_length: number | null }>
  tableSessions: Array<{
    start_time: string
    dwell_time: number | null
    order_value: number | null
    dessert_count: number
    drink_count: number
  }>
  avgDessertPrice: number | null
  avgDrinkPrice: number | null
}

export type Recommendation = {
  rule_key: string
  recommendation: string
  confidence: number
  expected_revenue_impact: number | null
}

function toSeries(rows: { timestamp: string; v: number | null }[]): TimestampedValue[] {
  return rows.filter((r) => r.v !== null).map((r) => ({ timestamp: r.timestamp, value: r.v as number }))
}

function correlate(envValues: TimestampedValue[], outcomeValues: TimestampedValue[]) {
  const pairs = pairByNearestTimestamp(envValues, outcomeValues, MATCH_WINDOW_MS)
  if (pairs.length < MIN_SAMPLE_SIZE) return null
  const { r, n } = pearson(
    pairs.map((p) => p.x),
    pairs.map((p) => p.y)
  )
  const confidence = correlationConfidence(r, n)
  return { r, n, confidence, pairs }
}

// Splits paired (env, outcome) points into "high env value" vs "low env
// value" halves (median split) and returns the mean outcome in each half -
// used to state a concrete, data-backed before/after in the recommendation
// text instead of just reporting a bare correlation coefficient.
function splitByMedian(pairs: { x: number; y: number }[]) {
  const sorted = [...pairs].sort((a, b) => a.x - b.x)
  const mid = Math.floor(sorted.length / 2)
  const low = sorted.slice(0, mid)
  const high = sorted.slice(mid)
  const meanOf = (arr: { x: number; y: number }[], key: 'x' | 'y') =>
    arr.reduce((s, p) => s + p[key], 0) / arr.length
  return {
    lowMeanX: meanOf(low, 'x'),
    highMeanX: meanOf(high, 'x'),
    lowMeanY: meanOf(low, 'y'),
    highMeanY: meanOf(high, 'y'),
    lowCount: low.length,
    highCount: high.length,
  }
}

/**
 * Hypothesis: hot indoor temperature suppresses dessert attach rate (guests
 * want to leave rather than linger over dessert).
 * Evidence threshold: |r| >= 0.3 between temperature and dessert_count,
 * n >= 12 matched sessions, Fisher-z confidence >= 0.8.
 */
function ruleTemperatureVsDessert(data: RestaurantData): Recommendation | null {
  const env = toSeries(data.environment.map((e) => ({ timestamp: e.timestamp, v: e.temperature })))
  const outcome = data.tableSessions.map((s) => ({ timestamp: s.start_time, value: s.dessert_count }))
  const result = correlate(env, outcome)
  if (!result || result.r > -MIN_ABS_CORRELATION || result.confidence < MIN_CONFIDENCE) return null

  const split = splitByMedian(result.pairs)
  const dessertDrop = split.lowMeanY - split.highMeanY
  if (dessertDrop <= 0) return null

  let expectedImpact: number | null = null
  if (data.avgDessertPrice !== null && split.highCount > 0) {
    expectedImpact = Math.round(dessertDrop * split.highCount * data.avgDessertPrice * 100) / 100
  }

  return {
    rule_key: 'temperature_vs_dessert',
    recommendation:
      `Dessert attach rate drops from ${split.lowMeanY.toFixed(2)} to ${split.highMeanY.toFixed(2)} ` +
      `per table above ~${split.highMeanX.toFixed(1)}°C indoor temperature (r=${result.r.toFixed(2)}, ` +
      `n=${result.n}). Consider lowering the AC setpoint during hours that run this warm.`,
    confidence: result.confidence,
    expected_revenue_impact: expectedImpact,
  }
}

/**
 * Hypothesis: loud music shortens dwell time (guests linger less in a
 * noisier room).
 * Evidence threshold: |r| >= 0.3 between sound_level_db and dwell_time,
 * n >= 12, confidence >= 0.8.
 */
function ruleSoundVsDwell(data: RestaurantData): Recommendation | null {
  const env = toSeries(data.environment.map((e) => ({ timestamp: e.timestamp, v: e.sound_level_db })))
  const outcome = data.tableSessions.map((s) => ({ timestamp: s.start_time, value: s.dwell_time }))
    .filter((o): o is { timestamp: string; value: number } => o.value !== null)
  const result = correlate(env, outcome)
  if (!result || result.r > -MIN_ABS_CORRELATION || result.confidence < MIN_CONFIDENCE) return null

  const split = splitByMedian(result.pairs)
  const dwellDropMinutes = split.lowMeanY - split.highMeanY
  if (dwellDropMinutes <= 0) return null

  return {
    rule_key: 'sound_vs_dwell',
    recommendation:
      `Average dwell time falls from ${split.lowMeanY.toFixed(0)} to ${split.highMeanY.toFixed(0)} minutes ` +
      `above ~${split.highMeanX.toFixed(0)}dB sound level (r=${result.r.toFixed(2)}, n=${result.n}). ` +
      `Consider lowering music volume during the loudest hours.`,
    confidence: result.confidence,
    expected_revenue_impact: null, // dwell-time delta doesn't translate to revenue without an assumption we're not willing to fabricate
  }
}

/**
 * Hypothesis: occupancy running high alongside a persistent queue implies
 * walk-ins are being turned away rather than seated.
 * Evidence threshold: correlation between occupancy_percentage and
 * queue_length >= 0.3 (both rise together, as expected), AND mean queue
 * length during the high-occupancy half is >= 3 people, n >= 12.
 */
function ruleOccupancyQueueLostWalkins(data: RestaurantData): Recommendation | null {
  const occSeries = data.occupancy
    .filter((o) => o.occupancy_percentage !== null)
    .map((o) => ({ timestamp: o.timestamp, value: o.occupancy_percentage as number }))
  const queueSeries = data.occupancy
    .filter((o) => o.queue_length !== null)
    .map((o) => ({ timestamp: o.timestamp, value: o.queue_length as number }))

  const result = correlate(occSeries, queueSeries)
  if (!result || result.r < MIN_ABS_CORRELATION || result.confidence < MIN_CONFIDENCE) return null

  const split = splitByMedian(result.pairs)
  if (split.highMeanY < 3) return null

  return {
    rule_key: 'occupancy_vs_queue',
    recommendation:
      `Queue length averages ${split.highMeanY.toFixed(1)} people when occupancy is above ` +
      `~${split.highMeanX.toFixed(0)}% (r=${result.r.toFixed(2)}, n=${result.n}), versus ` +
      `${split.lowMeanY.toFixed(1)} at lower occupancy. This pattern is consistent with walk-ins being ` +
      `turned away during peak hours - consider a reservation system or queue-management nudge for those windows.`,
    confidence: result.confidence,
    expected_revenue_impact: null, // would require an assumed walk-in-to-order conversion rate we don't have real data for
  }
}

/**
 * Hypothesis: a louder/more energetic room (higher music volume) is
 * associated with more drink orders per table.
 * Evidence threshold: |r| >= 0.3 between music_volume and drink_count,
 * n >= 12, confidence >= 0.8.
 */
function ruleMusicVolumeVsDrinks(data: RestaurantData): Recommendation | null {
  const env = toSeries(data.environment.map((e) => ({ timestamp: e.timestamp, v: e.music_volume })))
  const outcome = data.tableSessions.map((s) => ({ timestamp: s.start_time, value: s.drink_count }))
  const result = correlate(env, outcome)
  if (!result || Math.abs(result.r) < MIN_ABS_CORRELATION || result.confidence < MIN_CONFIDENCE) return null

  const split = splitByMedian(result.pairs)
  const drinkDelta = split.highMeanY - split.lowMeanY
  const direction = drinkDelta > 0 ? 'higher' : 'lower'
  if (drinkDelta === 0) return null

  let expectedImpact: number | null = null
  if (data.avgDrinkPrice !== null && drinkDelta > 0 && split.highCount > 0) {
    expectedImpact = Math.round(drinkDelta * split.highCount * data.avgDrinkPrice * 100) / 100
  }

  return {
    rule_key: 'music_volume_vs_drinks',
    recommendation:
      `Drink orders per table run ${direction} (${split.lowMeanY.toFixed(2)} -> ${split.highMeanY.toFixed(2)}) ` +
      `at music volume above ~${split.highMeanX.toFixed(1)}/10 (r=${result.r.toFixed(2)}, n=${result.n}). ` +
      (drinkDelta > 0
        ? `Consider keeping volume in that higher range during service hours.`
        : `Consider keeping volume in the lower range during service hours.`),
    confidence: result.confidence,
    expected_revenue_impact: expectedImpact,
  }
}

/**
 * Hypothesis: bright/harsh lighting reduces how long guests linger,
 * compared to dimmer, warmer lighting.
 * Evidence threshold: |r| >= 0.3 between lux and dwell_time, n >= 12,
 * confidence >= 0.8.
 */
function ruleLuxVsDwell(data: RestaurantData): Recommendation | null {
  const env = toSeries(data.environment.map((e) => ({ timestamp: e.timestamp, v: e.lux })))
  const outcome = data.tableSessions.map((s) => ({ timestamp: s.start_time, value: s.dwell_time }))
    .filter((o): o is { timestamp: string; value: number } => o.value !== null)
  const result = correlate(env, outcome)
  if (!result || result.r > -MIN_ABS_CORRELATION || result.confidence < MIN_CONFIDENCE) return null

  const split = splitByMedian(result.pairs)
  if (split.lowMeanY - split.highMeanY <= 0) return null

  return {
    rule_key: 'lux_vs_dwell',
    recommendation:
      `Average dwell time is ${split.highMeanY.toFixed(0)} minutes above ~${split.highMeanX.toFixed(0)} lux, ` +
      `versus ${split.lowMeanY.toFixed(0)} minutes at lower brightness (r=${result.r.toFixed(2)}, n=${result.n}). ` +
      `Consider dimming lighting during hours you want guests to linger longer.`,
    confidence: result.confidence,
    expected_revenue_impact: null,
  }
}

/**
 * Hypothesis: high indoor CO2 (a proxy for poor ventilation / overcrowding)
 * shortens dwell time.
 * Evidence threshold: |r| >= 0.3 between co2_ppm and dwell_time, n >= 12,
 * confidence >= 0.8.
 */
function ruleCo2VsDwell(data: RestaurantData): Recommendation | null {
  const env = toSeries(data.environment.map((e) => ({ timestamp: e.timestamp, v: e.co2_ppm })))
  const outcome = data.tableSessions.map((s) => ({ timestamp: s.start_time, value: s.dwell_time }))
    .filter((o): o is { timestamp: string; value: number } => o.value !== null)
  const result = correlate(env, outcome)
  if (!result || result.r > -MIN_ABS_CORRELATION || result.confidence < MIN_CONFIDENCE) return null

  const split = splitByMedian(result.pairs)
  if (split.lowMeanY - split.highMeanY <= 0) return null

  return {
    rule_key: 'co2_vs_dwell',
    recommendation:
      `Average dwell time drops to ${split.highMeanY.toFixed(0)} minutes above ~${split.highMeanX.toFixed(0)}ppm CO2 ` +
      `(from ${split.lowMeanY.toFixed(0)} minutes, r=${result.r.toFixed(2)}, n=${result.n}). ` +
      `Consider improving ventilation or reducing seating density during hours that run this high.`,
    confidence: result.confidence,
    expected_revenue_impact: null,
  }
}

// Each rule carries a stable rule_key (see supabase/migrations/005) so the
// cron route can dedupe against its own recent output without re-parsing
// generated text (whose embedded numbers shift slightly between runs).
export const RULES: Array<(data: RestaurantData) => Recommendation | null> = [
  ruleTemperatureVsDessert,
  ruleSoundVsDwell,
  ruleOccupancyQueueLostWalkins,
  ruleMusicVolumeVsDrinks,
  ruleLuxVsDwell,
  ruleCo2VsDwell,
]

export async function fetchRestaurantData(
  supabase: SupabaseClient,
  restaurantId: string,
  days: number
): Promise<RestaurantData> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: environment }, { data: occupancy }, { data: tableSessions }, { data: orders }] =
    await Promise.all([
      supabase
        .from('environment_snapshots')
        .select('timestamp, temperature, sound_level_db, music_volume, lux, co2_ppm')
        .eq('restaurant_id', restaurantId)
        .gte('timestamp', since),
      supabase
        .from('occupancy_snapshots')
        .select('timestamp, occupancy_percentage, queue_length')
        .eq('restaurant_id', restaurantId)
        .gte('timestamp', since),
      supabase
        .from('table_sessions')
        .select('start_time, dwell_time, order_value, dessert_count, drink_count')
        .eq('restaurant_id', restaurantId)
        .gte('start_time', since),
      supabase.from('pos_orders').select('id').eq('restaurant_id', restaurantId).gte('timestamp', since),
    ])

  let avgDessertPrice: number | null = null
  let avgDrinkPrice: number | null = null
  const orderIds = (orders ?? []).map((o) => o.id)
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from('pos_order_items')
      .select('price, is_dessert, is_drink')
      .in('order_id', orderIds)

    const dessertPrices = (items ?? []).filter((i) => i.is_dessert).map((i) => i.price)
    const drinkPrices = (items ?? []).filter((i) => i.is_drink).map((i) => i.price)
    avgDessertPrice = dessertPrices.length ? dessertPrices.reduce((a, b) => a + b, 0) / dessertPrices.length : null
    avgDrinkPrice = drinkPrices.length ? drinkPrices.reduce((a, b) => a + b, 0) / drinkPrices.length : null
  }

  return {
    restaurantId,
    environment: environment ?? [],
    occupancy: occupancy ?? [],
    tableSessions: tableSessions ?? [],
    avgDessertPrice,
    avgDrinkPrice,
  }
}

export function generateRecommendations(data: RestaurantData): Recommendation[] {
  return RULES.map((rule) => rule(data)).filter((r): r is Recommendation => r !== null)
}
