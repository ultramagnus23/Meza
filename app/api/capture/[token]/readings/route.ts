import { NextResponse } from 'next/server'
import { getServiceSupabase, resolveDevice, touchDevice } from '@/lib/device-auth'

const SIGNAL_TYPES = new Set([
  'sound_level_dba',
  'sound_spectrum',
  'light_level',
  'light_color_temp',
  'vibration',
  'occupancy_count',
  'zone_occupancy',
])

type IncomingReading = { signal_type: string; timestamp: string; value: unknown }

// Batched ingestion from the phone capture page's IndexedDB queue flush
// (every 15-30s) - not from a live per-sample connection, so a Wi-Fi drop
// just delays a batch rather than losing samples, as long as the page's
// own retry/backoff eventually succeeds.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const supabase = getServiceSupabase()
    const device = await resolveDevice(supabase, params.token)
    if (!device) {
      return NextResponse.json({ success: false, error: 'Invalid or revoked link' }, { status: 404 })
    }

    const body = await req.json()
    const readings: IncomingReading[] = Array.isArray(body.readings) ? body.readings : []
    if (readings.length === 0) {
      return NextResponse.json({ success: true, data: { accepted: 0 } })
    }

    const signalTypes = Array.from(new Set(readings.map((r) => r.signal_type)))
    const invalid = signalTypes.filter((t) => !SIGNAL_TYPES.has(t))
    if (invalid.length > 0) {
      return NextResponse.json(
        { success: false, error: `Unknown signal_type(s): ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    // Ensure a streams row exists for every (device, signal_type) pair in
    // this batch - no generic upsert helper exists elsewhere in the
    // codebase, so this stays a small local routine rather than a new
    // abstraction (see PIVOT_AUDIT.md: no ingestion layer predates this one).
    const { data: streamRows, error: streamError } = await supabase
      .from('streams')
      .upsert(
        signalTypes.map((signal_type) => ({ device_id: device.id, signal_type })),
        { onConflict: 'device_id,signal_type', ignoreDuplicates: false }
      )
      .select('id, signal_type')

    if (streamError) throw streamError

    const streamIdByType = new Map(streamRows.map((s) => [s.signal_type, s.id]))

    const rows = readings.map((r) => ({
      stream_id: streamIdByType.get(r.signal_type)!,
      timestamp: r.timestamp,
      value_json: typeof r.value === 'object' && r.value !== null ? r.value : { value: r.value },
    }))

    const { error: insertError } = await supabase.from('readings').insert(rows)
    if (insertError) throw insertError

    await touchDevice(supabase, device)

    return NextResponse.json({ success: true, data: { accepted: rows.length } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
