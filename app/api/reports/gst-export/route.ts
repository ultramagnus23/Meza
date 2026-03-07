import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * GST Export API
 * Exports monthly order data in GST portal format
 * Calculates 5% GST for food items
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString())
    const format = searchParams.get("format") || "json" // json, csv

    // Get date range for the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    // Build where clause
    const whereClause: Record<string, unknown> = {
      timestamp: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    }
    if (restaurantId) {
      whereClause.restaurantId = parseInt(restaurantId)
    }

    // Get all completed orders for the month
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
        restaurant: {
          select: {
            name: true,
            gstNumber: true,
          },
        },
      },
      orderBy: {
        timestamp: "asc",
      },
    })

    // GST rates
    const GST_RATE = 0.05 // 5% for restaurants without AC (non-AC)
    const GST_RATE_AC = 0.05 // 5% for AC restaurants as well (post July 2017)
    // Note: For hotels with room tariff > 7500, GST is 18%

    // Calculate GST for each order
    const gstRecords = orders.map((order, index) => {
      const subtotal = order.subtotal || order.totalAmount / (1 + GST_RATE)
      const gstAmount = order.tax || order.totalAmount - subtotal
      const cgst = gstAmount / 2 // Central GST
      const sgst = gstAmount / 2 // State GST

      return {
        sNo: index + 1,
        invoiceNumber: order.orderNumber || `INV-${order.id}`,
        invoiceDate: new Date(order.timestamp).toLocaleDateString("en-IN"),
        invoiceValue: Math.round(order.totalAmount * 100) / 100,
        placeOfSupply: "Same State", // Assuming same state for now
        reverseCharge: "N",
        applicableTaxRate: "5%",
        invoiceType: "Regular",
        taxableValue: Math.round(subtotal * 100) / 100,
        cgstRate: "2.5%",
        cgstAmount: Math.round(cgst * 100) / 100,
        sgstRate: "2.5%",
        sgstAmount: Math.round(sgst * 100) / 100,
        igstRate: "0%",
        igstAmount: 0,
        cessAmount: 0,
        channel: order.channel,
        paymentMethod: order.paymentMethod || "CASH",
      }
    })

    // Calculate totals
    const totals = {
      totalInvoices: gstRecords.length,
      totalInvoiceValue: Math.round(gstRecords.reduce((sum, r) => sum + r.invoiceValue, 0) * 100) / 100,
      totalTaxableValue: Math.round(gstRecords.reduce((sum, r) => sum + r.taxableValue, 0) * 100) / 100,
      totalCGST: Math.round(gstRecords.reduce((sum, r) => sum + r.cgstAmount, 0) * 100) / 100,
      totalSGST: Math.round(gstRecords.reduce((sum, r) => sum + r.sgstAmount, 0) * 100) / 100,
      totalIGST: 0,
      totalCess: 0,
      totalGST: 0,
    }
    totals.totalGST = totals.totalCGST + totals.totalSGST

    // Get restaurant info for header
    const restaurant = orders[0]?.restaurant || { name: "Restaurant", gstNumber: null }

    // Generate CSV if requested
    if (format === "csv") {
      const csvContent = generateCSV(gstRecords, restaurant, year, month, totals)

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="GST_${year}_${month.toString().padStart(2, "0")}.csv"`,
        },
      })
    }

    // Return JSON response
    return NextResponse.json({
      success: true,
      data: {
        header: {
          restaurantName: restaurant.name,
          gstNumber: restaurant.gstNumber || "Not Registered",
          period: `${getMonthName(month)} ${year}`,
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
          exportedAt: new Date().toISOString(),
        },
        records: gstRecords,
        totals,
        byChannel: calculateChannelBreakdown(gstRecords),
        byPaymentMethod: calculatePaymentBreakdown(gstRecords),
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error generating GST export:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

function generateCSV(
  records: Array<{
    sNo: number
    invoiceNumber: string
    invoiceDate: string
    invoiceValue: number
    placeOfSupply: string
    reverseCharge: string
    applicableTaxRate: string
    invoiceType: string
    taxableValue: number
    cgstRate: string
    cgstAmount: number
    sgstRate: string
    sgstAmount: number
    igstRate: string
    igstAmount: number
    cessAmount: number
  }>,
  restaurant: { name: string; gstNumber: string | null },
  year: number,
  month: number,
  totals: {
    totalInvoices: number
    totalInvoiceValue: number
    totalTaxableValue: number
    totalCGST: number
    totalSGST: number
    totalIGST: number
    totalCess: number
    totalGST: number
  }
): string {
  const lines: string[] = []

  // Header info
  lines.push(`"GST Return - ${getMonthName(month)} ${year}"`)
  lines.push(`"Restaurant Name","${restaurant.name}"`)
  lines.push(`"GSTIN","${restaurant.gstNumber || "Not Registered"}"`)
  lines.push("")

  // Column headers (GST portal format)
  const headers = [
    "S.No",
    "Invoice Number",
    "Invoice Date",
    "Invoice Value",
    "Place of Supply",
    "Reverse Charge",
    "Applicable Tax Rate",
    "Invoice Type",
    "Taxable Value",
    "CGST Rate",
    "CGST Amount",
    "SGST Rate",
    "SGST Amount",
    "IGST Rate",
    "IGST Amount",
    "Cess Amount",
  ]
  lines.push(headers.join(","))

  // Data rows
  for (const record of records) {
    const row = [
      record.sNo,
      `"${record.invoiceNumber}"`,
      `"${record.invoiceDate}"`,
      record.invoiceValue,
      `"${record.placeOfSupply}"`,
      record.reverseCharge,
      record.applicableTaxRate,
      record.invoiceType,
      record.taxableValue,
      record.cgstRate,
      record.cgstAmount,
      record.sgstRate,
      record.sgstAmount,
      record.igstRate,
      record.igstAmount,
      record.cessAmount,
    ]
    lines.push(row.join(","))
  }

  // Totals row
  lines.push("")
  lines.push(
    [
      "TOTAL",
      "",
      "",
      totals.totalInvoiceValue,
      "",
      "",
      "",
      "",
      totals.totalTaxableValue,
      "",
      totals.totalCGST,
      "",
      totals.totalSGST,
      "",
      totals.totalIGST,
      totals.totalCess,
    ].join(",")
  )

  lines.push("")
  lines.push(`"Total GST Payable",${totals.totalGST}`)
  lines.push(`"Total Invoices",${totals.totalInvoices}`)

  return lines.join("\n")
}

function calculateChannelBreakdown(
  records: Array<{ channel: string; invoiceValue: number; cgstAmount: number; sgstAmount: number }>
): Array<{ channel: string; invoiceCount: number; totalValue: number; totalGST: number }> {
  const breakdown = new Map<string, { count: number; value: number; gst: number }>()

  for (const record of records) {
    if (!breakdown.has(record.channel)) {
      breakdown.set(record.channel, { count: 0, value: 0, gst: 0 })
    }
    const data = breakdown.get(record.channel)!
    data.count += 1
    data.value += record.invoiceValue
    data.gst += record.cgstAmount + record.sgstAmount
  }

  return Array.from(breakdown.entries()).map(([channel, data]) => ({
    channel,
    invoiceCount: data.count,
    totalValue: Math.round(data.value * 100) / 100,
    totalGST: Math.round(data.gst * 100) / 100,
  }))
}

function calculatePaymentBreakdown(
  records: Array<{ paymentMethod: string; invoiceValue: number }>
): Array<{ paymentMethod: string; invoiceCount: number; totalValue: number }> {
  const breakdown = new Map<string, { count: number; value: number }>()

  for (const record of records) {
    const method = record.paymentMethod || "CASH"
    if (!breakdown.has(method)) {
      breakdown.set(method, { count: 0, value: 0 })
    }
    const data = breakdown.get(method)!
    data.count += 1
    data.value += record.invoiceValue
  }

  return Array.from(breakdown.entries()).map(([method, data]) => ({
    paymentMethod: method,
    invoiceCount: data.count,
    totalValue: Math.round(data.value * 100) / 100,
  }))
}

function getMonthName(month: number): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]
  return months[month - 1] || "Unknown"
}
