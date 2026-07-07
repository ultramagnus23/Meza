'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { AppShell } from '@/components/AppShell'
import { StatLedger } from '@/components/StatLedger'
import { RevenueChart } from '@/components/RevenueChart'
import { OccupancyChart } from '@/components/OccupancyChart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Activity,
  TrendingUp,
  UploadCloud,
  Video,
  FlaskConical,
  CloudSun,
  Lightbulb,
} from 'lucide-react'
import { toast } from 'sonner'

const QUICK_ACTIONS = [
  { href: '/upload', label: 'Import POS data', icon: UploadCloud },
  { href: '/cameras', label: 'Set up cameras and tables', icon: Video },
  { href: '/occupancy', label: 'View occupancy analytics', icon: Activity },
  { href: '/environment', label: 'Log environment data', icon: CloudSun },
  { href: '/experiments', label: 'Start an experiment', icon: FlaskConical },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { selectedRestaurant, setSelectedRestaurant, setMetrics, metrics } = useStore()
  const [loading, setLoading] = useState(true)
  const [occupancyData, setOccupancyData] = useState<any[]>([])
  const [revenueData, setRevenueData] = useState<any[]>([])

  useEffect(() => {
    if (!user) {
      router.push('/signin')
      return
    }
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedRestaurant])

  const loadDashboard = async () => {
    try {
      setLoading(true)

      if (!selectedRestaurant) {
        const res = await api.getRestaurants()
        if (res.success && res.data.length > 0) {
          setSelectedRestaurant(res.data[0])
        } else {
          router.push('/create-restaurant')
          return
        }
      }

      if (selectedRestaurant) {
        const [dashboardRes, revenueRes, occupancyRes] = await Promise.all([
          api.getDashboard({ restaurantId: selectedRestaurant.id }),
          api.getRevenueByDay({ restaurantId: selectedRestaurant.id, days: 30 }),
          api.getOccupancy({ restaurantId: selectedRestaurant.id, days: 7 }),
        ])

        if (dashboardRes.success) {
          setMetrics(dashboardRes.data)
        }

        if (revenueRes.success) {
          setRevenueData(revenueRes.data)
        }

        if (occupancyRes.success) {
          loadOccupancyChart(occupancyRes.data)
        }
      }
    } catch (error: any) {
      console.error('Dashboard load error:', error)
      toast.error('Failed to load dashboard data', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const loadOccupancyChart = (data: any[]) => {
    const hourlyData = new Map<number, { occupancy: number; people: number; count: number }>()
    for (let h = 0; h < 24; h++) {
      hourlyData.set(h, { occupancy: 0, people: 0, count: 0 })
    }

    for (const snap of data) {
      const hour = new Date(snap.timestamp).getHours()
      const existing = hourlyData.get(hour)!
      existing.occupancy += snap.occupancy_percentage || 0
      existing.people += snap.people_count || 0
      existing.count += 1
    }

    const chartData = Array.from(hourlyData.entries())
      .filter(([, v]) => v.count > 0)
      .map(([hour, v]) => ({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        occupancy: Math.round(v.occupancy / v.count),
        people: Math.round(v.people / v.count),
      }))

    setOccupancyData(chartData)
  }

  return (
    <AppShell title="Dashboard" description={selectedRestaurant ? undefined : 'Loading your restaurant...'}>
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <StatLedger
          stats={[
            {
              label: 'Current occupancy',
              value: metrics ? `${metrics.current_occupancy}%` : '--',
              meta: metrics ? `${metrics.today_orders} orders today` : undefined,
              tone: 'candle',
            },
            {
              label: "Today's revenue",
              value: metrics ? `₹${metrics.today_revenue.toLocaleString()}` : '₹0',
              meta: metrics ? `${metrics.avg_order_value} avg order` : undefined,
              tone: 'success',
            },
            {
              label: 'Avg dwell time',
              value: metrics ? `${metrics.avg_dwell_time} min` : '--',
              meta: 'Per table session',
            },
            {
              label: 'Avg queue length',
              value: metrics ? metrics.avg_queue_length.toString() : '0',
              meta: 'Current wait',
              tone: metrics && metrics.avg_queue_length > 5 ? 'danger' : 'default',
            },
          ]}
        />
      )}

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Hourly occupancy
            </CardTitle>
            <CardDescription>Average occupancy by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyChart data={occupancyData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Revenue trend
            </CardTitle>
            <CardDescription>Daily revenue over last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>
      </div>

      {/* Tonight's summary */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Tonight</h2>
        <div className="border-y border-border divide-y divide-border">
          <div className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
            <span className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-muted-foreground" /> Active experiments
            </span>
            <span className="font-mono tabular-nums">{metrics?.active_experiments ?? 0}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
            <span className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-muted-foreground" /> Recommendations waiting
            </span>
            <span className="font-mono tabular-nums">{metrics?.pending_recommendations ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Get started</h2>
        <div className="border-y border-border divide-y divide-border">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-accent transition-colors"
            >
              <action.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
