"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface TheftAlert {
  type: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  title: string
  titleHindi?: string
  message: string
  relatedStaffId: number | null
  suspicionScore: number
}

interface FlaggedStaff {
  id: number
  name: string
  role: string
  voidCount: number
  voidAmount: number
  voidRate: number
  suspicionScore: number
  flags: string[]
  recommendation: string
}

interface TheftDetectionData {
  alerts: TheftAlert[]
  flaggedStaff: FlaggedStaff[]
  inventoryAlerts: Array<{
    id: number
    name: string
    category: string
    expectedStock: number
    actualStock: number
    variance: number
    variancePercent: number
    estimatedLoss: number
    severity: string
  }>
  frequentlyVoidedItems: Array<{
    name: string
    voidCount: number
  }>
  summary: {
    totalVoids: number
    totalVoidAmount: number
    avgPeerVoidRate: number
    flaggedStaffCount: number
    inventoryAlertsCount: number
  }
}

interface AlertCardProps {
  alert: TheftAlert
  onViewDetails?: (alert: TheftAlert) => void
}

function AlertCard({ alert, onViewDetails }: AlertCardProps) {
  const severityColors: Record<string, string> = {
    CRITICAL: "bg-red-50 border-red-300 shadow-red-100",
    HIGH: "bg-orange-50 border-orange-300 shadow-orange-100",
    MEDIUM: "bg-yellow-50 border-yellow-300 shadow-yellow-100",
    LOW: "bg-blue-50 border-blue-300 shadow-blue-100",
  }

  const severityEmoji: Record<string, string> = {
    CRITICAL: "🔴🔴🔴",
    HIGH: "🔴",
    MEDIUM: "🟡",
    LOW: "🟢",
  }

  const typeEmoji: Record<string, string> = {
    VOID_PATTERN: "🚨",
    THEFT_SUSPECTED: "📦",
    STOCK_LOW: "📦",
    INVENTORY: "📦",
  }

  return (
    <div
      className={`rounded-lg border-2 p-4 shadow-sm ${
        severityColors[alert.severity] || severityColors.LOW
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">
          {typeEmoji[alert.type] || "⚠️"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{severityEmoji[alert.severity]}</span>
            <h3 className="font-semibold">{alert.title}</h3>
          </div>
          {alert.titleHindi && (
            <p className="text-sm text-muted-foreground italic mb-2">
              {alert.titleHindi}
            </p>
          )}
          <p className="text-sm mb-2">{alert.message}</p>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-white/50 px-2 py-1 rounded">
              Suspicion: {alert.suspicionScore}%
            </span>
            <span
              className={`text-xs px-2 py-1 rounded ${
                alert.severity === "CRITICAL"
                  ? "bg-red-200 text-red-800"
                  : alert.severity === "HIGH"
                  ? "bg-orange-200 text-orange-800"
                  : "bg-gray-200"
              }`}
            >
              {alert.severity}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewDetails?.(alert)}
        >
          View Details
        </Button>
      </div>
    </div>
  )
}

interface StaffCardProps {
  staff: FlaggedStaff
  onViewDetails?: (staff: FlaggedStaff) => void
}

function StaffCard({ staff, onViewDetails }: StaffCardProps) {
  const getSeverityClass = (score: number) => {
    if (score >= 75) return "bg-red-50 border-red-300"
    if (score >= 50) return "bg-orange-50 border-orange-300"
    return "bg-yellow-50 border-yellow-300"
  }

  return (
    <div className={`rounded-lg border-2 p-4 ${getSeverityClass(staff.suspicionScore)}`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{staff.name}</h4>
          <p className="text-xs text-muted-foreground">{staff.role}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{staff.suspicionScore}%</div>
          <p className="text-xs text-muted-foreground">Suspicion</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="bg-white/50 rounded p-2">
          <p className="text-lg font-semibold">{staff.voidCount}</p>
          <p className="text-xs text-muted-foreground">Voids</p>
        </div>
        <div className="bg-white/50 rounded p-2">
          <p className="text-lg font-semibold">₹{staff.voidAmount.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Amount</p>
        </div>
        <div className="bg-white/50 rounded p-2">
          <p className="text-lg font-semibold">{staff.voidRate.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Rate</p>
        </div>
      </div>

      {staff.flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {staff.flags.map((flag, idx) => (
            <span
              key={idx}
              className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded"
            >
              {flag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 p-2 bg-white/70 rounded text-xs">
        <strong>Recommendation:</strong> {staff.recommendation}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        onClick={() => onViewDetails?.(staff)}
      >
        Review Details
      </Button>
    </div>
  )
}

interface TheftAlertsProps {
  restaurantId?: string
  onAlertClick?: (alert: TheftAlert) => void
  onStaffClick?: (staff: FlaggedStaff) => void
}

export function TheftAlerts({ restaurantId, onAlertClick, onStaffClick }: TheftAlertsProps) {
  const [data, setData] = useState<TheftDetectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"alerts" | "staff" | "inventory">("alerts")

  useEffect(() => {
    loadData()
  }, [restaurantId])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (restaurantId) params.set("restaurantId", restaurantId)
      params.set("days", "30")

      const response = await fetch(`/api/analytics/theft-detection?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || "Failed to load data")
      }
    } catch (err) {
      setError("Failed to fetch theft detection data")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadData} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  const criticalAlerts = data.alerts.filter((a) => a.severity === "CRITICAL")
  const highAlerts = data.alerts.filter((a) => a.severity === "HIGH")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚨 Theft Detection
          {criticalAlerts.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {criticalAlerts.length} Critical
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Void patterns and inventory variance analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.summary.totalVoids}</p>
            <p className="text-xs text-muted-foreground">Total Voids</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">₹{(data.summary.totalVoidAmount / 1000).toFixed(1)}k</p>
            <p className="text-xs text-muted-foreground">Void Amount</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.summary.flaggedStaffCount}</p>
            <p className="text-xs text-muted-foreground">Flagged Staff</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.summary.inventoryAlertsCount}</p>
            <p className="text-xs text-muted-foreground">Inventory Alerts</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "alerts" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("alerts")}
          >
            Alerts ({data.alerts.length})
          </Button>
          <Button
            variant={activeTab === "staff" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("staff")}
          >
            Staff ({data.flaggedStaff.length})
          </Button>
          <Button
            variant={activeTab === "inventory" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("inventory")}
          >
            Inventory ({data.inventoryAlerts.length})
          </Button>
        </div>

        {/* Content */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            {data.alerts.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl">✅</span>
                <p className="mt-2 text-muted-foreground">No suspicious patterns detected</p>
              </div>
            ) : (
              data.alerts.map((alert, idx) => (
                <AlertCard
                  key={idx}
                  alert={alert}
                  onViewDetails={onAlertClick}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "staff" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.flaggedStaff.length === 0 ? (
              <div className="col-span-2 text-center py-8">
                <span className="text-4xl">✅</span>
                <p className="mt-2 text-muted-foreground">No staff flagged</p>
              </div>
            ) : (
              data.flaggedStaff.map((staff) => (
                <StaffCard
                  key={staff.id}
                  staff={staff}
                  onViewDetails={onStaffClick}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-3">
            {data.inventoryAlerts.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl">✅</span>
                <p className="mt-2 text-muted-foreground">No inventory variances detected</p>
              </div>
            ) : (
              data.inventoryAlerts.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border-2 ${
                    item.severity === "HIGH"
                      ? "bg-red-50 border-red-300"
                      : item.severity === "MEDIUM"
                      ? "bg-yellow-50 border-yellow-300"
                      : "bg-blue-50 border-blue-300"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{item.name}</h4>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.severity === "HIGH"
                        ? "bg-red-200 text-red-800"
                        : "bg-yellow-200 text-yellow-800"
                    }`}>
                      {item.variancePercent.toFixed(1)}% variance
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Expected:</span>{" "}
                      <strong>{item.expectedStock}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Actual:</span>{" "}
                      <strong>{item.actualStock}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Loss:</span>{" "}
                      <strong className="text-red-600">₹{item.estimatedLoss}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Frequently Voided Items */}
        {data.frequentlyVoidedItems.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">⚠️ Frequently Voided Items</h4>
            <div className="flex flex-wrap gap-2">
              {data.frequentlyVoidedItems.slice(0, 5).map((item, idx) => (
                <span
                  key={idx}
                  className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded"
                >
                  {item.name} ({item.voidCount}x)
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TheftAlerts
