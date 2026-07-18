'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { AppShell } from '@/components/AppShell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UploadCloud, FileText, CheckCircle2, XCircle } from 'lucide-react'

export default function UploadPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { selectedRestaurant } = useStore()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) {
      router.push('/signin')
      return
    }
    if (!selectedRestaurant) {
      router.push('/create-restaurant')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedRestaurant])

  const handleUpload = async () => {
    if (!file || !selectedRestaurant) return
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('restaurantId', selectedRestaurant.id)
      const res = await api.uploadOrders(formData)
      if (res.success) {
        setResult({ success: true, message: res.message || `Imported ${res.count} orders` })
        setFile(null)
        if (inputRef.current) inputRef.current.value = ''
      } else {
        setResult({ success: false, message: res.error || 'Upload failed' })
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppShell
      title="Import POS Data"
      description={`Upload a CSV export from your POS for ${selectedRestaurant?.name ?? 'this restaurant'}. Revenue, order and item-level analytics update as soon as import finishes.`}
    >
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>One row per order line item</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              htmlFor="csv-file"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-md p-10 cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <UploadCloud className="w-8 h-8 text-muted-foreground" />
              {file ? (
                <span className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4" /> {file.name}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Click to choose a .csv file, or drag it here
                </span>
              )}
              <input
                id="csv-file"
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Uploading...' : 'Import Orders'}
            </Button>

            {result && (
              <div
                className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                  result.success
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {result.message}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expected columns</CardTitle>
            <CardDescription>Header names are flexible — the importer accepts common aliases</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4">Field</th>
                  <th className="text-left py-2">Accepted column names</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Order ID</td>
                  <td className="py-2"><code>posOrderId</code>, <code>order_id</code>, <code>id</code></td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Order timestamp</td>
                  <td className="py-2"><code>order_time</code>, <code>order_date</code>, <code>timestamp</code></td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Menu item</td>
                  <td className="py-2"><code>menu_item</code>, <code>item</code>, <code>product</code></td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Quantity / price</td>
                  <td className="py-2"><code>quantity</code>, <code>price</code></td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Category</td>
                  <td className="py-2"><code>category</code> (e.g. containing &quot;dessert&quot;/&quot;drink&quot;/&quot;beverage&quot;)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Optional</td>
                  <td className="py-2">
                    <code>order_type</code>, <code>channel</code>, <code>payment_method</code>,{' '}
                    <code>guest_count</code>, <code>table_number</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
    </AppShell>
  )
}
