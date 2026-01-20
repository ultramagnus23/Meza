"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from "recharts"
import { Clock, TrendingUp, AlertTriangle, Loader2 } from "lucide-react"
import { api } from "@/lib/api-client"
import { useCurrency } from "@/lib/hooks/use-currency"
import type { TimeSlot, TableMetrics } from "@/lib/types"

export function TimeCapacity() {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [tableMetrics, setTableMetrics] = useState<TableMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const { format } = useCurrency()

  useEffect(() => {
    loadCapacityData()
  }, [])

  async function loadCapacityData() {
    try {
      setLoading(true)
      const response = await api.getCapacityMetrics()
      if (response.success) {
        setTimeSlots(response.data.timeSlots || [])
        setTableMetrics(response.data.tableMetrics || [])
      }
    } catch (error) {
      console.error("Error loading capacity data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Transform data for charts
  const revpashData = timeSlots.map((slot) => ({
    hour: `${slot.hour}${slot.hour >= 12 ? "pm" : "am"}`,
    revpash: slot.revPASH,
    seats: slot.capacity,
    turnover: slot.avgTableTurnover,
    util: slot.utilizationPercent,
  }))

  const tableSizeData = tableMetrics.map((table) => ({
    size: `${table.size}-top`,
    tables: table.count,
    utilization: table.avgUtilization,
    revPerTable: table.avgRevenue,
    idealPartySize: table.size * 0.9, // Estimate
    mismatch: Math.max(0, 100 - table.avgUtilization - 20), // Simplified mismatch calculation
  }))

  const kitchenCapacity = timeSlots.map((slot) => ({
    time: `${slot.hour}${slot.hour >= 12 ? "pm" : "am"}`,
    orders: slot.orders,
    capacity: slot.capacity,
    bottleneck: slot.utilizationPercent > 95 ? slot.orders * 1.1 : slot.orders,
  }))

  // Calculate peak vs off-peak
  const peakSlots = timeSlots.filter((s) => s.hour >= 18 && s.hour <= 21)
  const offPeakSlots = timeSlots.filter((s) => s.hour >= 14 && s.hour < 18)

  const peakAvgCheck = peakSlots.length > 0
    ? peakSlots.reduce((sum, s) => sum + s.revenue, 0) / peakSlots.reduce((sum, s) => sum + s.orders, 0)
    : 0
  const offPeakAvgCheck = offPeakSlots.length > 0
    ? offPeakSlots.reduce((sum, s) => sum + s.revenue, 0) / offPeakSlots.reduce((sum, s) => sum + s.orders, 0)
    : 0

  const peakTurnover = peakSlots.length > 0
    ? peakSlots.reduce((sum, s) => sum + s.avgTableTurnover, 0) / peakSlots.length
    : 0
  const offPeakTurnover = offPeakSlots.length > 0
    ? offPeakSlots.reduce((sum, s) => sum + s.avgTableTurnover, 0) / offPeakSlots.length
    : 0

  const peakUtilization = peakSlots.length > 0
    ? peakSlots.reduce((sum, s) => sum + s.utilizationPercent, 0) / peakSlots.length
    : 0
  const offPeakUtilization = offPeakSlots.length > 0
    ? offPeakSlots.reduce((sum, s) => sum + s.utilizationPercent, 0) / offPeakSlots.length
    : 0

  const peakComparison = [
    { metric: "Avg Check", peak: peakAvgCheck, offPeak: offPeakAvgCheck },
    { metric: "Turnover", peak: peakTurnover, offPeak: offPeakTurnover },
    { metric: "Utilization", peak: peakUtilization, offPeak: offPeakUtilization },
    { metric: "RevPASH", peak: peakSlots.length > 0 ? peakSlots.reduce((sum, s) => sum + s.revPASH, 0) / peakSlots.length : 0, offPeak: offPeakSlots.length > 0 ? offPeakSlots.reduce((sum, s) => sum + s.revPASH, 0) / offPeakSlots.length : 0 },
  ]

  const avgRevPASH = revpashData.length > 0 ? revpashData.reduce((sum, d) => sum + d.revpash, 0) / revpashData.length : 0
  const peakRevPASH = revpashData.length > 0 ? Math.max(...revpashData.map((d) => d.revpash)) : 0
  const avgUtilization = revpashData.length > 0 ? revpashData.reduce((sum, d) => sum + d.util, 0) / revpashData.length : 0
  const bottleneckHours = kitchenCapacity.filter((d) => d.orders >= d.capacity * 0.95).length

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg RevPASH</CardDescription>
            <CardTitle className="text-3xl text-primary">{format(avgRevPASH)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Revenue per available seat hour</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Peak RevPASH</CardDescription>
            <CardTitle className="text-3xl text-accent">{format(peakRevPASH)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">7pm dinner rush</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Seat Utilization</CardDescription>
            <CardTitle className="text-3xl text-foreground">{avgUtilization.toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Average across all hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Bottleneck Hours</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl text-chart-5">
              {bottleneckHours} <AlertTriangle className="h-5 w-5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Kitchen at 95%+ capacity</p>
          </CardContent>
        </Card>
      </div>

      {/* RevPASH Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Per Available Seat Hour (RevPASH)</CardTitle>
          <CardDescription>Hourly capacity utilization and revenue efficiency</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={revpashData}>
              <defs>
                <linearGradient id="colorRevpash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="hour"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                label={{
                  value: "RevPASH ($)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "hsl(var(--foreground))",
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                label={{
                  value: "Utilization (%)",
                  angle: 90,
                  position: "insideRight",
                  fill: "hsl(var(--foreground))",
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revpash"
                stroke="hsl(var(--chart-1))"
                fillOpacity={1}
                fill="url(#colorRevpash)"
                name="RevPASH"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="util"
                stroke="hsl(var(--chart-2))"
                fillOpacity={1}
                fill="url(#colorUtil)"
                name="Utilization %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table Size Efficiency */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Table Size Efficiency</CardTitle>
            <CardDescription>Utilization and revenue by table configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tableSizeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="size"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
                <Bar dataKey="utilization" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Utilization %" />
                <Bar dataKey="mismatch" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} name="Size Mismatch %" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {tableSizeData.map((table) => (
                <div key={table.size} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {table.size} ({table.tables} tables)
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-foreground">{format(table.revPerTable)}/table</span>
                    <Badge variant={table.mismatch > 20 ? "destructive" : "secondary"}>
                      {table.mismatch}% mismatch
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kitchen Capacity Analysis</CardTitle>
            <CardDescription>Order volume vs. kitchen capacity limits</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={kitchenCapacity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="time"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  label={{
                    value: "Orders/Hour",
                    angle: -90,
                    position: "insideLeft",
                    fill: "hsl(var(--foreground))",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Actual Orders"
                />
                <Line
                  type="monotone"
                  dataKey="capacity"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Max Capacity"
                />
                <Line
                  type="monotone"
                  dataKey="bottleneck"
                  stroke="hsl(var(--chart-5))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="With Bottlenecks"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Peak vs Off-Peak */}
      <Card>
        <CardHeader>
          <CardTitle>Peak vs. Off-Peak Behavior</CardTitle>
          <CardDescription>Key operational differences between time periods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {peakComparison.map((item) => (
              <div key={item.metric} className="space-y-2 rounded-lg bg-muted p-4">
                <p className="text-sm font-medium text-muted-foreground">{item.metric}</p>
                <div className="flex items-baseline gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Peak</p>
                    <p className="text-2xl font-semibold text-primary">{item.peak}</p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-chart-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Off-Peak</p>
                    <p className="text-2xl font-semibold text-foreground">{item.offPeak}</p>
                  </div>
                </div>
                <p className="text-xs text-accent">
                  {(((item.peak - item.offPeak) / item.offPeak) * 100).toFixed(0)}% difference
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights Panel */}
      <Card className="border-l-4 border-l-accent">
        <CardHeader>
          <div className="flex items-start gap-3">
            <Clock className="mt-1 h-5 w-5 text-accent" />
            <div>
              <CardTitle>Capacity Optimization Insights</CardTitle>
              <CardDescription>Actionable findings from time and capacity analysis</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {peakComparison.length > 0 && peakComparison.find((p) => p.metric === "RevPASH") && (() => {
            const revpashData = peakComparison.find((p) => p.metric === "RevPASH")
            const dropPercent = revpashData && revpashData.offPeak > 0
              ? Math.round(((revpashData.peak - revpashData.offPeak) / revpashData.offPeak) * 100)
              : 0
            const peakHour = timeSlots.find((s) => s.revPASH === peakRevPASH)?.hour || 19
            const offPeakHour = timeSlots.find((s) => s.revPASH === Math.min(...timeSlots.map((s) => s.revPASH)))?.hour || 15
            
            return (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm leading-relaxed text-foreground">
                  <strong className="text-primary">RevPASH drops {Math.abs(dropPercent)}%</strong> between peak ({peakHour}:00 - {format(revpashData?.peak || 0)}) and off-peak ({offPeakHour}:00 - {format(revpashData?.offPeak || 0)}). Strategic promotions during off-peak hours could capture additional revenue with existing capacity.
            </p>
          </div>
            )
          })()}
          
          {tableMetrics.length > 0 && (() => {
            const worstTable = tableMetrics.reduce((worst, current) => 
              current.avgUtilization < worst.avgUtilization ? current : worst
            )
            const mismatch = 100 - worstTable.avgUtilization
            
            if (mismatch > 20) {
              return (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm leading-relaxed text-foreground">
                    <strong className="text-primary">{worstTable.size}-top tables show {Math.round(mismatch)}% size mismatch</strong> with only {Math.round(worstTable.avgUtilization)}% utilization. Consider optimizing table configuration to improve overall seat efficiency.
            </p>
          </div>
              )
            }
            return null
          })()}
          
          {bottleneckHours > 0 && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm leading-relaxed text-foreground">
                <strong className="text-primary">Kitchen bottlenecks</strong> occur during {bottleneckHours} hour{bottleneckHours !== 1 ? "s" : ""} when actual demand exceeds capacity. Prep time optimization could recover capacity during peak hours.
              </p>
            </div>
          )}
          
          {timeSlots.length === 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Upload data to see capacity optimization insights.
            </p>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
