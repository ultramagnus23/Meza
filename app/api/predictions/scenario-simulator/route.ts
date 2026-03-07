import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Scenario Simulator API
 * Simulates the impact of price changes, menu changes, etc.
 * Uses elasticity data to predict volume changes
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      restaurantId,
      menuItemId,
      action,
      newPrice,
      priceChangePercent,
      volumeChangePercent,
      costChangePercent,
    } = body

    // Validate input
    if (!menuItemId && action !== "BULK_PRICE_CHANGE") {
      return NextResponse.json(
        { success: false, error: "menuItemId is required" },
        { status: 400 }
      )
    }

    if (!action) {
      return NextResponse.json(
        { success: false, error: "action is required (PRICE_CHANGE, REMOVE_ITEM, ADD_COMBO, BULK_PRICE_CHANGE)" },
        { status: 400 }
      )
    }

    // Get historical data for the item(s)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    if (action === "PRICE_CHANGE") {
      return await simulatePriceChange(
        parseInt(menuItemId),
        newPrice,
        priceChangePercent,
        thirtyDaysAgo
      )
    } else if (action === "REMOVE_ITEM") {
      return await simulateRemoveItem(parseInt(menuItemId), thirtyDaysAgo)
    } else if (action === "COST_CHANGE") {
      return await simulateCostChange(
        parseInt(menuItemId),
        costChangePercent,
        thirtyDaysAgo
      )
    } else if (action === "VOLUME_CHANGE") {
      return await simulateVolumeChange(
        parseInt(menuItemId),
        volumeChangePercent,
        thirtyDaysAgo
      )
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      )
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error in scenario simulator:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

async function simulatePriceChange(
  menuItemId: number,
  newPrice: number | undefined,
  priceChangePercent: number | undefined,
  startDate: Date
) {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: {
      baselines: {
        orderBy: { computedAt: "desc" },
        take: 1,
      },
      orderItems: {
        where: {
          order: {
            timestamp: { gte: startDate },
            status: "COMPLETED",
          },
        },
      },
    },
  })

  if (!menuItem) {
    return NextResponse.json(
      { success: false, error: "Menu item not found" },
      { status: 404 }
    )
  }

  const currentPrice = menuItem.currentPrice
  const cost = menuItem.cost || currentPrice * 0.4

  // Calculate new price
  let targetPrice: number
  if (newPrice) {
    targetPrice = newPrice
  } else if (priceChangePercent) {
    targetPrice = currentPrice * (1 + priceChangePercent / 100)
  } else {
    return NextResponse.json(
      { success: false, error: "newPrice or priceChangePercent required" },
      { status: 400 }
    )
  }

  const priceChange = targetPrice - currentPrice
  const priceChangePct = (priceChange / currentPrice) * 100

  // Get elasticity from baseline or estimate
  const baseline = menuItem.baselines[0]
  let elasticity = baseline?.priceElasticity || -1.2 // Default estimate

  // Calculate volume impact
  // Volume change = Elasticity * Price change %
  const volumeChangePct = elasticity * priceChangePct
  const currentVolume = menuItem.orderItems.reduce((sum, oi) => sum + oi.quantity, 0)
  const dailyVolume = currentVolume / 30
  const newDailyVolume = dailyVolume * (1 + volumeChangePct / 100)

  // Revenue calculations
  const currentDailyRevenue = dailyVolume * currentPrice
  const newDailyRevenue = newDailyVolume * targetPrice

  // Profit calculations
  const currentMargin = currentPrice - cost
  const newMargin = targetPrice - cost
  const currentDailyProfit = dailyVolume * currentMargin
  const newDailyProfit = newDailyVolume * newMargin

  // Monthly projections
  const currentMonthlyRevenue = currentDailyRevenue * 30
  const newMonthlyRevenue = newDailyRevenue * 30
  const currentMonthlyProfit = currentDailyProfit * 30
  const newMonthlyProfit = newDailyProfit * 30

  const revenueImpact = newMonthlyRevenue - currentMonthlyRevenue
  const profitImpact = newMonthlyProfit - currentMonthlyProfit

  // Sensitivity analysis
  const sensitivityScenarios = [-0.5, 0, 0.5].map((elasticityAdjust) => {
    const adjElasticity = elasticity + elasticityAdjust
    const adjVolumeChange = adjElasticity * priceChangePct
    const adjNewVolume = dailyVolume * (1 + adjVolumeChange / 100)
    const adjNewProfit = adjNewVolume * newMargin * 30

    return {
      elasticity: adjElasticity,
      volumeChange: `${adjVolumeChange.toFixed(1)}%`,
      monthlyProfit: Math.round(adjNewProfit),
      profitImpact: Math.round(adjNewProfit - currentMonthlyProfit),
    }
  })

  // Generate recommendation
  let recommendation: string
  let riskLevel: "LOW" | "MEDIUM" | "HIGH"

  if (profitImpact > 0 && volumeChangePct > -20) {
    recommendation = `Price increase recommended. Expected profit gain of ₹${Math.round(profitImpact)}/month with acceptable volume loss.`
    riskLevel = "LOW"
  } else if (profitImpact > 0 && volumeChangePct <= -20) {
    recommendation = `Price increase may be risky. High volume loss expected (${volumeChangePct.toFixed(1)}%). Consider smaller increase.`
    riskLevel = "MEDIUM"
  } else {
    recommendation = `Price change not recommended. Expected profit loss of ₹${Math.abs(Math.round(profitImpact))}/month.`
    riskLevel = "HIGH"
  }

  return NextResponse.json({
    success: true,
    data: {
      scenario: {
        action: "PRICE_CHANGE",
        itemId: menuItem.id,
        itemName: menuItem.name,
        currentPrice,
        newPrice: Math.round(targetPrice * 100) / 100,
        priceChange: Math.round(priceChange * 100) / 100,
        priceChangePct: Math.round(priceChangePct * 10) / 10,
      },
      projections: {
        elasticity,
        volumeChangePct: Math.round(volumeChangePct * 10) / 10,
        current: {
          dailyVolume: Math.round(dailyVolume),
          dailyRevenue: Math.round(currentDailyRevenue),
          dailyProfit: Math.round(currentDailyProfit),
          monthlyRevenue: Math.round(currentMonthlyRevenue),
          monthlyProfit: Math.round(currentMonthlyProfit),
        },
        projected: {
          dailyVolume: Math.round(newDailyVolume),
          dailyRevenue: Math.round(newDailyRevenue),
          dailyProfit: Math.round(newDailyProfit),
          monthlyRevenue: Math.round(newMonthlyRevenue),
          monthlyProfit: Math.round(newMonthlyProfit),
        },
        impact: {
          revenueChange: Math.round(revenueImpact),
          revenueChangePct: Math.round((revenueImpact / currentMonthlyRevenue) * 100 * 10) / 10,
          profitChange: Math.round(profitImpact),
          profitChangePct: Math.round((profitImpact / currentMonthlyProfit) * 100 * 10) / 10,
        },
      },
      sensitivityAnalysis: sensitivityScenarios,
      recommendation,
      riskLevel,
      assumptions: [
        `Elasticity of ${elasticity.toFixed(2)} used (${baseline ? "from historical data" : "industry estimate"})`,
        "Linear demand curve assumed",
        "No competitor response factored",
        "Seasonality not adjusted",
        "30-day projection period",
      ],
    },
  })
}

