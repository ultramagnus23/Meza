import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Aggregator Reconciliation API
 * Compares POS orders with aggregator settlement reports
 * Finds discrepancies: missing payments, wrong commissions
 * Auto-generates dispute information
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      restaurantId,
      channel, // SWIGGY, ZOMATO, UBER_EATS
      startDate,
      endDate,
      settlementData, // Array of {orderId, amount, commission, status}
    } = body

    if (!channel) {
      return NextResponse.json(
        { success: false, error: "channel is required (SWIGGY, ZOMATO, UBER_EATS)" },
        { status: 400 }
      )
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    // Build where clause
    const whereClause: Record<string, unknown> = {
      channel: channel.toUpperCase(),
      timestamp: { gte: start, lte: end },
    }
    if (restaurantId) {
      whereClause.restaurantId = parseInt(restaurantId)
    }

    // Get POS orders for the channel
    const posOrders = await prisma.order.findMany({
      where: whereClause,
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
      },
    })

    // Expected commission rates by channel
    const commissionRates: Record<string, number> = {
      SWIGGY: 0.25, // 25%
      ZOMATO: 0.25, // 25%
      UBER_EATS: 0.30, // 30%
      DOORDASH: 0.30, // 30%
    }

    const expectedCommissionRate = commissionRates[channel.toUpperCase()] || 0.25

    // If settlement data is provided, match with POS orders
    const discrepancies: Array<{
      type: "MISSING_PAYMENT" | "WRONG_COMMISSION" | "WRONG_AMOUNT" | "UNKNOWN_ORDER"
      orderId: string
      posAmount: number | null
      settlementAmount: number | null
      expectedCommission: number | null
      actualCommission: number | null
      discrepancyAmount: number
      details: string
    }> = []

    let totalPOSRevenue = 0
    let totalSettlementReceived = 0
    let totalExpectedSettlement = 0
    let totalCommissionPaid = 0
    let totalExpectedCommission = 0

    // Create a map of settlement data by order ID
    const settlementMap = new Map<string, { amount: number; commission: number; status: string }>()
    if (settlementData && Array.isArray(settlementData)) {
      for (const settlement of settlementData) {
        settlementMap.set(settlement.orderId, {
          amount: settlement.amount,
          commission: settlement.commission,
          status: settlement.status,
        })
      }
    }

    // Check each POS order against settlement data
    for (const order of posOrders) {
      const orderId = order.externalId || order.id.toString()
      totalPOSRevenue += order.totalAmount

      const expectedCommission = order.totalAmount * expectedCommissionRate
      const expectedSettlement = order.totalAmount - expectedCommission
      totalExpectedSettlement += expectedSettlement
      totalExpectedCommission += expectedCommission

      const settlement = settlementMap.get(orderId)

      if (!settlement) {
        // Missing from settlement report
        discrepancies.push({
          type: "MISSING_PAYMENT",
          orderId,
          posAmount: order.totalAmount,
          settlementAmount: null,
          expectedCommission,
          actualCommission: null,
          discrepancyAmount: order.totalAmount - expectedCommission,
          details: `Order ₹${order.totalAmount.toFixed(0)} not found in settlement report. Expected payout: ₹${expectedSettlement.toFixed(0)}`,
        })
      } else {
        totalSettlementReceived += settlement.amount
        totalCommissionPaid += settlement.commission

        // Check for amount mismatch
        const amountDiff = Math.abs(order.totalAmount - (settlement.amount + settlement.commission))
        if (amountDiff > 1) {
          // Allow ₹1 rounding difference
          discrepancies.push({
            type: "WRONG_AMOUNT",
            orderId,
            posAmount: order.totalAmount,
            settlementAmount: settlement.amount,
            expectedCommission,
            actualCommission: settlement.commission,
            discrepancyAmount: amountDiff,
            details: `POS shows ₹${order.totalAmount.toFixed(0)}, settlement shows ₹${(settlement.amount + settlement.commission).toFixed(0)}. Difference: ₹${amountDiff.toFixed(0)}`,
          })
        }

        // Check for wrong commission
        const commissionDiff = settlement.commission - expectedCommission
        if (Math.abs(commissionDiff) > 5) {
          // Allow ₹5 difference
          discrepancies.push({
            type: "WRONG_COMMISSION",
            orderId,
            posAmount: order.totalAmount,
            settlementAmount: settlement.amount,
            expectedCommission,
            actualCommission: settlement.commission,
            discrepancyAmount: Math.abs(commissionDiff),
            details: `Commission charged: ₹${settlement.commission.toFixed(0)} (${((settlement.commission / order.totalAmount) * 100).toFixed(1)}%). Expected: ₹${expectedCommission.toFixed(0)} (${(expectedCommissionRate * 100).toFixed(0)}%). Overcharge: ₹${commissionDiff.toFixed(0)}`,
          })
        }

        // Remove from map to track unknown orders
        settlementMap.delete(orderId)
      }
    }

    // Check for orders in settlement but not in POS
    for (const [orderId, settlement] of settlementMap) {
      discrepancies.push({
        type: "UNKNOWN_ORDER",
        orderId,
        posAmount: null,
        settlementAmount: settlement.amount,
        expectedCommission: null,
        actualCommission: settlement.commission,
        discrepancyAmount: settlement.amount,
        details: `Order ${orderId} found in settlement but not in POS. Settlement amount: ₹${settlement.amount.toFixed(0)}`,
      })
    }

    // Calculate totals
    const totalVariance = totalPOSRevenue - totalSettlementReceived - totalCommissionPaid
    const commissionVariance = totalCommissionPaid - totalExpectedCommission

    // Generate dispute summary
    const disputeItems = discrepancies.filter(
      (d) => d.type === "MISSING_PAYMENT" || d.type === "WRONG_COMMISSION"
    )
    const totalDisputeAmount = disputeItems.reduce((sum, d) => sum + d.discrepancyAmount, 0)

    // Auto-generate dispute email content
    const disputeEmail = generateDisputeEmail(
      channel,
      start,
      end,
      disputeItems,
      totalDisputeAmount
    )

    const summary = {
      channel,
      period: {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      },
      totalPOSOrders: posOrders.length,
      totalPOSRevenue: Math.round(totalPOSRevenue),
      totalSettlementReceived: Math.round(totalSettlementReceived),
      totalCommissionPaid: Math.round(totalCommissionPaid),
      expectedCommissionRate: `${expectedCommissionRate * 100}%`,
      totalExpectedCommission: Math.round(totalExpectedCommission),
      commissionVariance: Math.round(commissionVariance),
      totalVariance: Math.round(totalVariance),
      discrepancyCount: discrepancies.length,
      totalDisputeAmount: Math.round(totalDisputeAmount),
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        discrepancies,
        disputeEmail,
        recommendations: generateRecommendations(discrepancies, commissionVariance),
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error in aggregator reconciliation:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

function generateDisputeEmail(
  channel: string,
  startDate: Date,
  endDate: Date,
  disputeItems: Array<{
    type: string
    orderId: string
    discrepancyAmount: number
    details: string
  }>,
  totalAmount: number
): string {
  if (disputeItems.length === 0) {
    return ""
  }

  const lines = [
    `Subject: Payment Discrepancy Report - ${channel} - ₹${totalAmount.toFixed(0)}`,
    "",
    `Dear ${channel} Partner Support,`,
    "",
    `We have identified the following discrepancies in our settlement for the period ${startDate.toLocaleDateString("en-IN")} to ${endDate.toLocaleDateString("en-IN")}:`,
    "",
    "DISCREPANCY DETAILS:",
    "--------------------",
  ]

  for (const item of disputeItems.slice(0, 10)) {
    // Show first 10
    lines.push(`• Order ${item.orderId}: ₹${item.discrepancyAmount.toFixed(0)} - ${item.type}`)
    lines.push(`  Details: ${item.details}`)
    lines.push("")
  }

  if (disputeItems.length > 10) {
    lines.push(`... and ${disputeItems.length - 10} more discrepancies`)
    lines.push("")
  }

  lines.push(`TOTAL DISCREPANCY: ₹${totalAmount.toFixed(0)}`)
  lines.push("")
  lines.push("We request immediate investigation and settlement of the above amount.")
  lines.push("")
  lines.push("Regards,")
  lines.push("Restaurant Management")

  return lines.join("\n")
}

function generateRecommendations(
  discrepancies: Array<{ type: string }>,
  commissionVariance: number
): string[] {
  const recommendations: string[] = []

  const missingPayments = discrepancies.filter((d) => d.type === "MISSING_PAYMENT")
  if (missingPayments.length > 0) {
    recommendations.push(
      `${missingPayments.length} orders missing from settlement. File dispute with aggregator immediately.`
    )
  }

  const wrongCommissions = discrepancies.filter((d) => d.type === "WRONG_COMMISSION")
  if (wrongCommissions.length > 0) {
    recommendations.push(
      `${wrongCommissions.length} orders with incorrect commission. Review contract terms.`
    )
  }

  if (commissionVariance > 1000) {
    recommendations.push(
      `Commission overcharge of ₹${commissionVariance.toFixed(0)}. Negotiate with aggregator or consider direct delivery.`
    )
  }

  if (discrepancies.length === 0) {
    recommendations.push("All orders reconciled successfully. No action needed.")
  }

  return recommendations
}
