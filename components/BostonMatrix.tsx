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

interface BostonMatrixItem {
  id: number
  name: string
  nameHindi?: string
  category?: string
  price: number
  cost: number
  margin: number
  salesCount: number
  popularity: number
  classification: "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG"
  recommendation: string
  flags: string[]
  aggregatorDependency?: number
  theftRisk?: number
}

interface BostonMatrixData {
  items: BostonMatrixItem[]
  summary: {
    stars: BostonMatrixItem[]
    plowhorses: BostonMatrixItem[]
    puzzles: BostonMatrixItem[]
    dogs: BostonMatrixItem[]
  }
  stats: {
    totalItems: number
    starCount: number
    plowhorseCount: number
    puzzleCount: number
    dogCount: number
    medianPopularity: number
    medianMargin: number
  }
}

interface QuadrantProps {
  title: string
  emoji: string
  color: string
  items: BostonMatrixItem[]
  action: string
  onItemClick?: (item: BostonMatrixItem) => void
}

function Quadrant({ title, emoji, color, items, action, onItemClick }: QuadrantProps) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-50 border-green-300",
    blue: "bg-blue-50 border-blue-300",
    yellow: "bg-yellow-50 border-yellow-300",
    red: "bg-red-50 border-red-300",
  }

  const headerColors: Record<string, string> = {
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
  }

  return (
    <div className={`rounded-lg border-2 ${colorClasses[color]} overflow-hidden`}>
      <div className={`p-3 ${headerColors[color]}`}>
        <h3 className="font-bold flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          {title}
          <span className="ml-auto bg-white/50 px-2 py-0.5 rounded text-sm">
            {items.length}
          </span>
        </h3>
      </div>
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No items</p>
        ) : (
          items.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="bg-white/70 rounded p-2 cursor-pointer hover:bg-white transition-colors"
              onClick={() => onItemClick?.(item)}
            >
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm">{item.name}</span>
                <span className="text-xs text-muted-foreground">₹{item.margin.toFixed(0)}</span>
              </div>
              <div className="flex gap-1 mt-1">
                {item.flags?.includes("HIGH_AGGREGATOR_DEPENDENCY") && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">
                    📱 Aggregator
                  </span>
                )}
                {item.flags?.includes("THEFT_RISK") && (
                  <span className="text-xs bg-red-100 text-red-700 px-1 rounded">
                    ⚠️ Risk
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        {items.length > 5 && (
          <p className="text-xs text-center text-muted-foreground">
            +{items.length - 5} more
          </p>
        )}
      </div>
      <div className="px-3 pb-3">
        <div className="bg-white/80 rounded p-2 text-xs">
          <span className="font-medium">Action: </span>
          {action}
        </div>
      </div>
    </div>
  )
}

interface BostonMatrixProps {
  restaurantId?: string
  onItemClick?: (item: BostonMatrixItem) => void
}

export function BostonMatrix({ restaurantId, onItemClick }: BostonMatrixProps) {
  const [data, setData] = useState<BostonMatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

      const response = await fetch(`/api/analytics/boston-matrix?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || "Failed to load data")
      }
    } catch (err) {
      setError("Failed to fetch Boston Matrix data")
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

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No menu data available. Upload orders to see Boston Matrix analysis.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Boston Matrix
          <span className="text-sm font-normal text-muted-foreground">
            (BCG Matrix)
          </span>
        </CardTitle>
        <CardDescription>
          Menu item classification by popularity and profitability
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">{data.stats.starCount}</p>
            <p className="text-xs text-green-600">⭐ Stars</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-700">{data.stats.plowhorseCount}</p>
            <p className="text-xs text-blue-600">🐂 Plowhorses</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-700">{data.stats.puzzleCount}</p>
            <p className="text-xs text-yellow-600">🧩 Puzzles</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-700">{data.stats.dogCount}</p>
            <p className="text-xs text-red-600">🐕 Dogs</p>
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Quadrant
            title="Stars"
            emoji="⭐"
            color="green"
            items={data.summary.stars}
            action="🔒 Lock supplier contracts"
            onItemClick={onItemClick}
          />
          <Quadrant
            title="Plowhorses"
            emoji="🐂"
            color="blue"
            items={data.summary.plowhorses}
            action="📉 Reduce portion 10% or ₹5 price increase"
            onItemClick={onItemClick}
          />
          <Quadrant
            title="Puzzles"
            emoji="🧩"
            color="yellow"
            items={data.summary.puzzles}
            action="📸 Instagram push + waiter incentives"
            onItemClick={onItemClick}
          />
          <Quadrant
            title="Dogs"
            emoji="🐕"
            color="red"
            items={data.summary.dogs}
            action="❌ Remove from menu"
            onItemClick={onItemClick}
          />
        </div>

        {/* Thresholds Info */}
        <div className="mt-4 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          <p>
            <strong>Thresholds:</strong> Median Popularity: {data.stats.medianPopularity.toFixed(1)}% |
            Median Margin: ₹{data.stats.medianMargin.toFixed(0)}
          </p>
          <p className="mt-1">
            Items above both medians are Stars. High popularity + low margin = Plowhorses.
            Low popularity + high margin = Puzzles. Low both = Dogs.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default BostonMatrix