async function simulateRemoveItem(menuItemId: number, startDate: Date) {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: {
      orderItems: {
        where: {
          order: {
            timestamp: { gte: startDate },
            status: "COMPLETED",
          },
        },
      },
    },
  })

  if (!menuItem) {
    return NextResponse.json(
      { success: false, error: "Menu item not found" },
      { status: 404 }
    )
  }

  const currentPrice = menuItem.currentPrice
  const cost = menuItem.cost || currentPrice * 0.4
  const margin = currentPrice - cost

  const totalVolume = menuItem.orderItems.reduce((sum, oi) => sum + oi.quantity, 0)
  const dailyVolume = totalVolume / 30

  const monthlyRevenue = dailyVolume * currentPrice * 30
  const monthlyProfit = dailyVolume * margin * 30

  // Estimate substitution (30% of orders will substitute to another item)
  const substitutionRate = 0.3
  const avgMargin = margin // Assume similar margin for substitute
  const recoveredProfit = monthlyProfit * substitutionRate

  const netProfitLoss = monthlyProfit - recoveredProfit

  // Calculate kitchen capacity freed
  const prepTime = menuItem.preparationTime || 10
  const capacityFreed = dailyVolume * prepTime * 30 // minutes per month

  let recommendation: string
  if (netProfitLoss < 5000 && capacityFreed > 1000) {
    recommendation = `Remove recommended. Low margin item (₹${margin.toFixed(0)}) with high prep time. Kitchen capacity gain justifies removal.`
  } else if (netProfitLoss > 20000) {
    recommendation = `Do not remove. High profit contributor despite classification. Consider repositioning instead.`
  } else {
    recommendation = `Marginal item. Consider seasonal rotation or limited availability.`
  }

  return NextResponse.json({
    success: true,
    data: {
      scenario: {
        action: "REMOVE_ITEM",
        itemId: menuItem.id,
        itemName: menuItem.name,
        currentPrice,
        margin,
      },
      projections: {
        current: {
          dailyVolume: Math.round(dailyVolume),
          monthlyRevenue: Math.round(monthlyRevenue),
          monthlyProfit: Math.round(monthlyProfit),
        },
        afterRemoval: {
          revenueLost: Math.round(monthlyRevenue),
          profitLost: Math.round(monthlyProfit),
          substitutionRecovery: Math.round(recoveredProfit),
          netProfitLoss: Math.round(netProfitLoss),
        },
        operationalGains: {
          monthlyPrepTimeFreed: `${Math.round(capacityFreed)} minutes`,
          equivalentOrders: Math.round(capacityFreed / 15), // Assuming 15 min avg prep
        },
      },
      recommendation,
      assumptions: [
        "30% of customers will substitute to another item",
        "Substitute items have similar margin",
        `Prep time: ${prepTime} minutes`,
        "No negative brand impact assumed",
      ],
    },
  })
}

