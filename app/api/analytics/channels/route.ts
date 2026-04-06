import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ channels: [] });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        orderedAt: { gte: thirtyDaysAgo },
      },
    });

    const channelMap = new Map<string, { totalOrders: number; totalRevenue: number; totalDiscount: number }>();

    for (const order of orders) {
      const ch = order.channel;
      if (!channelMap.has(ch)) {
        channelMap.set(ch, { totalOrders: 0, totalRevenue: 0, totalDiscount: 0 });
      }
      const entry = channelMap.get(ch)!;
      entry.totalOrders += 1;
      entry.totalRevenue += order.total;
      entry.totalDiscount += order.discount;
    }

    const channels = Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      totalOrders: data.totalOrders,
      totalRevenue: Math.round(data.totalRevenue),
      avgOrderValue: data.totalOrders > 0 ? Math.round(data.totalRevenue / data.totalOrders) : 0,
      totalDiscount: Math.round(data.totalDiscount),
      netRevenue: Math.round(data.totalRevenue - data.totalDiscount),
    }));

    channels.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Channels error:", error);
    return NextResponse.json({ error: "Failed to fetch channel data" }, { status: 500 });
  }
}
