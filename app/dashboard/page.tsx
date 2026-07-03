'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { MetricCard } from '@/components/MetricCard'
import { RevenueChart } from '@/components/RevenueChart'
import { OccupancyChart } from '@/components/OccupancyChart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Activity,
  ListOrdered,
  FlaskConical,
  Lightbulb,
  LogOut,
  Building2,
  Plus,
  UploadCloud,
  Video,
} from 'lucide-react'
import { toast } from 'sonner'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { selectedRestaurant, setSelectedRestaurant, setMetrics, metrics } = useStore()
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showRestaurantPicker, setShowRestaurantPicker] = useState(false)
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
          setRestaurants(res.data)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Experience Intelligence</h1>
            {selectedRestaurant && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Building2 className="w-3 h-3 mr-1" />
                  {selectedRestaurant.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRestaurantPicker(!showRestaurantPicker)}
                  className="h-6 px-2 text-xs"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Restaurant picker dropdown */}
        {showRestaurantPicker && restaurants.length > 0 && (
          <div className="px-6 pb-4">
            <div className="flex gap-2 flex-wrap">
              {restaurants.map((r) => (
                <Button
                  key={r.id}
                  variant={selectedRestaurant?.id === r.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedRestaurant(r)
                    setShowRestaurantPicker(false)
                  }}
                  className="text-xs"
                >
                  {r.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics ? (
            <>
              <MetricCard
                title="Current Occupancy"
                value={`${metrics.current_occupancy}%`}
                subtitle={`${metrics.today_orders} orders today`}
                icon={Users}
                color="primary"
              />
              <MetricCard
                title="Today's Revenue"
                value={`₹${metrics.today_revenue.toLocaleString()}`}
                subtitle={`${metrics.avg_order_value} avg order`}
                icon={DollarSign}
                color="success"
              />
              <MetricCard
                title="Avg Dwell Time"
                value={`${metrics.avg_dwell_time} min`}
                subtitle="Per table session"
                icon={Clock}
                color="accent"
              />
              <MetricCard
                title="Avg Queue Length"
                value={metrics.avg_queue_length.toString()}
                subtitle="Current wait"
                icon={ListOrdered}
                color={metrics.avg_queue_length > 5 ? 'danger' : 'warning'}
              />
            </>
          ) : (
            <>
              <MetricCard title="Current Occupancy" value="--" icon={Users} />
              <MetricCard title="Today's Revenue" value="₹0" icon={DollarSign} />
              <MetricCard title="Avg Dwell Time" value="--" icon={Clock} />
              <MetricCard title="Avg Queue Length" value="0" icon={ListOrdered} />
            </>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Hourly Occupancy
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
                <TrendingUp className="w-5 h-5 text-success" />
                Revenue Trend
              </CardTitle>
              <CardDescription>Daily revenue over last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart data={revenueData} />
            </CardContent>
          </Card>
        </div>

        {/* Activity Summary */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-accent" />
                Active Experiments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics?.active_experiments || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Running experiments to optimize experience
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-warning" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{metrics?.pending_recommendations || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Actionable insights waiting for your response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success" />
                Revenue Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                ₹{metrics?.today_revenue.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Today&apos;s total revenue
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Button variant="outline" className="justify-start" onClick={() => router.push('/upload')}>
                <UploadCloud className="w-4 h-4 mr-2" />
                Import POS Data (CSV)
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => router.push('/cameras')}>
                <Video className="w-4 h-4 mr-2" />
                Configure Cameras &amp; Tables
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => router.push('/occupancy')}>
                <Activity className="w-4 h-4 mr-2" />
                View Occupancy Analytics
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => router.push('/environment')}>
                <FlaskConical className="w-4 h-4 mr-2" />
                Log Environment Data
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => router.push('/experiments')}>
                <Lightbulb className="w-4 h-4 mr-2" />
                Create Experiment
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
