import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Daily Summary Report API
 * Generates a daily summary suitable for WhatsApp
 * Includes revenue, top items, waste, and action items
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const dateParam = searchParams.get("date")
    const language = searchParams.get("language") || "en" // en, hi

    // Get date range for the day
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Previous day for comparison
    const prevDayStart = new Date(startOfDay)
    prevDayStart.setDate(prevDayStart.getDate() - 1)
    const prevDayEnd = new Date(endOfDay)
    prevDayEnd.setDate(prevDayEnd.getDate() - 1)

    // Build where clause
    const whereClause: Record<string, unknown> = {
      timestamp: { gte: startOfDay, lte: endOfDay },
    }
    if (restaurantId) {
      whereClause.restaurantId = parseInt(restaurantId)
    }

    // Get today's orders
    const orders = await prisma.order.findMany({
      where: {
        ...whereClause,
        status: "COMPLETED",
      },
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
      },
    })

    // Get previous day orders for comparison
    const prevOrders = await prisma.order.findMany({
      where: {
        ...(restaurantId ? { restaurantId: parseInt(restaurantId) } : {}),
        timestamp: { gte: prevDayStart, lte: prevDayEnd },
        status: "COMPLETED",
      },
    })

    // Get voided orders
    const voidedOrders = await prisma.order.findMany({
      where: {
        ...whereClause,
        status: "VOIDED",
      },
    })

    // Get stock alerts
    const stockAlerts = await prisma.alert.findMany({
      where: {
        ...(restaurantId ? { restaurantId: parseInt(restaurantId) } : {}),
        type: { in: ["STOCK_LOW", "STOCK_EXPIRING"] },
        createdAt: { gte: startOfDay },
        isRead: false,
      },
    })

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0)
    const prevRevenue = prevOrders.reduce((sum, o) => sum + o.totalAmount, 0)
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0

    const totalOrders = orders.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Calculate by channel
    const channelBreakdown = new Map<string, { orders: number; revenue: number }>()
    for (const order of orders) {
      const channel = order.channel
      if (!channelBreakdown.has(channel)) {
        channelBreakdown.set(channel, { orders: 0, revenue: 0 })
      }
      const data = channelBreakdown.get(channel)!
      data.orders += 1
      data.revenue += order.totalAmount
    }

    // Top 5 items
    const itemSales = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const order of orders) {
      for (const item of order.orderItems) {
        const key = item.menuItem.name
        if (!itemSales.has(key)) {
          itemSales.set(key, { name: key, quantity: 0, revenue: 0 })
        }
        const data = itemSales.get(key)!
        data.quantity += item.quantity
        data.revenue += item.priceAtTime * item.quantity
      }
    }
    const topItems = Array.from(itemSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Voids summary
    const totalVoids = voidedOrders.length
    const voidAmount = voidedOrders.reduce((sum, o) => sum + o.totalAmount, 0)

    // Generate action items
    const actionItems: string[] = []
    if (revenueChange < -10) {
      actionItems.push(`📉 Revenue down ${Math.abs(revenueChange).toFixed(1)}% vs yesterday`)
    }
    if (stockAlerts.length > 0) {
      actionItems.push(`📦 ${stockAlerts.length} items need reordering`)
    }
    if (totalVoids > 3) {
      actionItems.push(`🔴 ${totalVoids} voided orders today - review needed`)
    }

    // Format for WhatsApp
    const whatsappMessage = formatWhatsAppSummary(
      {
        date: targetDate,
        totalRevenue,
        revenueChange,
        totalOrders,
        avgOrderValue,
        channelBreakdown: Array.from(channelBreakdown.entries()),
        topItems,
        totalVoids,
        voidAmount,
        stockAlerts: stockAlerts.length,
        actionItems,
      },
      language
    )

    // Structured data response
    const summary = {
      date: targetDate.toISOString().split("T")[0],
      revenue: {
        total: Math.round(totalRevenue),
        previous: Math.round(prevRevenue),
        change: Math.round(revenueChange * 10) / 10,
        trend: revenueChange >= 0 ? "UP" : "DOWN",
      },
      orders: {
        total: totalOrders,
        avgValue: Math.round(avgOrderValue),
      },
      channels: Array.from(channelBreakdown.entries()).map(([channel, data]) => ({
        channel,
        orders: data.orders,
        revenue: Math.round(data.revenue),
        percentage: Math.round((data.revenue / totalRevenue) * 100) || 0,
      })),
      topItems,
      voids: {
        count: totalVoids,
        amount: Math.round(voidAmount),
      },
      alerts: {
        stockLow: stockAlerts.length,
      },
      actionItems,
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        whatsappMessage,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error generating daily summary:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

function formatWhatsAppSummary(
  data: {
    date: Date
    totalRevenue: number
    revenueChange: number
    totalOrders: number
    avgOrderValue: number
    channelBreakdown: Array<[string, { orders: number; revenue: number }]>
    topItems: Array<{ name: string; quantity: number; revenue: number }>
    totalVoids: number
    voidAmount: number
    stockAlerts: number
    actionItems: string[]
  },
  language: string
): string {
  const isHindi = language === "hi"
  const dateStr = data.date.toLocaleDateString(isHindi ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  })

  const revenueEmoji = data.revenueChange >= 0 ? "📈" : "📉"
  const revenueSign = data.revenueChange >= 0 ? "+" : ""

  const lines: string[] = []

  if (isHindi) {
    lines.push(`📊 *दैनिक रिपोर्ट - ${dateStr}*`)
    lines.push("")
    lines.push(`💰 *कुल आय:* ₹${data.totalRevenue.toFixed(0)}`)
    lines.push(`${revenueEmoji} ${revenueSign}${data.revenueChange.toFixed(1)}% कल से`)
    lines.push("")
    lines.push(`📋 *ऑर्डर:* ${data.totalOrders}`)
    lines.push(`💵 *औसत बिल:* ₹${data.avgOrderValue.toFixed(0)}`)
  } else {
    lines.push(`📊 *Daily Report - ${dateStr}*`)
    lines.push("")
    lines.push(`💰 *Total Revenue:* ₹${data.totalRevenue.toFixed(0)}`)
    lines.push(`${revenueEmoji} ${revenueSign}${data.revenueChange.toFixed(1)}% vs yesterday`)
    lines.push("")
    lines.push(`📋 *Orders:* ${data.totalOrders}`)
    lines.push(`💵 *Avg Bill:* ₹${data.avgOrderValue.toFixed(0)}`)
  }

  // Channel breakdown
  lines.push("")
  lines.push(isHindi ? "*चैनल वार:*" : "*By Channel:*")
  for (const [channel, channelData] of data.channelBreakdown) {
    const channelEmoji =
      channel === "SWIGGY"
        ? "🟠"
        : channel === "ZOMATO"
        ? "🔴"
        : channel === "DIRECT"
        ? "🏠"
        : "📱"
    lines.push(`${channelEmoji} ${channel}: ₹${channelData.revenue.toFixed(0)} (${channelData.orders})`)
  }

  // Top items
  lines.push("")
  lines.push(isHindi ? "*🌟 टॉप आइटम:*" : "*🌟 Top Items:*")
  for (let i = 0; i < Math.min(3, data.topItems.length); i++) {
    const item = data.topItems[i]
    lines.push(`${i + 1}. ${item.name} (${item.quantity}) - ₹${item.revenue.toFixed(0)}`)
  }

  // Voids
  if (data.totalVoids > 0) {
    lines.push("")
    lines.push(isHindi ? `🔴 *Voids:* ${data.totalVoids} (₹${data.voidAmount.toFixed(0)})` : `🔴 *Voids:* ${data.totalVoids} (₹${data.voidAmount.toFixed(0)})`)
  }

  // Stock alerts
  if (data.stockAlerts > 0) {
    lines.push(isHindi ? `📦 *${data.stockAlerts} आइटम रीऑर्डर करें*` : `📦 *${data.stockAlerts} items need reorder*`)
  }

  // Action items
  if (data.actionItems.length > 0) {
    lines.push("")
    lines.push(isHindi ? "*⚡ एक्शन:*" : "*⚡ Action Items:*")
    for (const action of data.actionItems) {
      lines.push(action)
    }
  }

  lines.push("")
  lines.push(isHindi ? "_शुभ संध्या! 🙏_" : "_Have a great evening! 🙏_")

  return lines.join("\n")
}
