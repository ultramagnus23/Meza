import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Theft Detection Analytics
 * Detects potential theft through:
 * 1. Void/discount patterns per staff member
 * 2. Inventory variance (expected vs actual > 5%)
 * 3. Anomaly detection using statistical thresholds
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30")))

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build restaurant filter
    const restaurantFilter = restaurantId
      ? { restaurantId: parseInt(restaurantId) }
      : {}

    // 1. Fetch all voided/refunded orders
    const voidedOrders = await prisma.order.findMany({
      where: {
        ...restaurantFilter,
        timestamp: { gte: startDate },
        status: { in: ["VOIDED", "REFUNDED"] },
      },
      include: {
        server: true,
        staff: true,
        orderItems: {
          include: {
            menuItem: true,
          },
        },
      },
    })

    // 2. Get all completed orders for comparison
    const completedOrders = await prisma.order.findMany({
      where: {
        ...restaurantFilter,
        timestamp: { gte: startDate },
        status: "COMPLETED",
      },
      include: {
        server: true,
        staff: true,
      },
    })

    // 3. Calculate per-staff void metrics
    const staffMetrics = new Map<
      number,
      {
        id: number
        name: string
        role: string
        totalOrders: number
        voidCount: number
        voidAmount: number
        completedAmount: number
        voidRate: number
        avgVoidAmount: number
      }
    >()

    // Process voided orders
    for (const order of voidedOrders) {
      const staffId = order.staffId || order.serverId
      if (!staffId) continue

      const staffName =
        order.staff?.name || order.server?.name || "Unknown"
      const staffRole = order.staff?.role || "WAITER"

      if (!staffMetrics.has(staffId)) {
        staffMetrics.set(staffId, {
          id: staffId,
          name: staffName,
          role: staffRole,
          totalOrders: 0,
          voidCount: 0,
          voidAmount: 0,
          completedAmount: 0,
          voidRate: 0,
          avgVoidAmount: 0,
        })
      }

      const metrics = staffMetrics.get(staffId)!
      metrics.voidCount += 1
      metrics.voidAmount += order.totalAmount
    }

    // Process completed orders
    for (const order of completedOrders) {
      const staffId = order.staffId || order.serverId
      if (!staffId) continue

      const staffName =
        order.staff?.name || order.server?.name || "Unknown"
      const staffRole = order.staff?.role || "WAITER"

      if (!staffMetrics.has(staffId)) {
        staffMetrics.set(staffId, {
          id: staffId,
          name: staffName,
          role: staffRole,
          totalOrders: 0,
          voidCount: 0,
          voidAmount: 0,
          completedAmount: 0,
          voidRate: 0,
          avgVoidAmount: 0,
        })
      }

      const metrics = staffMetrics.get(staffId)!
      metrics.totalOrders += 1
      metrics.completedAmount += order.totalAmount
    }

    // Calculate rates and averages
    for (const [, metrics] of staffMetrics) {
      const totalOrders = metrics.totalOrders + metrics.voidCount
      metrics.totalOrders = totalOrders
      metrics.voidRate = totalOrders > 0 ? (metrics.voidCount / totalOrders) * 100 : 0
      metrics.avgVoidAmount = metrics.voidCount > 0 ? metrics.voidAmount / metrics.voidCount : 0
    }

    // Calculate peer averages for comparison
    const staffArray = Array.from(staffMetrics.values()).filter(
      (s) => s.totalOrders >= 5
    ) // Minimum orders threshold
    const avgVoidRate =
      staffArray.length > 0
        ? staffArray.reduce((sum, s) => sum + s.voidRate, 0) / staffArray.length
        : 0
    const avgVoidAmount =
      staffArray.length > 0
        ? staffArray.reduce((sum, s) => sum + s.avgVoidAmount, 0) / staffArray.length
        : 0

    // Flag staff with > 2x peer average
    const flaggedStaff = staffArray
      .filter((s) => s.voidRate > avgVoidRate * 2 || s.avgVoidAmount > avgVoidAmount * 2)
      .map((s) => {
        // Calculate suspicion score (0-100)
        const voidRateScore = Math.min(50, (s.voidRate / avgVoidRate) * 25)
        const amountScore = Math.min(50, (s.avgVoidAmount / avgVoidAmount) * 25)
        const suspicionScore = Math.round(voidRateScore + amountScore)

        return {
          ...s,
          suspicionScore,
          flags: [] as string[],
          recommendation: "",
        }
      })

    // Add flags and recommendations
    for (const staff of flaggedStaff) {
      if (staff.voidRate > avgVoidRate * 3) {
        staff.flags.push("VERY_HIGH_VOID_RATE")
      } else if (staff.voidRate > avgVoidRate * 2) {
        staff.flags.push("HIGH_VOID_RATE")
      }

      if (staff.avgVoidAmount > avgVoidAmount * 3) {
        staff.flags.push("HIGH_VALUE_VOIDS")
      }

      if (staff.suspicionScore >= 75) {
        staff.recommendation = "Immediate review required. Check CCTV footage and receipts."
      } else if (staff.suspicionScore >= 50) {
        staff.recommendation = "Schedule audit. Monitor closely for next 7 days."
      } else {
        staff.recommendation = "Continue monitoring. May be legitimate pattern."
      }
    }

    // 4. Check inventory variance if we have stock movement data
    const inventoryAlerts: Array<{
      id: number
      name: string
      category: string
      expectedStock: number
      actualStock: number
      variance: number
      variancePercent: number
      estimatedLoss: number
      severity: string
    }> = []

    // Get recent stock movements
    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        recordedAt: { gte: startDate },
        variance: { not: null },
      },
      include: {
        inventoryItem: true,
      },
    })

    // Analyze inventory variances
    for (const movement of stockMovements) {
      if (
        movement.expectedStock !== null &&
        movement.actualStock !== null &&
        movement.variance !== null
      ) {
        const variancePercent = movement.expectedStock > 0
          ? Math.abs(movement.variance / movement.expectedStock) * 100
          : 0

        // Flag if variance > 5%
        if (variancePercent > 5) {
          const estimatedLoss =
            Math.abs(movement.variance) * movement.inventoryItem.costPerUnit

          inventoryAlerts.push({
            id: movement.inventoryItem.id,
            name: movement.inventoryItem.name,
            category: movement.inventoryItem.category,
            expectedStock: movement.expectedStock,
            actualStock: movement.actualStock,
            variance: movement.variance,
            variancePercent: Math.round(variancePercent * 100) / 100,
            estimatedLoss: Math.round(estimatedLoss),
            severity: variancePercent > 15 ? "HIGH" : variancePercent > 10 ? "MEDIUM" : "LOW",
          })
        }
      }
    }

    // 5. Identify suspicious void patterns (same items voided repeatedly)
    const itemVoidCounts = new Map<string, number>()
    for (const order of voidedOrders) {
      for (const item of order.orderItems) {
        const key = item.menuItem.name
        itemVoidCounts.set(key, (itemVoidCounts.get(key) || 0) + 1)
      }
    }

    const frequentlyVoidedItems = Array.from(itemVoidCounts.entries())
      .filter(([, count]) => count >= 5)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, voidCount: count }))

    // Create alerts for critical findings
    const alerts: Array<{
      type: string
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      title: string
      titleHindi: string
      message: string
      relatedStaffId: number | null
      suspicionScore: number
    }> = []

    // Add staff alerts
    for (const staff of flaggedStaff) {
      if (staff.suspicionScore >= 50) {
        alerts.push({
          type: "VOID_PATTERN",
          severity: staff.suspicionScore >= 75 ? "CRITICAL" : "HIGH",
          title: `Unusual void pattern detected for ${staff.name}`,
          titleHindi: `${staff.name} के लिए असामान्य void पैटर्न`,
          message: `Void rate: ${staff.voidRate.toFixed(1)}% (avg: ${avgVoidRate.toFixed(1)}%). Total void amount: ₹${staff.voidAmount.toFixed(0)}`,
          relatedStaffId: staff.id,
          suspicionScore: staff.suspicionScore,
        })
      }
    }

    // Add inventory alerts
    for (const inv of inventoryAlerts) {
      if (inv.variancePercent > 10) {
        alerts.push({
          type: "THEFT_SUSPECTED",
          severity: inv.severity === "HIGH" ? "HIGH" : "MEDIUM",
          title: `Inventory variance detected: ${inv.name}`,
          titleHindi: `इन्वेंटरी अंतर: ${inv.name}`,
          message: `Expected: ${inv.expectedStock}, Actual: ${inv.actualStock}. Variance: ${inv.variancePercent}%. Estimated loss: ₹${inv.estimatedLoss}`,
          relatedStaffId: null,
          suspicionScore: Math.min(100, inv.variancePercent * 5),
        })
      }
    }

    const summary = {
      totalVoids: voidedOrders.length,
      totalVoidAmount: voidedOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      avgPeerVoidRate: Math.round(avgVoidRate * 100) / 100,
      avgPeerVoidAmount: Math.round(avgVoidAmount),
      flaggedStaffCount: flaggedStaff.length,
      inventoryAlertsCount: inventoryAlerts.length,
      analysisWindow: `${days} days`,
    }

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        flaggedStaff,
        inventoryAlerts,
        frequentlyVoidedItems,
        allStaffMetrics: staffArray,
        summary,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error in theft detection:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
