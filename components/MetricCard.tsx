'use client'

import { cn } from '@/lib/utils'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

const colorMap = {
  primary: { text: 'text-primary', bg: 'bg-primary/10', stroke: 'var(--primary)' },
  accent: { text: 'text-accent', bg: 'bg-accent/10', stroke: 'var(--accent)' },
  success: { text: 'text-success', bg: 'bg-success/10', stroke: 'var(--success)' },
  warning: { text: 'text-warning', bg: 'bg-warning/10', stroke: 'var(--warning)' },
  danger: { text: 'text-danger', bg: 'bg-danger/10', stroke: 'var(--danger)' },
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  sparkline,
  color = 'primary',
  className,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon?: any
  trend?: { value: number; positive: boolean }
  sparkline?: number[]
  color?: 'primary' | 'accent' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const c = colorMap[color]
  const sparkData = sparkline?.map((v, i) => ({ i, v }))

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-surface-1 p-5 shadow-sm transition-colors hover:border-border/80',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{title}</p>
          <p className="text-2xl font-bold mt-1.5 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn('shrink-0 rounded-lg p-2', c.bg)}>
            <Icon className={cn('w-4 h-4', c.text)} />
          </div>
        )}
      </div>

      {(trend || sparkData) && (
        <div className="flex items-end justify-between gap-3 mt-3">
          {trend ? (
            <div className="flex items-center gap-1 text-xs">
              <span className={trend.positive ? 'text-success' : 'text-danger'}>
                {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-muted-foreground">vs last period</span>
            </div>
          ) : (
            <span />
          )}
          {sparkData && sparkData.length > 1 && (
            <div className="h-8 w-20 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id={`spark-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.stroke} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={c.stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={c.stroke}
                    strokeWidth={1.5}
                    fill={`url(#spark-${title.replace(/\s+/g, '-')})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
