import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Boston Matrix (BCG Matrix) Analysis for Menu Items
 * Classifies items as: STAR, PLOWHORSE, PUZZLE, DOG
 * Based on popularity (sales count) and profitability (margin)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30")))

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days)

    // Build where clause
    const whereClause: Record<string, unknown> = restaurantId
      ? { restaurantId: parseInt(restaurantId) }
      : {}

    // Get all menu items with their order data
    const menuItems = await prisma.menuItem.findMany({
      where: whereClause,
      include: {
        orderItems: {
          where: {
            order: {
              timestamp: { gte: thirtyDaysAgo },
              status: "COMPLETED",
            },
          },
          include: {
            order: true,
          },
        },
      },
    })

    // Get total orders in the period for popularity calculation
    const totalOrdersInPeriod = await prisma.order.count({
      where: {
        ...(restaurantId ? { restaurantId: parseInt(restaurantId) } : {}),
        timestamp: { gte: thirtyDaysAgo },
        status: "COMPLETED",
      },
    })

    // Calculate metrics for each menu item
    const itemMetrics = menuItems.map((item) => {
      const salesCount = item.orderItems.reduce((sum, oi) => sum + oi.quantity, 0)
      const revenue = item.orderItems.reduce(
        (sum, oi) => sum + oi.priceAtTime * oi.quantity,
        0
      )
      const cost = item.cost || item.currentPrice * 0.4 // Default 40% cost if not set
      const margin = item.currentPrice - cost

      // Calculate popularity as percentage of total orders
      const popularity = totalOrdersInPeriod > 0 ? (salesCount / totalOrdersInPeriod) * 100 : 0

      // Check aggregator dependency (orders from Swiggy/Zomato)
      const aggregatorOrders = item.orderItems.filter(
        (oi) => oi.order.channel === "SWIGGY" || oi.order.channel === "ZOMATO"
      ).length
      const aggregatorDependency =
        item.orderItems.length > 0
          ? (aggregatorOrders / item.orderItems.length) * 100
          : 0

      // Check theft risk (items with high void rates)
      const voidedOrders = item.orderItems.filter(
        (oi) => oi.order.status === "VOIDED"
      ).length
      const theftRisk = item.orderItems.length > 0
        ? (voidedOrders / item.orderItems.length) * 100
        : 0

      return {
        id: item.id,
        name: item.name,
        nameHindi: item.nameHindi,
        category: item.category,
        price: item.currentPrice,
        cost,
        margin,
        salesCount,
        revenue,
        popularity,
        aggregatorDependency,
        theftRisk,
        isVeg: item.isVeg,
        station: item.station,
      }
    })

    // Calculate median popularity and margin for classification thresholds
    const sortedPopularity = [...itemMetrics].sort((a, b) => a.popularity - b.popularity)
    const sortedMargin = [...itemMetrics].sort((a, b) => a.margin - b.margin)

    const medianPopularity =
      sortedPopularity.length > 0
        ? sortedPopularity[Math.floor(sortedPopularity.length / 2)].popularity
        : 0
    const medianMargin =
      sortedMargin.length > 0
        ? sortedMargin[Math.floor(sortedMargin.length / 2)].margin
        : 0

    // Classify items into Boston Matrix quadrants
    const classifiedItems = itemMetrics.map((item) => {
      let classification: "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG"
      let recommendation: string

      const isHighPopularity = item.popularity >= medianPopularity
      const isHighMargin = item.margin >= medianMargin

      if (isHighPopularity && isHighMargin) {
        classification = "STAR"
        recommendation = "Maintain quality and visibility. Lock supplier contracts."
      } else if (isHighPopularity && !isHighMargin) {
        classification = "PLOWHORSE"
        recommendation = "Reduce portion by 10% or increase price by ₹5-10."
      } else if (!isHighPopularity && isHighMargin) {
        classification = "PUZZLE"
        recommendation = "Increase visibility: Instagram push + waiter incentives."
      } else {
        classification = "DOG"
        recommendation = "Consider removing from menu or complete repositioning."
      }

      // Add Indian-specific flags
      const flags: string[] = []
      if (item.aggregatorDependency > 50) {
        flags.push("HIGH_AGGREGATOR_DEPENDENCY")
      }
      if (item.theftRisk > 5) {
        flags.push("THEFT_RISK")
      }

      return {
        ...item,
        classification,
        recommendation,
        flags,
      }
    })

    // Group by classification for summary
    const summary = {
      stars: classifiedItems.filter((i) => i.classification === "STAR"),
      plowhorses: classifiedItems.filter((i) => i.classification === "PLOWHORSE"),
      puzzles: classifiedItems.filter((i) => i.classification === "PUZZLE"),
      dogs: classifiedItems.filter((i) => i.classification === "DOG"),
    }

    const stats = {
      totalItems: classifiedItems.length,
      starCount: summary.stars.length,
      plowhorseCount: summary.plowhorses.length,
      puzzleCount: summary.puzzles.length,
      dogCount: summary.dogs.length,
      medianPopularity,
      medianMargin,
      analysisWindow: `${days} days`,
    }

    return NextResponse.json({
      success: true,
      data: {
        items: classifiedItems,
        summary,
        stats,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error calculating Boston Matrix:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
