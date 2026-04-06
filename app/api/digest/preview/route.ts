import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ message: "No restaurant found." });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const orders = await prisma.order.findMany({
      where: { restaurantId: restaurant.id, orderedAt: { gte: sevenDaysAgo } },
      include: { items: { include: { menuItem: true } } },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Top item
    const itemCounts = new Map<string, { name: string; count: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        if (!itemCounts.has(key)) {
          itemCounts.set(key, { name: item.menuItem.name, count: 0, revenue: 0 });
        }
        const entry = itemCounts.get(key)!;
        entry.count += item.quantity;
        entry.revenue += item.totalPrice;
      }
    }
    const topItem = [...itemCounts.values()].sort((a, b) => b.count - a.count)[0];

    // Channel breakdown
    const channelMap = new Map<string, number>();
    for (const order of orders) {
      channelMap.set(order.channel, (channelMap.get(order.channel) || 0) + order.total);
    }
    const topChannel = [...channelMap.entries()].sort((a, b) => b[1] - a[1])[0];

    const now = new Date();
    const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

    const message = `🍽️ *Meza Daily Digest* — ${now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}

${greeting}, ${restaurant.name}! Here are your last 7 days:

📊 *Revenue Summary*
• Total Revenue: ₹${totalRevenue.toLocaleString("en-IN")}
• Orders: ${totalOrders}
• Avg Order Value: ₹${Math.round(avgOrderValue).toLocaleString("en-IN")}

${topItem ? `⭐ *Top Item*\n• ${topItem.name} — ${topItem.count} orders (₹${Math.round(topItem.revenue).toLocaleString("en-IN")})` : ""}

${topChannel ? `📦 *Top Channel*\n• ${topChannel[0].replace(/_/g, " ")}: ₹${Math.round(topChannel[1]).toLocaleString("en-IN")}` : ""}

💡 *Action for Today*
${totalOrders === 0 ? "Start uploading POS data to get personalized insights." : `Focus on your top channel ${topChannel?.[0]?.replace(/_/g, " ") || "Dine-In"} — it's driving the most revenue.`}

_Powered by Meza_ 🚀`;

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
