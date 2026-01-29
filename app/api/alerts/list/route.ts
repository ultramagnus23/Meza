import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * List Alerts API
 * Fetches alerts with filtering and sorting
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const type = searchParams.get("type")
    const severity = searchParams.get("severity")
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")))

    const whereClause: Record<string, unknown> = {}
    if (restaurantId) {
      whereClause.restaurantId = parseInt(restaurantId)
    }
    if (type) {
      whereClause.type = type
    }
    if (severity) {
      whereClause.severity = severity
    }
    if (unreadOnly) {
      whereClause.isRead = false
    }

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      orderBy: [
        { severity: "desc" }, // CRITICAL first
        { createdAt: "desc" },
      ],
      take: limit,
    })

    // Group by severity for summary
    const summary = {
      total: alerts.length,
      unread: alerts.filter((a) => !a.isRead).length,
      bySeverity: {
        critical: alerts.filter((a) => a.severity === "CRITICAL").length,
        high: alerts.filter((a) => a.severity === "HIGH").length,
        medium: alerts.filter((a) => a.severity === "MEDIUM").length,
        low: alerts.filter((a) => a.severity === "LOW").length,
      },
      byType: Object.fromEntries(
        [...new Set(alerts.map((a) => a.type))].map((type) => [
          type,
          alerts.filter((a) => a.type === type).length,
        ])
      ),
    }

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error fetching alerts:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
