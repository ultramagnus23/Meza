import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Create Alert API
 * Creates alerts with severity levels
 * Supports Hindi translations for Indian market
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      restaurantId,
      type,
      severity,
      title,
      titleHindi,
      message,
      relatedStaffId,
    } = body

    // Validate required fields
    if (!restaurantId) {
      return NextResponse.json(
        { success: false, error: "restaurantId is required" },
        { status: 400 }
      )
    }
    if (!type) {
      return NextResponse.json(
        { success: false, error: "type is required (THEFT_SUSPECTED, STOCK_LOW, STOCK_EXPIRING, VOID_PATTERN, SALES_SPIKE)" },
        { status: 400 }
      )
    }
    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "title and message are required" },
        { status: 400 }
      )
    }

    // Determine severity from type if not provided
    const alertSeverity =
      severity || determineSeverityFromType(type)

    // Auto-generate Hindi title if not provided
    const hindiTitle =
      titleHindi || generateHindiTitle(type, title)

    // Create alert in database
    const alert = await prisma.alert.create({
      data: {
        restaurantId: parseInt(restaurantId),
        type,
        severity: alertSeverity,
        title,
        titleHindi: hindiTitle,
        message,
        relatedStaffId: relatedStaffId ? parseInt(relatedStaffId) : null,
        isRead: false,
      },
    })

    // Mock WhatsApp notification (in production, integrate with WhatsApp Business API)
    const whatsappMessage = formatWhatsAppMessage(alert, alertSeverity)
    const notificationSent = await sendWhatsAppNotification(
      restaurantId,
      whatsappMessage
    )

    return NextResponse.json({
      success: true,
      data: {
        alert,
        notification: {
          whatsappSent: notificationSent,
          message: whatsappMessage,
        },
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error creating alert:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

function determineSeverityFromType(type: string): string {
  const severityMap: Record<string, string> = {
    THEFT_SUSPECTED: "CRITICAL",
    STOCK_LOW: "HIGH",
    STOCK_EXPIRING: "MEDIUM",
    VOID_PATTERN: "HIGH",
    SALES_SPIKE: "LOW",
  }
  return severityMap[type] || "MEDIUM"
}

function generateHindiTitle(type: string, englishTitle: string): string {
  // Basic Hindi translations for common alert types
  const hindiPrefixes: Record<string, string> = {
    THEFT_SUSPECTED: "🚨 चोरी की संभावना:",
    STOCK_LOW: "📦 स्टॉक कम:",
    STOCK_EXPIRING: "⚠️ एक्सपायरी जल्द:",
    VOID_PATTERN: "🔴 असामान्य void:",
    SALES_SPIKE: "📈 बिक्री बढ़ी:",
  }

  return hindiPrefixes[type] || englishTitle
}

function formatWhatsAppMessage(
  alert: { type: string; title: string; titleHindi: string | null; message: string; severity: string },
  severity: string
): string {
  const emoji = {
    CRITICAL: "🔴🔴🔴",
    HIGH: "🔴",
    MEDIUM: "🟡",
    LOW: "🟢",
  }[severity] || "ℹ️"

  const lines = [
    `${emoji} *${alert.title}*`,
    "",
    alert.titleHindi ? `_${alert.titleHindi}_` : "",
    "",
    alert.message,
    "",
    `Severity: ${severity}`,
    `Type: ${alert.type}`,
    "",
    "Reply 'OK' to acknowledge",
  ]

  return lines.filter((l) => l !== "").join("\n")
}

async function sendWhatsAppNotification(
  _restaurantId: string,
  _message: string
): Promise<boolean> {
  // Mock implementation
  // In production, integrate with WhatsApp Business API
  // Example: await whatsappClient.sendMessage(phoneNumber, message)

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Return success (95% success rate simulation)
  return Math.random() > 0.05
}
