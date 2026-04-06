import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ stats: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, revpash: 0 } });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        orderedAt: { gte: sevenDaysAgo },
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalCovers = orders.reduce((sum, o) => sum + (o.partySize || 1), 0);
    const revpash = (restaurant.totalSeats * restaurant.hoursOpen * 7) > 0
      ? totalRevenue / (restaurant.totalSeats * restaurant.hoursOpen * 7)
      : 0;

    return NextResponse.json({
      stats: {
        totalRevenue: Math.round(totalRevenue),
        totalOrders,
        avgOrderValue: Math.round(avgOrderValue),
        revpash: Math.round(revpash * 100) / 100,
        totalCovers,
      },
    });
  } catch (error) {
    console.error("Overview error:", error);
    return NextResponse.json({ error: "Failed to fetch overview" }, { status: 500 });
  }
}
