"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CartesianGrid, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Tooltip, LineChart, Line } from "recharts"
import { Play, RotateCcw, TrendingUp, AlertTriangle, Loader2 } from "lucide-react"
import { api } from "@/lib/api-client"
import { useCurrency } from "@/lib/hooks/use-currency"
import type { MenuEngineering } from "@/lib/types"

type ScenarioType = "price" | "menu" | "staff" | "channel"

interface SimulationResult {
  scenario: string
  baseline: number
  projected: number
  upside: number
  downside: number
  confidence: number
  risks: string[]
}

export function ScenarioSimulator() {
  const [scenarioType, setScenarioType] = useState<ScenarioType>("price")
  const [priceChange, setPriceChange] = useState(0)
  const [volumeImpact, setVolumeImpact] = useState(0)
  const [selectedMenuItem, setSelectedMenuItem] = useState<string>("")
  const [menuItems, setMenuItems] = useState<MenuEngineering[]>([])
  const [channelShift, setChannelShift] = useState(0)
  const [staffingChange, setStaffingChange] = useState(0)
  const [results, setResults] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const { format } = useCurrency()

  useEffect(() => {
    loadMenuItems()
  }, [])

  async function loadMenuItems() {
    try {
      setLoadingMenu(true)
      const response = await api.getMenuEngineering()
      if (response.success && response.data) {
        setMenuItems(response.data)
        if (response.data.length > 0) {
          setSelectedMenuItem(response.data[0].id)
        }
      }
    } catch (error) {
      console.error("Error loading menu items:", error)
    } finally {
      setLoadingMenu(false)
    }
  }

  const runSimulation = async () => {
    setLoading(true)
    try {
      // Fetch baseline data from API
      const baselineRes = await fetch("/api/analytics/dashboard")
      const baselineData = await baselineRes.json()
      
      if (!baselineData.success || baselineData.data.totalOrders === 0) {
        alert("Unable to fetch baseline data. Please upload data first.")
        setLoading(false)
        return
      }

      const baseRevenue = baselineData.data.totalRevenue || 0
      const baseOrders = baselineData.data.totalOrders || 0
      const avgOrderValue = baselineData.data.avgOrderValue || 0
      
    let result: SimulationResult

    if (scenarioType === "price") {
        // Get selected menu item details
        const selectedItem = menuItems.find((m) => m.id === selectedMenuItem)
        if (!selectedItem) {
          alert("Please select a menu item")
          setLoading(false)
          return
        }

        // Calculate price elasticity based on item characteristics
        // High margin items are less price-sensitive (lower elasticity)
        const marginRatio = selectedItem.margin / selectedItem.price
        const elasticity = marginRatio > 0.5 ? 0.8 : marginRatio > 0.3 ? 1.2 : 1.5
        
        // Calculate volume change based on price change and elasticity
        const priceChangePercent = priceChange / selectedItem.price
        const volumeChangePercent = -priceChangePercent * elasticity
        const volumeChange = 1 + volumeChangePercent
        
        // Calculate new revenue
        const currentItemRevenue = selectedItem.revenue
        const currentItemOrders = selectedItem.orders
        const newPrice = selectedItem.price + priceChange
        const newOrders = Math.max(0, currentItemOrders * volumeChange)
        const newItemRevenue = newPrice * newOrders
        
        // Calculate impact on total revenue
        const revenueChange = newItemRevenue - currentItemRevenue
        const projectedRevenue = baseRevenue + revenueChange
        
        // Calculate confidence based on data quality
        const confidence = Math.max(50, 85 - Math.abs(priceChangePercent) * 20)

      result = {
          scenario: `${priceChange > 0 ? "Increase" : "Decrease"} ${selectedItem.name} price by ₹${Math.abs(priceChange)}`,
        baseline: baseRevenue,
          projected: projectedRevenue,
          upside: projectedRevenue * 1.15,
          downside: projectedRevenue * 0.85,
          confidence: Math.round(confidence),
        risks: [
            `Volume may ${volumeChangePercent < 0 ? "decrease" : "increase"} by ${Math.abs(Math.round(volumeChangePercent * 100))}%`,
            "Competitors may adjust pricing",
            "Customer behavior may vary from historical patterns",
        ],
      }
    } else if (scenarioType === "menu") {
        // Menu changes would need menu engineering data
        const lowPerformer = menuItems.find((m) => m.engineeringCategory === "Dogs")
        
        if (!lowPerformer) {
          alert("No low-performing items found to remove")
          setLoading(false)
          return
        }
        
        // Estimate revenue improvement from removing bottleneck item
        const bottleneckImpact = lowPerformer.prepTime * lowPerformer.orders * 2.3 // Opportunity cost
        const projectedRevenue = baseRevenue - lowPerformer.revenue + (bottleneckImpact * avgOrderValue)
        
      result = {
          scenario: `Remove ${lowPerformer.name}`,
          baseline: baseRevenue,
          projected: projectedRevenue,
          upside: projectedRevenue * 1.2,
          downside: projectedRevenue * 0.9,
          confidence: 65,
          risks: ["New item adoption uncertain", "May lose regular customers", "Recipe development time"],
      }
    } else if (scenarioType === "staff") {
      const shiftImpact = staffingChange / 100
      const efficiencyGain = shiftImpact * 0.11 // 11% turnover improvement
        const revGain = baseRevenue * efficiencyGain
        const estimatedCost = baseRevenue * 0.15 * Math.abs(shiftImpact) // Estimate 15% of revenue is labor

      result = {
        scenario: `${staffingChange > 0 ? "Add" : "Reduce"} ${Math.abs(staffingChange)}% staff hours`,
          baseline: baseRevenue,
          projected: baseRevenue + revGain - estimatedCost,
          upside: (baseRevenue + revGain - estimatedCost) * 1.15,
          downside: (baseRevenue + revGain - estimatedCost) * 0.85,
          confidence: 65,
        risks: ["Staff morale impact", "Training time for new hires", "Potential service quality changes"],
      }
    } else {
        // channel - fetch channel data
        const channelRes = await fetch("/api/analytics/channels")
        const channelData = await channelRes.json()
        const directChannel = channelData.data?.find((c: any) => c.channel === "delivery-direct")
        const aggregatorChannels = channelData.data?.filter((c: any) => 
          c.channel.includes("zomato") || c.channel.includes("swiggy")
        )
        const aggregatorRevenue = aggregatorChannels?.reduce((sum: number, c: any) => sum + c.totalRevenue, 0) || 0
        const directRevenue = directChannel?.totalRevenue || 0
        
      const shift = channelShift / 100
      const lostAggregatorRev = aggregatorRevenue * shift
      const gainedDirectRev = lostAggregatorRev * 0.85 // 15% drop during migration
        const marginGain = (directChannel?.netMarginPercent || 0) - (aggregatorChannels?.[0]?.netMarginPercent || 0)

      result = {
        scenario: `Shift ${channelShift}% from aggregators to direct`,
          baseline: baseRevenue,
          projected: baseRevenue - lostAggregatorRev + gainedDirectRev + (marginGain / 100) * gainedDirectRev,
          upside: (baseRevenue - lostAggregatorRev + gainedDirectRev + (marginGain / 100) * gainedDirectRev) * 1.1,
          downside: (baseRevenue - lostAggregatorRev + gainedDirectRev + (marginGain / 100) * gainedDirectRev) * 0.9,
          confidence: 75,
          risks: ["Customer adoption of direct ordering", "Marketing spend required", "Initial volume loss"],
      }
    }

    setResults(result)
    } catch (error) {
      console.error("Error running simulation:", error)
      alert("Error running simulation. Please ensure data is uploaded.")
    } finally {
      setLoading(false)
    }
  }

  const resetSimulation = () => {
    setPriceChange(0)
    setVolumeImpact(0)
    setChannelShift(0)
    setStaffingChange(0)
    setResults(null)
  }

  const selectedItem = menuItems.find((m) => m.id === selectedMenuItem)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scenario Simulator</CardTitle>
          <CardDescription>
            Model "what-if" scenarios to understand potential impacts on revenue and operations
          </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={scenarioType} onValueChange={(v) => setScenarioType(v as ScenarioType)}>
              <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="price">Price Change</TabsTrigger>
              <TabsTrigger value="menu">Menu Change</TabsTrigger>
                <TabsTrigger value="staff">Staffing</TabsTrigger>
              <TabsTrigger value="channel">Channel Mix</TabsTrigger>
              </TabsList>

            <TabsContent value="price" className="space-y-4 mt-4">
              {loadingMenu ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div>
                  <Label>Select Menu Item</Label>
                    <Select value={selectedMenuItem} onValueChange={setSelectedMenuItem}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select an item" />
                    </SelectTrigger>
                    <SelectContent>
                        {menuItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} (₹{item.price}, {item.orders} orders)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                  {selectedItem && (
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      <p className="text-sm font-medium">Current Stats:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Price: ₹{selectedItem.price}</div>
                        <div>Margin: ₹{selectedItem.margin}</div>
                        <div>Orders: {selectedItem.orders}</div>
                        <div>Revenue: ₹{selectedItem.revenue.toLocaleString()}</div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Price Change (₹)</Label>
                    <div className="flex items-center gap-4">
                  <Slider
                    value={[priceChange]}
                        onValueChange={([v]) => setPriceChange(v)}
                        min={-selectedItem?.price || -1000}
                        max={selectedItem?.price || 1000}
                        step={10}
                        className="flex-1"
                  />
                      <Input
                        type="number"
                        value={priceChange}
                        onChange={(e) => setPriceChange(Number(e.target.value))}
                        className="w-24"
                      />
                </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {priceChange > 0 ? `Increase by ₹${priceChange}` : priceChange < 0 ? `Decrease by ₹${Math.abs(priceChange)}` : "No change"}
                    </p>
                </div>
                </>
              )}
              </TabsContent>

            <TabsContent value="menu" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                Simulate removing low-performing items and their impact on kitchen capacity.
                  </p>
              </TabsContent>

            <TabsContent value="staff" className="space-y-4 mt-4">
              <div>
                <Label>Staffing Change (%)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[staffingChange]}
                    onValueChange={([v]) => setStaffingChange(v)}
                    min={-50}
                    max={50}
                    step={5}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={staffingChange}
                    onChange={(e) => setStaffingChange(Number(e.target.value))}
                    className="w-24"
                  />
                </div>
                </div>
              </TabsContent>

            <TabsContent value="channel" className="space-y-4 mt-4">
              <div>
                <Label>Shift from Aggregators to Direct (%)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[channelShift]}
                    onValueChange={([v]) => setChannelShift(v)}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={channelShift}
                    onChange={(e) => setChannelShift(Number(e.target.value))}
                    className="w-24"
                  />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

          <div className="flex gap-2 mt-6">
            <Button onClick={runSimulation} disabled={loading || loadingMenu} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                Run Simulation
                </>
              )}
              </Button>
            <Button onClick={resetSimulation} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

      {results && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
                <CardTitle>Simulation Results</CardTitle>
                <CardDescription>{results.scenario}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Baseline Revenue</p>
                <p className="text-2xl font-bold">{format(results.baseline)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projected Revenue</p>
                <p className="text-2xl font-bold text-primary">{format(results.projected)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Confidence</p>
                <p className="text-2xl font-bold">{results.confidence}%</p>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium mb-2">Impact Range</p>
              <div className="flex items-center gap-4">
            <div>
                  <p className="text-xs text-muted-foreground">Downside</p>
                  <p className="text-lg font-semibold text-destructive">{format(results.downside)}</p>
                </div>
                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${((results.projected - results.downside) / (results.upside - results.downside)) * 100}%`,
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Upside</p>
                  <p className="text-lg font-semibold text-chart-1">{format(results.upside)}</p>
                </div>
              </div>
            </div>

            {results.risks.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-accent" />
                  Risks
                </p>
                <ul className="space-y-1">
                {results.risks.map((risk, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">• {risk}</li>
                ))}
              </ul>
            </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
