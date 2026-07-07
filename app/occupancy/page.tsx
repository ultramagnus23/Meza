'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { AppShell } from '@/components/AppShell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { OccupancyChart } from '@/components/OccupancyChart'
import { StatLedger } from '@/components/StatLedger'
import { TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (error: any) {
      console.error('Occupancy load error:', error)
      toast.error('Failed to load occupancy data', { description: error.message })
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
    <AppShell
      title="Occupancy"
      description="Real-time and historical occupancy data from your location"
      headerActions={
        <SegmentedControl
          value={selectedDays}
          onChange={setSelectedDays}
          options={[
            { value: 1, label: 'Today' },
            { value: 7, label: '7d' },
            { value: 30, label: '30d' },
          ]}
        />
      }
    >
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
        <StatLedger
          stats={[
            { label: 'Avg occupancy', value: `${avgOccupancy}%`, tone: 'candle' },
            { label: 'Avg people count', value: avgPeople },
            { label: 'Avg queue length', value: avgQueue },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Hourly occupancy pattern
            </CardTitle>
            <CardDescription>
              Average occupancy percentage by hour of day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyChart data={hourlyData} />
          </CardContent>
        </Card>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Recent snapshots · last {Math.min(10, occupancyData.length)} readings
          </h2>
          <div className="border-y border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 px-3 font-medium">Time</th>
                  <th className="py-2 px-3 font-medium">Occupancy</th>
                  <th className="py-2 px-3 font-medium">People</th>
                  <th className="py-2 px-3 font-medium">Queue</th>
                  <th className="py-2 px-3 font-medium">Wait time</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {occupancyData.slice(0, 10).map((snap) => (
                  <tr key={snap.id} className="border-b border-border last:border-b-0">
                    <td className="py-2 px-3">
                      {new Date(snap.timestamp).toLocaleString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-3">{snap.occupancy_percentage}%</td>
                    <td className="py-2 px-3">{snap.people_count}</td>
                    <td className="py-2 px-3">{snap.queue_length}</td>
                    <td className="py-2 px-3">{snap.wait_time} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </AppShell>
  )
}
