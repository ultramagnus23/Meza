import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Peak Hours Analysis
 * Groups orders by hour and day-of-week
 * Calculates average revenue per hour
 * Identifies top 20% hours as peak
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30")))

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build where clause
    const whereClause: Record<string, unknown> = {
      timestamp: { gte: startDate },
      status: "COMPLETED",
    }
    if (restaurantId) {
      whereClause.restaurantId = parseInt(restaurantId)
    }

    // Get all orders in the period
    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        timestamp: true,
        totalAmount: true,
        channel: true,
      },
    })

    // Group by hour
    const hourlyData = new Map<
      number,
      {
        hour: number
        totalOrders: number
        totalRevenue: number
        avgOrderValue: number
        ordersByDay: Map<number, number>
        revenueByDay: Map<number, number>
      }
    >()

    // Initialize all 24 hours
    for (let h = 0; h < 24; h++) {
      hourlyData.set(h, {
        hour: h,
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        ordersByDay: new Map(),
        revenueByDay: new Map(),
      })
    }

    // Process orders
    for (const order of orders) {
      const orderDate = new Date(order.timestamp)
      const hour = orderDate.getHours()
      const dayOfWeek = orderDate.getDay() // 0 = Sunday, 6 = Saturday

      const hourData = hourlyData.get(hour)!
      hourData.totalOrders += 1
      hourData.totalRevenue += order.totalAmount

      // Track by day of week
      hourData.ordersByDay.set(
        dayOfWeek,
        (hourData.ordersByDay.get(dayOfWeek) || 0) + 1
      )
      hourData.revenueByDay.set(
        dayOfWeek,
        (hourData.revenueByDay.get(dayOfWeek) || 0) + order.totalAmount
      )
    }

    // Calculate averages and convert to array
    const hourlyStats = Array.from(hourlyData.values()).map((h) => {
      const avgOrderValue = h.totalOrders > 0 ? h.totalRevenue / h.totalOrders : 0
      const avgRevenuePerHour = h.totalRevenue / days

      // Calculate day-of-week breakdown
      const dayOfWeekStats = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ].map((dayName, idx) => ({
        day: dayName,
        orders: h.ordersByDay.get(idx) || 0,
        revenue: h.revenueByDay.get(idx) || 0,
      }))

      return {
        hour: h.hour,
        hourLabel: formatHourLabel(h.hour),
        totalOrders: h.totalOrders,
        totalRevenue: Math.round(h.totalRevenue),
        avgOrderValue: Math.round(avgOrderValue),
        avgRevenuePerHour: Math.round(avgRevenuePerHour),
        dayOfWeekStats,
      }
    })

    // Sort by revenue to identify peak hours
    const sortedByRevenue = [...hourlyStats].sort(
      (a, b) => b.avgRevenuePerHour - a.avgRevenuePerHour
    )

    // Top 20% hours are peak
    const peakThreshold = Math.ceil(24 * 0.2) // 5 hours
    const peakHours = sortedByRevenue.slice(0, peakThreshold).map((h) => h.hour)

    // Classify each hour
    const classifiedHours = hourlyStats.map((h) => ({
      ...h,
      isPeak: peakHours.includes(h.hour),
      classification: classifyHour(h.hour, peakHours),
    }))

    // Group by day part
    const dayParts = {
      breakfast: classifiedHours.filter((h) => h.hour >= 6 && h.hour < 11),
      lunch: classifiedHours.filter((h) => h.hour >= 11 && h.hour < 15),
      afternoon: classifiedHours.filter((h) => h.hour >= 15 && h.hour < 18),
      dinner: classifiedHours.filter((h) => h.hour >= 18 && h.hour < 22),
      lateNight: classifiedHours.filter((h) => h.hour >= 22 || h.hour < 6),
    }

    // Calculate day part summaries
    const dayPartSummary = Object.entries(dayParts).map(([part, hours]) => ({
      dayPart: part,
      totalOrders: hours.reduce((sum, h) => sum + h.totalOrders, 0),
      totalRevenue: hours.reduce((sum, h) => sum + h.totalRevenue, 0),
      avgRevenuePerHour:
        hours.length > 0
          ? Math.round(
              hours.reduce((sum, h) => sum + h.avgRevenuePerHour, 0) / hours.length
            )
          : 0,
      peakHoursCount: hours.filter((h) => h.isPeak).length,
    }))

    // Create time series data for charts
    const timeSeries = classifiedHours.map((h) => ({
      hour: h.hour,
      label: h.hourLabel,
      orders: h.totalOrders,
      revenue: h.totalRevenue,
      avgRevenue: h.avgRevenuePerHour,
      isPeak: h.isPeak,
    }))

    // Day of week heatmap data
    const heatmapData: Array<{ hour: number; day: number; value: number }> = []
    for (const h of classifiedHours) {
      for (let day = 0; day < 7; day++) {
        heatmapData.push({
          hour: h.hour,
          day,
          value: h.dayOfWeekStats[day].revenue,
        })
      }
    }

    const summary = {
      totalOrders: orders.length,
      totalRevenue: Math.round(orders.reduce((sum, o) => sum + o.totalAmount, 0)),
      peakHours: peakHours.map((h) => formatHourLabel(h)),
      busiestHour: sortedByRevenue[0]
        ? {
            hour: sortedByRevenue[0].hour,
            label: formatHourLabel(sortedByRevenue[0].hour),
            avgRevenue: sortedByRevenue[0].avgRevenuePerHour,
          }
        : null,
      slowestHour:
        sortedByRevenue.length > 0
          ? {
              hour: sortedByRevenue[sortedByRevenue.length - 1].hour,
              label: formatHourLabel(sortedByRevenue[sortedByRevenue.length - 1].hour),
              avgRevenue: sortedByRevenue[sortedByRevenue.length - 1].avgRevenuePerHour,
            }
          : null,
      analysisWindow: `${days} days`,
    }

    // Recommendations
    const recommendations: string[] = []

    // Check if dinner is significantly busier than lunch
    const lunchRevenue = dayPartSummary.find((d) => d.dayPart === "lunch")?.totalRevenue || 0
    const dinnerRevenue = dayPartSummary.find((d) => d.dayPart === "dinner")?.totalRevenue || 0

    if (dinnerRevenue > lunchRevenue * 2) {
      recommendations.push(
        "Consider lunch specials or happy hour deals to boost daytime traffic."
      )
    }

    // Check for capacity during peak
    const peakHoursData = classifiedHours.filter((h) => h.isPeak)
    const avgPeakOrders = peakHoursData.reduce((sum, h) => sum + h.totalOrders, 0) / (peakHoursData.length || 1)
    
    if (avgPeakOrders > 50) {
      recommendations.push(
        "High peak hour volume detected. Consider reservation limits or additional staff."
      )
    }

    // Check for underutilized afternoon
    const afternoonData = dayPartSummary.find((d) => d.dayPart === "afternoon")
    if (afternoonData && afternoonData.avgRevenuePerHour < summary.totalRevenue / 24 / 2) {
      recommendations.push(
        "Afternoon shows low activity. Consider tea-time specials or work-from-cafe deals."
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        hourlyStats: classifiedHours,
        dayPartSummary,
        timeSeries,
        heatmapData,
        summary,
        recommendations,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error in peak hours analysis:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:00 ${period}`
}

function classifyHour(
  hour: number,
  peakHours: number[]
): "PEAK" | "NORMAL" | "OFF_PEAK" {
  if (peakHours.includes(hour)) return "PEAK"
  
  // Check if adjacent to peak
  const isNearPeak = peakHours.some(
    (peak) => Math.abs(peak - hour) <= 1 || (peak === 23 && hour === 0) || (peak === 0 && hour === 23)
  )
  
  return isNearPeak ? "NORMAL" : "OFF_PEAK"
}
