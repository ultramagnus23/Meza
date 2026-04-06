import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ servers: [] });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const servers = await prisma.server.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      include: {
        orders: {
          where: { orderedAt: { gte: thirtyDaysAgo } },
          include: { items: true },
        },
      },
    });

    const avgCheckAll = servers.flatMap((s) => s.orders).reduce((sum, o) => sum + o.total, 0) /
      Math.max(servers.flatMap((s) => s.orders).length, 1);

    const serverStats = servers.map((server) => {
      const totalOrders = server.orders.length;
      const totalRevenue = server.orders.reduce((sum, o) => sum + o.total, 0);
      const avgCheckSize = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      // Upsell score based on avg check vs overall avg
      const upsellScore = avgCheckAll > 0 ? Math.min(100, (avgCheckSize / avgCheckAll) * 50) : 50;

      return {
        id: server.id,
        name: server.name,
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        avgCheckSize: Math.round(avgCheckSize),
        upsellScore: Math.round(upsellScore),
      };
    });

    serverStats.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return NextResponse.json({ servers: serverStats });
  } catch (error) {
    console.error("Servers error:", error);
    return NextResponse.json({ error: "Failed to fetch server data" }, { status: 500 });
  }
}
