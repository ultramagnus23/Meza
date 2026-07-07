// Vercel Cron entry point for the V1 rules-based recommendation engine
// (lib/recommendation-engine.ts). Scheduled in vercel.json. Vercel signs
// cron requests with `Authorization: Bearer ${CRON_SECRET}` when
// CRON_SECRET is set in the project's env vars - see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
//
// Runs with the service-role client (no restaurant-owner session exists
// for a scheduled job), so this route must never accept a caller-supplied
// restaurant_id - it always iterates every restaurant itself.

import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { fetchRestaurantData, generateRecommendations } from '@/lib/recommendation-engine'

const LOOKBACK_DAYS = 30
const DEDUPE_LOOKBACK_DAYS = 7

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // no secret configured (e.g. local dev) - allow, matches Vercel's own behavior
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  const results: Record<string, { generated: number; skipped: number; error?: string }> = {}

  const { data: restaurants, error: restaurantsError } = await supabase.from('restaurants').select('id')
  if (restaurantsError) {
    return NextResponse.json({ success: false, error: restaurantsError.message }, { status: 500 })
  }

  for (const restaurant of restaurants ?? []) {
    try {
      const data = await fetchRestaurantData(supabase, restaurant.id, LOOKBACK_DAYS)
      const recommendations = generateRecommendations(data)

      const dedupeSince = new Date(Date.now() - DEDUPE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data: recent } = await supabase
        .from('recommendations')
        .select('rule_key')
        .eq('restaurant_id', restaurant.id)
        .gte('timestamp', dedupeSince)

      const recentRuleKeys = new Set((recent ?? []).map((r) => r.rule_key))
      let generated = 0
      let skipped = 0

      for (const rec of recommendations) {
        if (recentRuleKeys.has(rec.rule_key)) {
          skipped++
          continue
        }
        const { error: insertError } = await supabase.from('recommendations').insert({
          restaurant_id: restaurant.id,
          rule_key: rec.rule_key,
          recommendation: rec.recommendation,
          confidence: rec.confidence,
          expected_revenue_impact: rec.expected_revenue_impact,
        })
        if (insertError) throw insertError
        generated++
      }

      results[restaurant.id] = { generated, skipped }
    } catch (error: any) {
      results[restaurant.id] = { generated: 0, skipped: 0, error: error.message }
    }
  }

  return NextResponse.json({ success: true, results })
}
