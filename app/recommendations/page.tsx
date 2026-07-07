'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatLedger } from '@/components/StatLedger'
import { Lightbulb, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function RecommendationsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { selectedRestaurant } = useStore()
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<any[]>([])

  useEffect(() => {
    if (!user) {
      router.push('/signin')
      return
    }
    if (!selectedRestaurant) {
      router.push('/dashboard')
      return
    }
    loadRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedRestaurant])

  const loadRecommendations = async () => {
    if (!selectedRestaurant) return
    try {
      setLoading(true)
      const res = await api.getRecommendations({
        restaurantId: selectedRestaurant.id,
        limit: 50,
      })
      if (res.success) {
        setRecommendations(res.data)
      }
    } catch (error: any) {
      console.error('Recommendations load error:', error)
      toast.error('Failed to load recommendations', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleImplement = async (id: string) => {
    try {
      await api.updateRecommendation(id, { implemented: true, implemented_at: new Date().toISOString() })
      loadRecommendations()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await api.dismissRecommendation(id)
      loadRecommendations()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const pending = recommendations.filter((r) => !r.implemented)
  const implemented = recommendations.filter((r) => r.implemented)

  return (
    <AppShell
      title="Recommendations"
      description="Data-driven suggestions to optimize your environment and revenue"
    >
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
        <StatLedger
          stats={[
            { label: 'Total', value: recommendations.length },
            { label: 'Pending', value: pending.length, tone: 'candle' },
            { label: 'Implemented', value: implemented.length, tone: 'success' },
          ]}
        />

        {pending.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Pending</h2>
            <div className="border-y border-border divide-y divide-border">
              {pending.map((rec) => (
                <div key={rec.id} className="flex items-start justify-between gap-4 px-1 py-4">
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-sm">{rec.recommendation}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground">
                      {rec.confidence && <span>confidence {rec.confidence}%</span>}
                      {rec.expected_revenue_impact && (
                        <span className="text-success">
                          impact ₹{rec.expected_revenue_impact.toLocaleString()}
                        </span>
                      )}
                      <span>{new Date(rec.timestamp).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleDismiss(rec.id)}>
                      Dismiss
                    </Button>
                    <Button size="sm" onClick={() => handleImplement(rec.id)}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Implement
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {implemented.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Implemented</h2>
            <div className="border-y border-border divide-y divide-border">
              {implemented.slice(0, 10).map((rec) => (
                <div key={rec.id} className="flex items-start justify-between gap-4 px-1 py-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
                      {rec.recommendation}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground pl-5">
                      done {new Date(rec.implemented_at!).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendations.length === 0 && (
          <div className="border-y border-border py-12 text-center">
            <Lightbulb className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No recommendations yet. They will appear once we have enough data to analyze.
            </p>
          </div>
        )}
        </>
      )}
    </AppShell>
  )
}
