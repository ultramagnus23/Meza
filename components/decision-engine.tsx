"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { api } from "@/lib/api-client"
import { useStore } from "@/lib/store"
import { useCurrency } from "@/lib/hooks/use-currency"
import { DecisionAnalysisDialog } from "@/components/decision-analysis-dialog"
import type { Decision } from "@/lib/types"

export function DecisionEngine() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const { format } = useCurrency()
  const { updateDecisionStatus } = useStore()

  useEffect(() => {
    loadDecisions()
  }, [])

  async function loadDecisions() {
    try {
      setLoading(true)
      const response = await api.getDecisions()
      if (response.success) {
        setDecisions(response.data || [])
      }
    } catch (error) {
      console.error("Error loading decisions:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleImplement(decision: Decision) {
    try {
      await api.updateDecision(decision.id, "implementing")
      updateDecisionStatus(decision.id, "implementing")
      setDecisions(decisions.map((d) => (d.id === decision.id ? { ...d, status: "implementing" } : d)))
    } catch (error) {
      console.error("Error implementing decision:", error)
    }
  }

  async function handleDismiss(decision: Decision) {
    try {
      await api.updateDecision(decision.id, "dismissed")
      updateDecisionStatus(decision.id, "dismissed")
      setDecisions(decisions.map((d) => (d.id === decision.id ? { ...d, status: "dismissed" } : d)))
    } catch (error) {
      console.error("Error dismissing decision:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (decisions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No decisions available. Upload data to generate recommendations.</p>
        </CardContent>
      </Card>
    )
  }

  const totalOpportunity = {
    min: decisions.reduce((sum, d) => sum + d.impact.min, 0),
    max: decisions.reduce((sum, d) => sum + d.impact.max, 0),
  }
  const highPriority = decisions.filter((d) => d.priority === "high" && d.status === "pending").length
  const avgConfidence = decisions.length > 0
    ? decisions.reduce((sum, d) => sum + d.impact.confidence, 0) / decisions.length
    : 0

  // Calculate risk level dynamically based on decisions
  const highRiskDecisions = decisions.filter((d) => d.risks.length > 2).length
  const riskLevel = highRiskDecisions > decisions.length * 0.5 ? "High" :
    highRiskDecisions > 0 ? "Moderate" : "Low"

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Opportunity</CardDescription>
            <CardTitle className="text-3xl text-primary">
              {format(totalOpportunity.min)} - {format(totalOpportunity.max)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Monthly impact range</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>High Priority</CardDescription>
            <CardTitle className="text-3xl text-accent">{highPriority} Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Confidence</CardDescription>
            <CardTitle className="text-3xl text-foreground">{Math.round(avgConfidence)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Based on data analysis</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Risk Level</CardDescription>
            <CardTitle className={`text-3xl ${
              riskLevel === "High" ? "text-destructive" :
              riskLevel === "Moderate" ? "text-chart-2" :
              "text-chart-1"
            }`}>
              {riskLevel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {riskLevel === "High" ? "Multiple risks identified" :
               riskLevel === "Moderate" ? "All risks manageable" :
               "Low risk profile"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Decision Cards */}
      <div className="space-y-4">
        {decisions
          .filter((d) => d.status !== "dismissed")
          .sort((a, b) => {
            // Sort by priority (high first), then by impact
            if (a.priority !== b.priority) {
              return a.priority === "high" ? -1 : 1
            }
            return b.impact.min - a.impact.min
          })
          .map((decision) => (
            <Card key={decision.id} className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={decision.priority === "high" ? "default" : "secondary"}>
                        {decision.priority}
                      </Badge>
                      <Badge variant="outline">{decision.category}</Badge>
                      {decision.status !== "pending" && <Badge variant="secondary">{decision.status}</Badge>}
                    </div>
                    <CardTitle className="text-xl">
                      {decision.action}: {decision.item}
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground">Monthly Impact</p>
                    <p className="text-lg font-semibold text-primary">
                      {format(decision.impact.min)} to {format(decision.impact.max)}
                    </p>
                    <p className="text-xs text-muted-foreground">{decision.impact.confidence}% confidence</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reason */}
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Why This Matters
                  </h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{decision.reason}</p>
                </div>

                {/* Risks */}
                {decision.risks.length > 0 && (
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4 text-accent" />
                    Potential Risks
                  </h4>
                  <ul className="space-y-1">
                    {decision.risks.map((risk, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        • {risk}
                      </li>
                    ))}
                  </ul>
                </div>
                )}

                {/* Recommendation */}
                <div className="rounded-lg bg-primary/10 p-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                    <TrendingUp className="h-4 w-4" />
                    Recommended Action
                  </h4>
                  <p className="text-sm leading-relaxed text-foreground">{decision.recommendation}</p>
                </div>

                {decision.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => handleImplement(decision)}
                    >
                      Implement
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedDecision(decision)
                        setAnalysisOpen(true)
                      }}
                    >
                      View Analysis
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDismiss(decision)}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      <DecisionAnalysisDialog
        decision={selectedDecision}
        open={analysisOpen}
        onOpenChange={setAnalysisOpen}
      />
    </div>
  )
}
