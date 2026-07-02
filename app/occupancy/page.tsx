'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OccupancyChart } from '@/components/OccupancyChart'
import { TrendingUp, Users, Clock, ListOrdered } from 'lucide-react'

export default function OccupancyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { selectedRestaurant } = useStore()
  const [loading, setLoading] = useState(true)
  const [occupancyData, setOccupancyData] = useState<any[]>([])
  const [hourlyData, setHourlyData] = useState<any[]>([])
  const [selectedDays, setSelectedDays] = useState(7)

  useEffect(() => {
    if (!user) {
      router.push('/signin')
      return
    }
    if (!selectedRestaurant) {
      router.push('/dashboard')
      return
    }
    loadOccupancy()
  }, [user, selectedRestaurant, selectedDays])

  const loadOccupancy = async () => {
    if (!selectedRestaurant) return
    try {
      setLoading(true)
      const res = await api.getOccupancy({
        restaurantId: selectedRestaurant.id,
        days: selectedDays,
      })

      if (res.success) {
        setOccupancyData(res.data)
        computeHourlyData(res.data)
      }
    } catch (error) {
      console.error('Occupancy load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const computeHourlyData = (data: any[]) => {
    const hourlyData = new Map<number, { occupancy: number; people: number; queue: number; count: number }>()
    for (let h = 0; h < 24; h++) {
      hourlyData.set(h, { occupancy: 0, people: 0, queue: 0, count: 0 })
    }

    for (const snap of data) {
      const hour = new Date(snap.timestamp).getHours()
      const existing = hourlyData.get(hour)!
      existing.occupancy += snap.occupancy_percentage || 0
      existing.people += snap.people_count || 0
      existing.queue += snap.queue_length || 0
      existing.count += 1
    }

    const chartData = Array.from(hourlyData.entries())
      .filter(([, v]) => v.count > 0)
      .sort((a, b) => a[0] - b[0])
      .map(([hour, v]) => ({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        occupancy: Math.round(v.occupancy / v.count),
        people: Math.round(v.people / v.count),
        queue: Math.round(v.queue / v.count),
      }))

    setHourlyData(chartData)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const avgOccupancy = occupancyData.length
    ? Math.round(occupancyData.reduce((s, d) => s + (d.occupancy_percentage || 0), 0) / occupancyData.length)
    : 0
  const avgPeople = occupancyData.length
    ? Math.round(occupancyData.reduce((s, d) => s + (d.people_count || 0), 0) / occupancyData.length)
    : 0
  const avgQueue = occupancyData.length
    ? Math.round(occupancyData.reduce((s, d) => s + (d.queue_length || 0), 0) / occupancyData.length)
    : 0

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Occupancy Analytics</h1>
            <p className="text-muted-foreground">
              Real-time and historical occupancy data from your location
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 7, 30].map((days) => (
              <Button
                key={days}
                variant={selectedDays === days ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDays(days)}
              >
                {days === 1 ? 'Today' : `${days}d`}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Occupancy</p>
                  <p className="text-2xl font-bold">{avgOccupancy}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg People Count</p>
                  <p className="text-2xl font-bold">{avgPeople}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ListOrdered className="w-5 h-5 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Queue Length</p>
                  <p className="text-2xl font-bold">{avgQueue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Hourly Occupancy Pattern
            </CardTitle>
            <CardDescription>
              Average occupancy percentage by hour of day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyChart data={hourlyData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Snapshots</CardTitle>
            <CardDescription>Last {Math.min(10, occupancyData.length)} occupancy readings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground">Time</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Occupancy</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">People</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Queue</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Wait Time</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancyData.slice(0, 10).map((snap) => (
                    <tr key={snap.id} className="border-b border-border/50">
                      <td className="py-2 px-3">
                        {new Date(snap.timestamp).toLocaleString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={
                          (snap.occupancy_percentage || 0) > 80 ? 'danger' :
                          (snap.occupancy_percentage || 0) > 60 ? 'warning' : 'success'
                        }>
                          {snap.occupancy_percentage}%
                        </Badge>
                      </td>
                      <td className="py-2 px-3">{snap.people_count}</td>
                      <td className="py-2 px-3">{snap.queue_length}</td>
                      <td className="py-2 px-3">{snap.wait_time} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
