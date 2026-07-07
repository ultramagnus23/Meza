'use client'

import { cn } from '@/lib/utils'
import { Line, LineChart, ResponsiveContainer } from 'recharts'

type Tone = 'default' | 'candle' | 'success' | 'warning' | 'danger'

const toneText: Record<Tone, string> = {
  default: 'text-foreground',
  candle: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
}

export type Stat = {
  label: string
  value: string | number
  meta?: string
  sparkline?: number[]
  tone?: Tone
}

// A row of the night's numbers, set like a ledger: mono digits, hairline
// dividers between entries, no card chrome, no icon chips, no gradient
// fill under any sparkline. Replaces the hero-metric-card grid pattern.
export function StatLedger({ stats, loading }: { stats: Stat[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-1 border border-border divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1.5 px-4 py-4">
          <span className="text-xs text-muted-foreground">{s.label}</span>
          <span
            className={cn(
              'font-mono text-3xl font-semibold tabular-nums leading-none',
              toneText[s.tone ?? 'default'],
            )}
          >
            {loading ? '--' : s.value}
          </span>
          {s.meta && <span className="text-xs text-muted-foreground">{s.meta}</span>}
          {s.sparkline && s.sparkline.length > 1 && (
            <div className="h-6 w-full mt-0.5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.sparkline.map((v, idx) => ({ idx, v }))}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="var(--candle)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// A dense, well-set table of rows (services, experiments, recommendations)
// - the "night ledger" that replaces identical icon-card grids on analytics
// screens.
export function Ledger({
  columns,
  rows,
  emptyLabel,
}: {
  columns: string[]
  rows: React.ReactNode[][]
  emptyLabel?: string
}) {
  if (rows.length === 0) {
    return (
      <div className="border-y border-border py-8 text-center text-sm text-muted-foreground">
        {emptyLabel ?? 'Nothing to show yet.'}
      </div>
    )
  }

  return (
    <div className="border-y border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
