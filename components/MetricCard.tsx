import { cn } from '@/lib/utils'

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'primary',
  className,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon?: any
  trend?: { value: number; positive: boolean }
  color?: 'primary' | 'accent' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const colorMap = {
    primary: 'text-primary',
    accent: 'text-accent',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    danger: 'text-red-400',
  }

  return (
    <div className={cn('p-6 rounded-lg border bg-card', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn('text-2xl font-bold mt-1', colorMap[color])}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon className={cn('w-5 h-5 text-muted-foreground', colorMap[color])} />}
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-xs">
          <span className={trend.positive ? 'text-green-400' : 'text-red-400'}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      )}
    </div>
  )
}
