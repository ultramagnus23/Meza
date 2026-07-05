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
import { Skeleton } from '@/components/ui/skeleton'
import { Lightbulb, CheckCircle, TrendingUp } from 'lucide-react'
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
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Recommendations</p>
                  <p className="text-2xl font-bold">{recommendations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pending.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Implemented</p>
                  <p className="text-2xl font-bold">{implemented.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {pending.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Pending</h2>
            {pending.map((rec) => (
              <Card key={rec.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="font-medium">{rec.recommendation}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {rec.confidence && (
                          <span>Confidence: {rec.confidence}%</span>
                        )}
                        {rec.expected_revenue_impact && (
                          <span className="text-success">
                            Expected impact: ₹{rec.expected_revenue_impact.toLocaleString()}
                          </span>
                        )}
                        <span>
                          {new Date(rec.timestamp).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDismiss(rec.id)}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleImplement(rec.id)}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Implement
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {implemented.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Implemented</h2>
            {implemented.slice(0, 10).map((rec) => (
              <Card key={rec.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <p className="font-medium">{rec.recommendation}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Implemented on {new Date(rec.implemented_at!).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <Badge variant="success">Done</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {recommendations.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No recommendations yet. Recommendations will appear once we have enough data to analyze.
              </p>
            </CardContent>
          </Card>
        )}
        </>
      )}
    </AppShell>
  )
}
