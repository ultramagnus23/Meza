"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import { useCurrency } from "@/lib/hooks/use-currency"
import type { Decision } from "@/lib/types"

interface DecisionAnalysis {
  decision: Decision
  explanation: string
  context: any
  historicalData: any[]
  dataQuality: string
  confidence: number
  nextSteps: string[]
}

interface DecisionAnalysisDialogProps {
  decision: Decision | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DecisionAnalysisDialog({ decision, open, onOpenChange }: DecisionAnalysisDialogProps) {
  const [analysis, setAnalysis] = useState<DecisionAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const { format } = useCurrency()

  useEffect(() => {
    if (open && decision) {
      loadAnalysis()
    }
  }, [open, decision])

  async function loadAnalysis() {
    if (!decision) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/analytics/decisions/${decision.id}/analysis`)
      const data = await response.json()
      
      if (data.success) {
        setAnalysis(data.data)
      }
    } catch (error) {
      console.error("Error loading analysis:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!decision) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {decision.action}: {decision.item}
          </DialogTitle>
          <DialogDescription>
            Detailed analysis and reasoning for this decision
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Owner-Friendly Explanation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  What This Means For You
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {analysis.explanation.split("\n\n").map((paragraph, idx) => (
                    <p key={idx} className="text-sm leading-relaxed mb-3">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Impact Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Expected Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Impact Range</p>
                    <p className="text-2xl font-bold text-primary">
                      {format(analysis.decision.impact.min)} - {format(analysis.decision.impact.max)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Confidence Level</p>
                    <p className="text-2xl font-bold">{analysis.confidence}%</p>
                    <Badge variant={analysis.dataQuality === "high" ? "default" : "secondary"} className="mt-1">
                      {analysis.dataQuality} data quality
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <Badge variant={analysis.decision.priority === "high" ? "default" : "secondary"} className="text-lg px-3 py-1">
                      {analysis.decision.priority}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Context Data */}
            {analysis.context && Object.keys(analysis.context).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Current Situation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    {Object.entries(analysis.context).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-sm text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}:
                        </span>
                        <span className="text-sm font-medium">
                          {typeof value === "number" ? (key.includes("Price") || key.includes("Margin") ? format(value) : value) : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Historical Data */}
            {analysis.historicalData && analysis.historicalData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Past Similar Changes
                  </CardTitle>
                  <CardDescription>
                    How similar changes performed in the past
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.historicalData.map((historical, idx) => (
                      <div key={idx} className="rounded-lg bg-muted p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{historical.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(historical.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {historical.revenueDelta > 0 ? "+" : ""}{format(historical.revenueDelta)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Projected: {format(historical.projectedRevenue)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Risks */}
            {analysis.decision.risks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-accent" />
                    Things to Watch Out For
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.decision.risks.map((risk, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-accent mt-1">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 list-decimal list-inside">
                  {analysis.nextSteps.map((step, idx) => (
                    <li key={idx} className="text-sm">{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Unable to load analysis
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

