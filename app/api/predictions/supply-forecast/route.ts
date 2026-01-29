import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Supply Forecast API
 * Predicts inventory needs using usage rate and lead time calculations
 * Returns recommended order quantities and order-by dates
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const inventoryItemId = searchParams.get("inventoryItemId")
    const forecastDays = parseInt(searchParams.get("days") || "7")
    const leadTimeDays = parseInt(searchParams.get("leadTime") || "2")
    const safetyStockDays = parseInt(searchParams.get("safetyStock") || "3")

    // Build where clause
    const whereClause: Record<string, unknown> = {}
    if (restaurantId) {
      whereClause.restaurantId = parseInt(restaurantId)
    }
    if (inventoryItemId) {
      whereClause.id = parseInt(inventoryItemId)
    }

    // Get inventory items with their usage history
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: whereClause,
      include: {
        movements: {
          where: {
            type: "USAGE",
            recordedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
          orderBy: {
            recordedAt: "desc",
          },
        },
        supplier: true,
        ingredients: {
          include: {
            menuItem: {
              include: {
                orderItems: {
                  where: {
                    order: {
                      timestamp: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                      },
                      status: "COMPLETED",
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const forecasts = inventoryItems.map((item) => {
      // Calculate daily usage rate from movements
      let dailyUsageRate = item.usageRate

      // If no usage rate stored, calculate from movements
      if (!dailyUsageRate && item.movements.length > 0) {
        const totalUsage = item.movements.reduce(
          (sum, m) => sum + Math.abs(m.quantity),
          0
        )
        const daysWithData = Math.min(30, item.movements.length)
        dailyUsageRate = totalUsage / daysWithData
      }

      // Alternative: Calculate from menu item sales
      if (!dailyUsageRate && item.ingredients.length > 0) {
        let totalIngredientUsage = 0
        for (const ingredient of item.ingredients) {
          const menuItem = ingredient.menuItem
          const totalSales = menuItem.orderItems.reduce(
            (sum, oi) => sum + oi.quantity,
            0
          )
          const dailySales = totalSales / 30
          totalIngredientUsage += dailySales * ingredient.quantity
        }
        dailyUsageRate = totalIngredientUsage
      }

      // Default fallback
      dailyUsageRate = dailyUsageRate || 1

      // Calculate forecast
      const currentStock = item.currentStock
      const minStock = item.minStock
      const daysUntilStockout =
        dailyUsageRate > 0 ? currentStock / dailyUsageRate : 999

      // Calculate recommended order
      const safetyStock = dailyUsageRate * safetyStockDays
      const leadTimeUsage = dailyUsageRate * leadTimeDays
      const forecastUsage = dailyUsageRate * forecastDays
      const recommendedOrder =
        forecastUsage + leadTimeUsage + safetyStock - currentStock

      // Calculate order-by date
      const orderByDate = new Date()
      const reorderPoint = minStock + leadTimeUsage
      if (currentStock <= reorderPoint) {
        // Need to order now
        orderByDate.setDate(orderByDate.getDate())
      } else {
        // Days until we hit reorder point
        const daysUntilReorder = (currentStock - reorderPoint) / dailyUsageRate
        orderByDate.setDate(orderByDate.getDate() + Math.floor(daysUntilReorder))
      }

      // Urgency classification
      let urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
      let urgencyHindi: string
      if (daysUntilStockout <= leadTimeDays) {
        urgency = "CRITICAL"
        urgencyHindi = "बहुत जरूरी"
      } else if (daysUntilStockout <= leadTimeDays + safetyStockDays) {
        urgency = "HIGH"
        urgencyHindi = "जरूरी"
      } else if (currentStock <= reorderPoint * 1.5) {
        urgency = "MEDIUM"
        urgencyHindi = "जल्द करें"
      } else {
        urgency = "LOW"
        urgencyHindi = "सामान्य"
      }

      // Daily forecast for next 7 days
      const dailyForecast = []
      let runningStock = currentStock
      for (let day = 1; day <= forecastDays; day++) {
        runningStock -= dailyUsageRate
        const forecastDate = new Date()
        forecastDate.setDate(forecastDate.getDate() + day)

        dailyForecast.push({
          day,
          date: forecastDate.toISOString().split("T")[0],
          projectedStock: Math.max(0, Math.round(runningStock * 100) / 100),
          willStockout: runningStock <= 0,
          belowMinStock: runningStock < minStock,
        })
      }

      // Generate reasoning
      const reasoning = generateReasoning(
        item.name,
        currentStock,
        dailyUsageRate,
        daysUntilStockout,
        recommendedOrder,
        item.unit,
        urgency
      )

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        currentStock: Math.round(currentStock * 100) / 100,
        unit: item.unit,
        minStock: item.minStock,
        costPerUnit: item.costPerUnit,
        dailyUsageRate: Math.round(dailyUsageRate * 100) / 100,
        daysUntilStockout: Math.round(daysUntilStockout * 10) / 10,
        recommendedOrder: Math.max(0, Math.round(recommendedOrder * 100) / 100),
        orderCost: Math.round(Math.max(0, recommendedOrder) * item.costPerUnit),
        orderByDate: orderByDate.toISOString().split("T")[0],
        urgency,
        urgencyHindi,
        supplier: item.supplier
          ? {
              id: item.supplier.id,
              name: item.supplier.name,
              phone: item.supplier.phone,
              reliabilityScore: item.supplier.reliabilityScore,
            }
          : null,
        isPerishable: item.isPerishable,
        shelfLifeDays: item.shelfLifeDays,
        storageLocation: item.storageLocation,
        dailyForecast,
        reasoning,
      }
    })

    // Sort by urgency
    const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    forecasts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

    // Summary
    const criticalItems = forecasts.filter((f) => f.urgency === "CRITICAL")
    const highPriorityItems = forecasts.filter((f) => f.urgency === "HIGH")
    const totalOrderCost = forecasts.reduce((sum, f) => sum + f.orderCost, 0)

    const summary = {
      totalItems: forecasts.length,
      criticalCount: criticalItems.length,
      highPriorityCount: highPriorityItems.length,
      totalRecommendedOrderCost: totalOrderCost,
      itemsNeedingOrderToday: forecasts.filter(
        (f) => new Date(f.orderByDate) <= new Date()
      ).length,
      forecastPeriod: `${forecastDays} days`,
      leadTimeAssumed: `${leadTimeDays} days`,
      safetyStockDays,
    }

    return NextResponse.json({
      success: true,
      data: {
        forecasts,
        criticalItems,
        summary,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error in supply forecast:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

function generateReasoning(
  itemName: string,
  currentStock: number,
  dailyUsage: number,
  daysUntilStockout: number,
  recommendedOrder: number,
  unit: string,
  urgency: string
): string {
  const lines = []

  lines.push(`📦 ${itemName} Analysis:`)
  lines.push(`• Current stock: ${currentStock.toFixed(1)} ${unit}`)
  lines.push(`• Daily usage rate: ${dailyUsage.toFixed(2)} ${unit}/day`)
  lines.push(`• Days until stockout: ${daysUntilStockout.toFixed(1)} days`)

  if (urgency === "CRITICAL") {
    lines.push(
      `⚠️ CRITICAL: Stock will run out within lead time. Order immediately!`
    )
  } else if (urgency === "HIGH") {
    lines.push(`🔔 HIGH: Stock is low. Place order today to avoid stockout.`)
  }

  if (recommendedOrder > 0) {
    lines.push(
      `💡 Recommended order: ${recommendedOrder.toFixed(1)} ${unit} (includes ${3} days safety stock)`
    )
  } else {
    lines.push(`✅ No order needed at this time.`)
  }

  return lines.join("\n")
}
