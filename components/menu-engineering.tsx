"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  TooltipProps,
} from "recharts"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/api-client"
import type { MenuEngineering as MenuEngineeringType } from "@/lib/types"

export interface MenuItem {
  name: string
  price: number
  cost: number
  sold: number
  category: string
}

interface MenuEngineeringProps {
  items?: MenuItem[]
}

const getMatrixCategory = (
  popularity: "high" | "low",
  profitability: "high" | "low"
) => {
  if (popularity === "high" && profitability === "high") return "Star"
  if (popularity === "high" && profitability === "low") return "Plowhorse"
  if (popularity === "low" && profitability === "high") return "Puzzle"
  return "Dog"
}

const COLORS = {
  Star: "#22c55e",
  Plowhorse: "#eab308",
  Puzzle: "#3b82f6",
  Dog: "#ef4444",
}

export function MenuEngineering({ items: propItems }: MenuEngineeringProps) {
  const [items, setItems] = useState<MenuItem[]>(propItems || [])
  const [loading, setLoading] = useState(!propItems || propItems.length === 0)

  useEffect(() => {
    if (!propItems || propItems.length === 0) {
      loadMenuData()
    }
  }, [])

  async function loadMenuData() {
    try {
      setLoading(true)
      const response = await api.getMenuEngineering()
      if (response.success && response.data) {
        const menuItems = response.data.map((item: MenuEngineeringType) => ({
          name: item.name,
          price: item.price,
          cost: item.cost,
          sold: item.orders,
          category: item.category,
        }))
        setItems(menuItems)
      }
    } catch (error) {
      console.error("Error loading menu data:", error)
    } finally {
      setLoading(false)
    }
  }

  const processedData = useMemo(() => {
    if (!items.length) return []

    const totalSold = items.reduce((sum, item) => sum + item.sold, 0)
    const averageSold = totalSold / items.length

    const totalMargin = items.reduce((sum, item) => sum + (item.price - item.cost), 0)
    const averageMargin = totalMargin / items.length

    return items.map((item) => {
      const margin = item.price - item.cost
      const popularity = item.sold >= averageSold ? "high" : "low"
      const profitability = margin >= averageMargin ? "high" : "low"

      return {
        ...item,
        margin,
        classification: getMatrixCategory(popularity, profitability),
      }
    })
  }, [items])

  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-bold">{data.name}</p>
          <p className="text-sm">
            Class: <span style={{ color: COLORS[data.classification as keyof typeof COLORS] }}>
              {data.classification}
            </span>
          </p>
          <p className="text-sm">Margin: ₹{data.margin.toFixed(2)}</p>
          <p className="text-sm">Sold: {data.sold}</p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No menu data available. Upload data to see menu engineering analysis.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Menu Engineering Matrix</CardTitle>
        <CardDescription>
          Analyze item performance based on profitability vs. popularity.
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid />
              <XAxis 
                type="number" 
                dataKey="margin" 
                name="Margin" 
                unit="₹"
                label={{ value: "Profitability (Margin)", position: "bottom", offset: 0 }}
              />
              <YAxis 
                type="number" 
                dataKey="sold" 
                name="Sold" 
                label={{ value: "Popularity (Qty Sold)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter name="Menu Items" data={processedData}>
                {processedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.classification as keyof typeof COLORS] || "#8884d8"} 
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex justify-center gap-4 mt-4 text-sm">
          {Object.entries(COLORS).map(([name, color]) => (
            <div key={name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
