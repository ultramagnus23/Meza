import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Demand Elasticity Analysis
 * Calculates price sensitivity for menu items based on price/quantity changes
 * Elasticity = (% change in quantity) / (% change in price)
 * 
 * - Inelastic (|e| < 1): Can raise prices
 * - Elastic (|e| > 1): Price sensitive, use promotions
 * - Unit Elastic (|e| = 1): Proportional response
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const menuItemId = searchParams.get("menuItemId")
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "90")))

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build where clause
    const whereClause: Record<string, unknown> = {}
    if (restaurantId) {
      whereClause.restaurantId = parseInt(restaurantId)
    }

    // Get menu items with price history from order items
    const menuItems = await prisma.menuItem.findMany({
      where: menuItemId ? { id: parseInt(menuItemId) } : whereClause,
      include: {
        orderItems: {
          where: {
            order: {
              timestamp: { gte: startDate },
              status: "COMPLETED",
            },
          },
          include: {
            order: true,
          },
          orderBy: {
            order: {
              timestamp: "asc",
            },
          },
        },
        baselines: {
          orderBy: {
            computedAt: "desc",
          },
          take: 1,
        },
      },
    })

    const elasticityResults = menuItems.map((item) => {
      // Group orders by week to analyze price/quantity changes
      const weeklyData = new Map<string, { totalQty: number; avgPrice: number; prices: number[] }>()

      for (const orderItem of item.orderItems) {
        const orderDate = new Date(orderItem.order.timestamp)
        // Get the start of the week (Sunday)
        const weekStart = new Date(orderDate)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        const weekKey = weekStart.toISOString().split("T")[0]

        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, { totalQty: 0, avgPrice: 0, prices: [] })
        }

        const week = weeklyData.get(weekKey)!
        week.totalQty += orderItem.quantity
        week.prices.push(orderItem.priceAtTime)
      }

      // Calculate average price for each week
      for (const [, week] of weeklyData) {
        week.avgPrice = week.prices.reduce((a, b) => a + b, 0) / week.prices.length
      }

      // Convert to array and sort by week
      const weeks = Array.from(weeklyData.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, data]) => ({
          week,
          quantity: data.totalQty,
          price: data.avgPrice,
        }))

      // Calculate elasticity using point elasticity method
      let elasticityValues: number[] = []

      for (let i = 1; i < weeks.length; i++) {
        const prev = weeks[i - 1]
        const curr = weeks[i]

        const priceChange = (curr.price - prev.price) / prev.price
        const qtyChange = (curr.quantity - prev.quantity) / prev.quantity

        // Only calculate if there's a meaningful price change
        if (Math.abs(priceChange) > 0.01) {
          const elasticity = qtyChange / priceChange
          // Filter out extreme values (likely noise)
          if (Math.abs(elasticity) < 10) {
            elasticityValues.push(elasticity)
          }
        }
      }

      // Calculate average elasticity
      const avgElasticity =
        elasticityValues.length > 0
          ? elasticityValues.reduce((a, b) => a + b, 0) / elasticityValues.length
          : 0

      // Use baseline elasticity if available
      const baseline = item.baselines[0]
      const elasticity = baseline?.priceElasticity ?? avgElasticity

      // Generate recommendation based on elasticity
      let recommendation: string
      let priceAction: string
      let confidenceLevel: "HIGH" | "MEDIUM" | "LOW"

      if (Math.abs(elasticity) < 0.5) {
        recommendation = "INELASTIC - Customers are not price sensitive"
        priceAction = "Can safely increase price by 15-20% without significant volume loss"
        confidenceLevel = elasticityValues.length >= 4 ? "HIGH" : "MEDIUM"
      } else if (Math.abs(elasticity) < 1) {
        recommendation = "MODERATELY INELASTIC - Some price sensitivity"
        priceAction = "Can increase price by 10-15% with minimal impact"
        confidenceLevel = elasticityValues.length >= 4 ? "HIGH" : "MEDIUM"
      } else if (Math.abs(elasticity) < 2) {
        recommendation = "ELASTIC - Price sensitive item"
        priceAction = "Use promotions and combos instead of price increases"
        confidenceLevel = elasticityValues.length >= 4 ? "MEDIUM" : "LOW"
      } else {
        recommendation = "HIGHLY ELASTIC - Very price sensitive"
        priceAction = "Focus on volume, avoid price increases"
        confidenceLevel = elasticityValues.length >= 4 ? "MEDIUM" : "LOW"
      }

      // Calculate potential revenue impact of price change
      const currentPrice = item.currentPrice
      const currentVolume = weeks.length > 0 ? weeks[weeks.length - 1].quantity : 0
      const proposedIncrease = 0.1 // 10% price increase
      const newPrice = currentPrice * (1 + proposedIncrease)
      const volumeChange = proposedIncrease * elasticity
      const newVolume = currentVolume * (1 + volumeChange)
      const currentRevenue = currentPrice * currentVolume
      const projectedRevenue = newPrice * newVolume
      const revenueImpact = projectedRevenue - currentRevenue

      return {
        id: item.id,
        name: item.name,
        nameHindi: item.nameHindi,
        category: item.category,
        currentPrice: item.currentPrice,
        elasticity: Math.round(elasticity * 100) / 100,
        elasticityType:
          Math.abs(elasticity) < 1
            ? "INELASTIC"
            : Math.abs(elasticity) === 1
            ? "UNIT_ELASTIC"
            : "ELASTIC",
        recommendation,
        priceAction,
        confidenceLevel,
        dataPoints: elasticityValues.length,
        priceSimulation: {
          proposedIncrease: `${proposedIncrease * 100}%`,
          currentPrice,
          newPrice: Math.round(newPrice * 100) / 100,
          currentWeeklyVolume: currentVolume,
          projectedWeeklyVolume: Math.round(newVolume),
          currentWeeklyRevenue: Math.round(currentRevenue),
          projectedWeeklyRevenue: Math.round(projectedRevenue),
          revenueImpact: Math.round(revenueImpact),
          revenueImpactPercent:
            currentRevenue > 0
              ? Math.round((revenueImpact / currentRevenue) * 100)
              : 0,
        },
        weeklyTrend: weeks.slice(-8), // Last 8 weeks
      }
    })

    // Summary statistics
    const inelasticItems = elasticityResults.filter((r) => Math.abs(r.elasticity) < 1)
    const elasticItems = elasticityResults.filter((r) => Math.abs(r.elasticity) >= 1)

    const summary = {
      totalItems: elasticityResults.length,
      inelasticCount: inelasticItems.length,
      elasticCount: elasticItems.length,
      avgElasticity:
        elasticityResults.length > 0
          ? Math.round(
              (elasticityResults.reduce((sum, r) => sum + r.elasticity, 0) /
                elasticityResults.length) *
                100
            ) / 100
          : 0,
      priceIncreaseOpportunities: inelasticItems.length,
      analysisWindow: `${days} days`,
    }

    return NextResponse.json({
      success: true,
      data: {
        items: elasticityResults,
        summary,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error calculating demand elasticity:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
