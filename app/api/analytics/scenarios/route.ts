import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { priceChangePct } = await req.json();
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ result: null });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: { restaurantId: restaurant.id, orderedAt: { gte: thirtyDaysAgo } },
    });

    const baseRevenue = orders.reduce((sum, o) => sum + o.total, 0) / 30; // daily avg

    // Simple price elasticity model: -0.5 elasticity (10% price increase → 5% quantity decrease)
    const elasticity = -0.5;
    const priceFactor = 1 + priceChangePct / 100;
    const quantityFactor = 1 + (elasticity * priceChangePct) / 100;
    const projectedRevenue = baseRevenue * priceFactor * quantityFactor;
    const revenueChange = projectedRevenue - baseRevenue;
    const revenueChangePct = baseRevenue > 0 ? (revenueChange / baseRevenue) * 100 : 0;

    return NextResponse.json({
      result: {
        revenueChange: Math.round(revenueChange),
        revenueChangePct: Math.round(revenueChangePct * 10) / 10,
        marginChange: Math.round(revenueChange * 0.4),
        confidence: 65,
        notes: [
          "Based on price elasticity of -0.5",
          "Historical data from last 30 days",
          "Does not account for competitor pricing",
        ],
      },
    });
  } catch (error) {
    console.error("Scenarios error:", error);
    return NextResponse.json({ error: "Failed to run simulation" }, { status: 500 });
  }
}