async function simulateCostChange(
  menuItemId: number,
  costChangePercent: number,
  startDate: Date
) {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: {
      orderItems: {
        where: {
          order: {
            timestamp: { gte: startDate },
            status: "COMPLETED",
          },
        },
      },
    },
  })

  if (!menuItem) {
    return NextResponse.json(
      { success: false, error: "Menu item not found" },
      { status: 404 }
    )
  }

  const currentPrice = menuItem.currentPrice
  const currentCost = menuItem.cost || currentPrice * 0.4
  const newCost = currentCost * (1 + costChangePercent / 100)

  const currentMargin = currentPrice - currentCost
  const newMargin = currentPrice - newCost

  const totalVolume = menuItem.orderItems.reduce((sum, oi) => sum + oi.quantity, 0)
  const dailyVolume = totalVolume / 30

  const currentMonthlyProfit = dailyVolume * currentMargin * 30
  const newMonthlyProfit = dailyVolume * newMargin * 30
  const profitImpact = newMonthlyProfit - currentMonthlyProfit

  // Suggest price adjustment to maintain margin
  const priceThatMaintainsMargin = newCost + currentMargin
  const suggestedPriceIncrease = priceThatMaintainsMargin - currentPrice

  let recommendation: string
  if (costChangePercent > 0 && profitImpact < -5000) {
    recommendation = `Significant margin erosion. Consider price increase of ₹${suggestedPriceIncrease.toFixed(0)} to maintain profitability.`
  } else if (costChangePercent < 0) {
    recommendation = `Cost reduction detected. Consider promotional pricing to drive volume, or retain margin improvement.`
  } else {
    recommendation = `Manageable cost change. Monitor and review in 30 days.`
  }

  return NextResponse.json({
    success: true,
    data: {
      scenario: {
        action: "COST_CHANGE",
        itemId: menuItem.id,
        itemName: menuItem.name,
        currentCost,
        newCost: Math.round(newCost * 100) / 100,
        costChangePct: costChangePercent,
      },
      projections: {
        currentMargin,
        newMargin: Math.round(newMargin * 100) / 100,
        marginChange: Math.round((newMargin - currentMargin) * 100) / 100,
        currentMonthlyProfit: Math.round(currentMonthlyProfit),
        newMonthlyProfit: Math.round(newMonthlyProfit),
        profitImpact: Math.round(profitImpact),
        priceThatMaintainsMargin: Math.round(priceThatMaintainsMargin),
        suggestedPriceIncrease: Math.round(suggestedPriceIncrease),
      },
      recommendation,
    },
  })
}

async function simulateVolumeChange(
  menuItemId: number,
  volumeChangePercent: number,
  startDate: Date
) {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: {
      orderItems: {
        where: {
          order: {
            timestamp: { gte: startDate },
            status: "COMPLETED",
          },
        },
      },
    },
  })

  if (!menuItem) {
    return NextResponse.json(
      { success: false, error: "Menu item not found" },
      { status: 404 }
    )
  }

  const currentPrice = menuItem.currentPrice
  const cost = menuItem.cost || currentPrice * 0.4
  const margin = currentPrice - cost

  const totalVolume = menuItem.orderItems.reduce((sum, oi) => sum + oi.quantity, 0)
  const dailyVolume = totalVolume / 30
  const newDailyVolume = dailyVolume * (1 + volumeChangePercent / 100)

  const currentMonthlyRevenue = dailyVolume * currentPrice * 30
  const newMonthlyRevenue = newDailyVolume * currentPrice * 30

  const currentMonthlyProfit = dailyVolume * margin * 30
  const newMonthlyProfit = newDailyVolume * margin * 30

  return NextResponse.json({
    success: true,
    data: {
      scenario: {
        action: "VOLUME_CHANGE",
        itemId: menuItem.id,
        itemName: menuItem.name,
        volumeChangePct: volumeChangePercent,
      },
      projections: {
        current: {
          dailyVolume: Math.round(dailyVolume),
          monthlyRevenue: Math.round(currentMonthlyRevenue),
          monthlyProfit: Math.round(currentMonthlyProfit),
        },
        projected: {
          dailyVolume: Math.round(newDailyVolume),
          monthlyRevenue: Math.round(newMonthlyRevenue),
          monthlyProfit: Math.round(newMonthlyProfit),
        },
        impact: {
          revenueChange: Math.round(newMonthlyRevenue - currentMonthlyRevenue),
          profitChange: Math.round(newMonthlyProfit - currentMonthlyProfit),
        },
      },
    },
  })
}
