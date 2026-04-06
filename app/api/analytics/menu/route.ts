import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ items: [] });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      include: {
        orderItems: {
          where: { order: { orderedAt: { gte: thirtyDaysAgo } } },
        },
      },
    });

    const avgPopularity = menuItems.reduce((sum, item) => {
      const sold = item.orderItems.reduce((s, oi) => s + oi.quantity, 0);
      return sum + sold;
    }, 0) / Math.max(menuItems.length, 1);

    const itemsWithStats = menuItems.map((item) => {
      const totalSold = item.orderItems.reduce((s, oi) => s + oi.quantity, 0);
      const revenue = item.orderItems.reduce((s, oi) => s + oi.totalPrice, 0);
      const margin = item.price > 0 ? (item.price - item.costPrice) / item.price : 0;
      const avgMargin = 0.5; // threshold

      let classification: "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG" = "DOG";
      const isHighPopularity = totalSold >= avgPopularity;
      const isHighMargin = margin >= avgMargin;

      if (isHighPopularity && isHighMargin) classification = "STAR";
      else if (isHighPopularity && !isHighMargin) classification = "PLOWHORSE";
      else if (!isHighPopularity && isHighMargin) classification = "PUZZLE";
      else classification = "DOG";

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        costPrice: item.costPrice,
        classification,
        totalSold,
        revenue: Math.round(revenue),
        margin,
      };
    });

    // Sort by revenue desc
    itemsWithStats.sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({ items: itemsWithStats });
  } catch (error) {
    console.error("Menu analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch menu analytics" }, { status: 500 });
  }
}
