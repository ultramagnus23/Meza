'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { AppShell } from '@/components/AppShell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatLedger } from '@/components/StatLedger'
import { Music, Lightbulb, CloudRain } from 'lucide-react'
import { toast } from 'sonner'

export default function EnvironmentPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { selectedRestaurant } = useStore()
  const [loading, setLoading] = useState(true)
  const [environmentData, setEnvironmentData] = useState<any[]>([])
  const [form, setForm] = useState({
    temperature: '',
    humidity: '',
    weather: 'clear',
    rainfall: false,
    music_genre: '',
    music_volume: '',
    lighting_brightness: '',
    lighting_temperature: '',
    promotion_active: false,
    special_event: '',
    staff_count: '',
  })

  useEffect(() => {
    if (!user) {
      router.push('/signin')
      return
    }
    if (!selectedRestaurant) {
      router.push('/dashboard')
      return
    }
    loadEnvironment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedRestaurant])

  const loadEnvironment = async () => {
    if (!selectedRestaurant) return
    try {
      setLoading(true)
      const res = await api.getEnvironment({
        restaurantId: selectedRestaurant.id,
        days: 7,
      })
      if (res.success) {
        setEnvironmentData(res.data)
      }
    } catch (error: any) {
      console.error('Environment load error:', error)
      toast.error('Failed to load environment data', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleManualEntry = async () => {
    if (!selectedRestaurant) return
    try {
      await api.insertEnvironment({
        restaurant_id: selectedRestaurant.id,
        temperature: form.temperature ? parseFloat(form.temperature) : null,
        humidity: form.humidity ? parseFloat(form.humidity) : null,
        weather: form.weather || null,
        rainfall: form.rainfall,
        music_genre: form.music_genre || null,
        music_volume: form.music_volume ? parseFloat(form.music_volume) : null,
        lighting_brightness: form.lighting_brightness ? parseFloat(form.lighting_brightness) : null,
        lighting_temperature: form.lighting_temperature ? parseFloat(form.lighting_temperature) : null,
        promotion_active: form.promotion_active,
        special_event: form.special_event || null,
        staff_count: form.staff_count ? parseInt(form.staff_count) : null,
      })
      toast.success('Environment data logged successfully')
      loadEnvironment()
      setForm({
        temperature: '',
        humidity: '',
        weather: 'clear',
        rainfall: false,
        music_genre: '',
        music_volume: '',
        lighting_brightness: '',
        lighting_temperature: '',
        promotion_active: false,
        special_event: '',
        staff_count: '',
      })
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const latest = environmentData[0]
  const avgTemp = environmentData.length
    ? (environmentData.reduce((s, d) => s + (d.temperature || 0), 0) / environmentData.filter(d => d.temperature).length).toFixed(1)
    : '--'
  const avgHumidity = environmentData.length
    ? (environmentData.reduce((s, d) => s + (d.humidity || 0), 0) / environmentData.filter(d => d.humidity).length).toFixed(1)
    : '--'

  return (
    <AppShell
      title="Environment"
      description="Track and correlate environmental factors with business outcomes"
    >
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
        <StatLedger
          stats={[
            { label: 'Avg temperature', value: `${avgTemp}°C` },
            { label: 'Avg humidity', value: `${avgHumidity}%` },
            { label: 'Latest staff count', value: latest?.staff_count || '--' },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle>Log Environment Data</CardTitle>
            <CardDescription>
              Enter current environmental conditions (manual entry)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="22.5"
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Humidity (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="65"
                  value={form.humidity}
                  onChange={(e) => setForm({ ...form, humidity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Weather</Label>
                <select
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                  value={form.weather}
                  onChange={(e) => setForm({ ...form, weather: e.target.value })}
                >
                  <option value="clear">Clear</option>
                  <option value="cloudy">Cloudy</option>
                  <option value="rainy">Rainy</option>
                  <option value="stormy">Stormy</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Music Genre</Label>
                <Input
                  placeholder="jazz / classical / pop / none"
                  value={form.music_genre}
                  onChange={(e) => setForm({ ...form, music_genre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Music Volume (0-10)</Label>
                <Input
                  type="number"
                  step="0.1"
                  max="10"
                  placeholder="5"
                  value={form.music_volume}
                  onChange={(e) => setForm({ ...form, music_volume: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Lighting Brightness (0-100)</Label>
                <Input
                  type="number"
                  placeholder="70"
                  value={form.lighting_brightness}
                  onChange={(e) => setForm({ ...form, lighting_brightness: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Lighting Temp (K)</Label>
                <Input
                  type="number"
                  placeholder="2700"
                  value={form.lighting_temperature}
                  onChange={(e) => setForm({ ...form, lighting_temperature: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Staff Count</Label>
                <Input
                  type="number"
                  placeholder="8"
                  value={form.staff_count}
                  onChange={(e) => setForm({ ...form, staff_count: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Special Event</Label>
                <Input
                  placeholder="live music, festival, etc."
                  value={form.special_event}
                  onChange={(e) => setForm({ ...form, special_event: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="promotion"
                  checked={form.promotion_active}
                  onChange={(e) => setForm({ ...form, promotion_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="promotion" className="cursor-pointer">
                  Promotion Active
                </Label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleManualEntry}>Log Entry</Button>
              <Button variant="outline" onClick={loadEnvironment}>Refresh</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Readings</CardTitle>
            <CardDescription>Last {Math.min(10, environmentData.length)} environmental snapshots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground">Time</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Temp</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Humidity</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Weather</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Music</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Staff</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Promo</th>
                  </tr>
                </thead>
                <tbody>
                  {environmentData.slice(0, 10).map((snap) => (
                    <tr key={snap.id} className="border-b border-border/50">
                      <td className="py-2 px-3">
                        {new Date(snap.timestamp).toLocaleString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-3">{snap.temperature}°C</td>
                      <td className="py-2 px-3">{snap.humidity}%</td>
                      <td className="py-2 px-3 capitalize">{snap.weather}</td>
                      <td className="py-2 px-3">{snap.music_genre || '--'}</td>
                      <td className="py-2 px-3">{snap.staff_count || '--'}</td>
                      <td className="py-2 px-3">
                        {snap.promotion_active ? (
                          <Badge variant="warning">Active</Badge>
                        ) : (
                          <Badge variant="outline">None</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </>
      )}
    </AppShell>
  )
}
