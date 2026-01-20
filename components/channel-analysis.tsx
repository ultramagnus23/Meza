"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, ShoppingCart } from "lucide-react"
import { api } from "@/lib/api-client"
import { useCurrency } from "@/lib/hooks/use-currency"
import type { ChannelMetrics } from "@/lib/types"
import {
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const getChannelColor = (index: number) => {
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ]
  return colors[index % colors.length]
}

export function ChannelAnalysis() {
  const [channels, setChannels] = useState<ChannelMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const { format } = useCurrency()

  useEffect(() => {
    loadChannelData()
  }, [])

  async function loadChannelData() {
    try {
      setLoading(true)
      const response = await api.getChannelMetrics()
      console.log("[v0] Loaded channel metrics:", response.data)
      setChannels(response.data)
    } catch (error) {
      console.error("[v0] Error loading channel data:", error)
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

  const totalRevenue = channels.reduce((sum, ch) => sum + ch.totalRevenue, 0)
  const totalOrders = channels.reduce((sum, ch) => sum + ch.totalOrders, 0)
  const weightedNetMargin =
    channels.reduce((sum, ch) => sum + ch.netMarginPercent * ch.totalRevenue, 0) / (totalRevenue || 1)
  const directChannels = channels.filter((ch) => ch.netMarginPercent > 80)
  const aggregatorChannels = channels.filter((ch) => ch.netMarginPercent < 20)

  const channelQuality = channels.map((ch) => {
    const avgOrderValue = channels.reduce((sum, c) => sum + c.avgOrderValue, 0) / (channels.length || 1)
    return {
    channel: ch.channel.split("-")[0],
    margin: ch.netMarginPercent,
      conversion: ch.repeatRate > 50 ? 75 : ch.repeatRate > 30 ? 60 : 45, // Estimated based on repeat rate
    repeat: ch.repeatRate,
      check: avgOrderValue > 0 ? (ch.avgOrderValue / avgOrderValue) * 100 : 100,
    }
  })

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Channel Revenue</CardDescription>
            <CardTitle className="text-3xl text-primary">{format(totalRevenue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {totalOrders} orders across {channels.length} channels
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Weighted Net Margin</CardDescription>
            <CardTitle className="text-3xl text-accent">{weightedNetMargin.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Revenue-adjusted average</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Direct Channels</CardDescription>
            <CardTitle className="text-3xl text-foreground">{directChannels.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {directChannels.length > 0
                ? `${directChannels[0].netMarginPercent}% avg net margin`
                : "No direct channels"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Aggregator Channels</CardDescription>
            <CardTitle className="text-3xl text-chart-5">{aggregatorChannels.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {aggregatorChannels.length > 0
                ? `${Math.round(
                    aggregatorChannels.reduce((sum, ch) => sum + ch.netMarginPercent, 0) / aggregatorChannels.length,
                  )}% avg net margin`
                : "No aggregators"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Performance Comparison</CardTitle>
          <CardDescription>Net margin, orders, and repeat behavior by channel</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={channels}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="channel"
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
              <Bar dataKey="netMarginPercent" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Net Margin %" />
              <Bar dataKey="repeatRate" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="Repeat Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Channel Mix & Quality */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
            <CardDescription>Current channel mix by revenue contribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={channels}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ channel, percent }) => `${channel.split("-")[0]} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="hsl(var(--primary))"
                  dataKey="totalRevenue"
                >
                  {channels.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getChannelColor(index)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel Quality Profile</CardTitle>
            <CardDescription>Multi-dimensional performance assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={channelQuality}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" />
                <Radar
                  name="Margin"
                  dataKey="margin"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Repeat"
                  dataKey="repeat"
                  stroke="hsl(var(--chart-3))"
                  fill="hsl(var(--chart-3))"
                  fillOpacity={0.3}
                />
                <Legend />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Channel Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel, index) => (
          <Card key={channel.channel} className="border-l-4" style={{ borderLeftColor: getChannelColor(index) }}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{channel.channel}</CardTitle>
                  <CardDescription>{channel.totalOrders} orders</CardDescription>
                </div>
                <Badge variant={channel.netMarginPercent > 80 ? "default" : "destructive"}>
                  {channel.netMarginPercent}% margin
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Revenue */}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-semibold text-foreground">{format(channel.totalRevenue)}</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Avg Order</p>
                  <p className="font-semibold text-foreground">{format(channel.avgOrderValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Repeat Rate</p>
                  <p className="font-semibold text-foreground">{channel.repeatRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CAC</p>
                  <p className="font-semibold text-foreground">{format(channel.customerAcquisitionCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">LTV</p>
                  <p className="font-semibold text-foreground">{format(channel.lifetimeValue)}</p>
                </div>
              </div>

              {/* LTV to CAC Ratio */}
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">LTV:CAC Ratio</span>
                  <span className="font-semibold text-primary">{channel.ltvCacRatio.toFixed(1)}x</span>
                </div>
                <Progress value={Math.min((channel.ltvCacRatio / 50) * 100, 100)} className="h-2" />
              </div>

              {/* Gross vs Net */}
              <div className="rounded-lg bg-muted p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Gross Margin</span>
                  <span className="font-medium text-foreground">
                    {((channel.grossMargin / channel.totalRevenue) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Net Margin</span>
                  <span className="font-semibold text-primary">{channel.netMarginPercent}%</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Platform fees: {format(channel.platformFees)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights Panel */}
      <Card className="border-l-4 border-l-accent">
        <CardHeader>
          <div className="flex items-start gap-3">
            <ShoppingCart className="mt-1 h-5 w-5 text-accent" />
            <div>
              <CardTitle>Channel Strategy Insights</CardTitle>
              <CardDescription>Key findings from channel performance analysis</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {directChannels.length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm leading-relaxed text-foreground">
                <strong className="text-primary">
                  Direct channels show {directChannels[0].repeatRate}% repeat rate
                </strong>{" "}
                with {directChannels[0].netMarginPercent}% net margin. Shifting more volume to direct ordering could
                significantly improve profitability.
              </p>
            </div>
          )}
          {aggregatorChannels.length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm leading-relaxed text-foreground">
                <strong className="text-primary">Aggregator platforms</strong> represent{" "}
                {((aggregatorChannels.reduce((sum, ch) => sum + ch.totalOrders, 0) / totalOrders) * 100).toFixed(0)}% of
                orders but only{" "}
                {Math.round(
                  aggregatorChannels.reduce((sum, ch) => sum + ch.netMarginPercent, 0) / aggregatorChannels.length,
                )}
                % net margin. Consider loyalty programs to migrate customers to direct ordering.
              </p>
            </div>
          )}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm leading-relaxed text-foreground">
              <strong className="text-primary">Channel optimization</strong> could increase monthly profit by{" "}
              {format(totalRevenue * 0.08)} - {format(totalRevenue * 0.12)} through better channel mix and customer
              acquisition strategies.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
