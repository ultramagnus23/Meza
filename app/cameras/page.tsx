'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { CameraTableRegion, CameraRegion } from '@/lib/supabase'
import { AppShell } from '@/components/AppShell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Camera as CameraIcon, Plus, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'

type Camera = {
  id: string
  restaurant_id: string
  name: string
  rtsp_url: string
  status: 'active' | 'inactive' | 'error'
  snapshot_interval_seconds: number
  fps: number
  table_regions: CameraTableRegion[]
  queue_region: CameraRegion | null
  last_snapshot_at: string | null
  last_error: string | null
}

const emptyTableRegion: CameraTableRegion = { table_number: 1, x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.5 }

export default function CamerasPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { selectedRestaurant } = useStore()
  const [loading, setLoading] = useState(true)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    rtsp_url: '',
    snapshot_interval_seconds: '300',
    fps: '1',
  })
  const [tableRegions, setTableRegions] = useState<CameraTableRegion[]>([{ ...emptyTableRegion }])
  const [queueRegion, setQueueRegion] = useState<CameraRegion>({ x1: 0.5, y1: 0.9, x2: 0.9, y2: 1.0 })
  const [trackQueue, setTrackQueue] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/signin')
      return
    }
    if (!selectedRestaurant) {
      router.push('/dashboard')
      return
    }
    loadCameras()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedRestaurant])

  const loadCameras = async () => {
    if (!selectedRestaurant) return
    try {
      setLoading(true)
      const res = await api.getCameras({ restaurantId: selectedRestaurant.id })
      if (res.success) {
        setCameras(res.data)
      }
    } catch (error: any) {
      console.error('Cameras load error:', error)
      toast.error('Failed to load cameras', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const addTableRegionRow = () => {
    setTableRegions([
      ...tableRegions,
      { ...emptyTableRegion, table_number: tableRegions.length + 1 },
    ])
  }

  const removeTableRegionRow = (index: number) => {
    setTableRegions(tableRegions.filter((_, i) => i !== index))
  }

  const updateTableRegion = (index: number, field: keyof CameraTableRegion, value: number) => {
    const next = [...tableRegions]
    next[index] = { ...next[index], [field]: value }
    setTableRegions(next)
  }

  const handleCreateCamera = async () => {
    if (!selectedRestaurant) return
    if (!form.name || !form.rtsp_url) {
      toast.error('Camera name and RTSP URL are required')
      return
    }
    try {
      setSaving(true)
      await api.createCamera({
        restaurant_id: selectedRestaurant.id,
        name: form.name,
        rtsp_url: form.rtsp_url,
        snapshot_interval_seconds: parseInt(form.snapshot_interval_seconds) || 300,
        fps: parseFloat(form.fps) || 1,
        table_regions: tableRegions,
        queue_region: trackQueue ? queueRegion : null,
      })
      setForm({ name: '', rtsp_url: '', snapshot_interval_seconds: '300', fps: '1' })
      setTableRegions([{ ...emptyTableRegion }])
      setTrackQueue(false)
      await loadCameras()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (camera: Camera) => {
    const next = camera.status === 'active' ? 'inactive' : 'active'
    try {
      await api.updateCamera(camera.id, { status: next })
      loadCameras()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this camera? Historical occupancy data it produced is kept.')) return
    try {
      await api.deleteCamera(id)
      loadCameras()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  return (
    <AppShell
      title="Cameras & Table Regions"
      description={`Register the CCTV cameras for ${selectedRestaurant?.name ?? 'this restaurant'}, and define which part of each camera's frame corresponds to each table.`}
    >
      {loading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <>
        <Card>
          <CardHeader>
            <CardTitle>Add Camera</CardTitle>
            <CardDescription>
              One row per CCTV feed. RTSP credentials stay in your network — MEZA only stores the
              connection URL and the ROI coordinates, never the video itself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Camera Name</Label>
                <Input
                  placeholder="Main Dining Room"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>RTSP URL</Label>
                <Input
                  placeholder="rtsp://192.168.1.50:554/stream1"
                  value={form.rtsp_url}
                  onChange={(e) => setForm({ ...form, rtsp_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Snapshot Interval (sec)</Label>
                <Input
                  type="number"
                  value={form.snapshot_interval_seconds}
                  onChange={(e) => setForm({ ...form, snapshot_interval_seconds: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Table Regions (fraction of frame, 0.0–1.0)</Label>
                <Button size="sm" variant="outline" onClick={addTableRegionRow}>
                  <Plus className="w-3 h-3 mr-1" /> Add Table
                </Button>
              </div>
              <div className="space-y-2">
                {tableRegions.map((region, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 items-center">
                    <Input
                      type="number"
                      placeholder="Table #"
                      value={region.table_number}
                      onChange={(e) => updateTableRegion(i, 'table_number', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="x1"
                      value={region.x1}
                      onChange={(e) => updateTableRegion(i, 'x1', parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="y1"
                      value={region.y1}
                      onChange={(e) => updateTableRegion(i, 'y1', parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="x2"
                      value={region.x2}
                      onChange={(e) => updateTableRegion(i, 'x2', parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="y2"
                      value={region.y2}
                      onChange={(e) => updateTableRegion(i, 'y2', parseFloat(e.target.value) || 0)}
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeTableRegionRow(i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                (x1,y1) is the top-left corner and (x2,y2) the bottom-right corner of the table&apos;s
                bounding box, as a fraction of the camera frame — e.g. x1=0.1 means 10% in from the
                left edge. Point the camera preview up on the edge device to read these off; no
                image is ever uploaded to MEZA.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="trackQueue"
                  checked={trackQueue}
                  onChange={(e) => setTrackQueue(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="trackQueue" className="cursor-pointer">
                  Track a queue/entrance region on this camera
                </Label>
              </div>
              {trackQueue && (
                <div className="grid grid-cols-4 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="x1"
                    value={queueRegion.x1}
                    onChange={(e) => setQueueRegion({ ...queueRegion, x1: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="y1"
                    value={queueRegion.y1}
                    onChange={(e) => setQueueRegion({ ...queueRegion, y1: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="x2"
                    value={queueRegion.x2}
                    onChange={(e) => setQueueRegion({ ...queueRegion, x2: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="y2"
                    value={queueRegion.y2}
                    onChange={(e) => setQueueRegion({ ...queueRegion, y2: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
            </div>

            <Button onClick={handleCreateCamera} disabled={saving}>
              {saving ? 'Saving...' : 'Add Camera'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registered Cameras</CardTitle>
            <CardDescription>{cameras.length} camera(s) for this restaurant</CardDescription>
          </CardHeader>
          <CardContent>
            {cameras.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cameras registered yet.</p>
            ) : (
              <div className="space-y-3">
                {cameras.map((camera) => (
                  <div
                    key={camera.id}
                    className="flex items-center justify-between border border-border rounded-md p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Video className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">{camera.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {camera.table_regions.length} table(s) tracked · camera id:{' '}
                          <code>{camera.id}</code>
                        </p>
                        {camera.last_error && (
                          <p className="text-xs text-destructive mt-1">{camera.last_error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          camera.status === 'error'
                            ? 'danger'
                            : camera.status === 'active'
                              ? 'default'
                              : 'outline'
                        }
                      >
                        {camera.status}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(camera)}>
                        {camera.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(camera.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CameraIcon className="w-4 h-4" />
              Running the edge pipeline
            </CardTitle>
            <CardDescription>How to point the CV pipeline at a camera above</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>On the edge device (Raspberry Pi/Jetson near this restaurant), run one pipeline process per camera:</p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`CAMERA_ID=<camera id from above> \\
SUPABASE_URL=https://your-project.supabase.co \\
SUPABASE_SERVICE_KEY=<service role key, edge device only, never in the browser> \\
python cv_pipeline/occupancy_detector.py`}
            </pre>
            <p>
              The script fetches this camera&apos;s RTSP URL, table regions, and queue region from
              Supabase at startup — nothing camera-specific is hardcoded in Python. Changing a
              region above takes effect on the pipeline&apos;s next restart.
            </p>
          </CardContent>
        </Card>
        </>
      )}
    </AppShell>
  )
}
