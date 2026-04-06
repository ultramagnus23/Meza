import { PrismaClient } from "@prisma/client";

export interface Insight {
  type: string;
  priority: number; // 1 = highest
  headline: string;
  detail: string;
  action: string;
  data?: Record<string, unknown>;
}

export async function generateInsights(
  prisma: PrismaClient,
  restaurantId: string,
  lookbackDays: number = 7,
  options: {
    includeRevenue?: boolean;
    includeMenu?: boolean;
    includeChannel?: boolean;
    includeServer?: boolean;
  } = {}
): Promise<Insight[]> {
  const {
    includeRevenue = true,
    includeMenu = true,
    includeChannel = true,
    includeServer = true,
  } = options;

  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const prevPeriodStart = new Date(since);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - lookbackDays);

  const insights: Insight[] = [];

  const [currentOrders, prevOrders] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, orderedAt: { gte: since } },
      include: { items: { include: { menuItem: true } } },
    }),
    prisma.order.findMany({
      where: {
        restaurantId,
        orderedAt: { gte: prevPeriodStart, lt: since },
      },
    }),
  ]);

  if (includeRevenue) {
    const currentRevenue = currentOrders.reduce((s, o) => s + o.total, 0);
    const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
    const currentOrCount = currentOrders.length;

    if (prevRevenue > 0) {
      const revChange = ((currentRevenue - prevRevenue) / prevRevenue) * 100;
      insights.push({
        type: "revenue_trend",
        priority: 1,
        headline:
          revChange >= 0
            ? `Revenue up ${Math.abs(revChange).toFixed(1)}% vs last ${lookbackDays} days`
            : `Revenue down ${Math.abs(revChange).toFixed(1)}% vs last ${lookbackDays} days`,
        detail: `₹${Math.round(currentRevenue).toLocaleString("en-IN")} this period vs ₹${Math.round(prevRevenue).toLocaleString("en-IN")} last period.`,
        action:
          revChange < -10
            ? "Consider running a promotion or checking if any items were 86'd."
            : "Keep up the momentum — analyze what's driving the growth.",
        data: { currentRevenue, prevRevenue, revChange },
      });
    } else if (currentRevenue > 0) {
      insights.push({
        type: "revenue_trend",
        priority: 1,
        headline: `₹${Math.round(currentRevenue).toLocaleString("en-IN")} revenue in the last ${lookbackDays} days`,
        detail: `${currentOrCount} orders with avg order value of ₹${currentOrCount > 0 ? Math.round(currentRevenue / currentOrCount) : 0}.`,
        action: "Upload more historical data to get trend comparisons.",
        data: { currentRevenue, currentOrCount },
      });
    }
  }

  if (includeMenu && currentOrders.length > 0) {
    // Top items
    const itemCounts = new Map<string, { name: string; count: number; revenue: number }>();
    for (const order of currentOrders) {
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

    const sorted = [...itemCounts.values()].sort((a, b) => b.count - a.count);
    if (sorted.length > 0) {
      const top = sorted[0];
      insights.push({
        type: "top_item",
        priority: 2,
        headline: `${top.name} is your #1 item — ${top.count} orders`,
        detail: `Generated ₹${Math.round(top.revenue).toLocaleString("en-IN")} in revenue.`,
        action: `Feature ${top.name} prominently on your menu and in combo offers.`,
        data: { itemName: top.name, count: top.count, revenue: top.revenue },
      });
    }

    // Slow movers
    if (sorted.length > 3) {
      const bottom = sorted[sorted.length - 1];
      insights.push({
        type: "slow_item",
        priority: 4,
        headline: `${bottom.name} has very low orders (${bottom.count})`,
        detail: `Consider removing or repricing ${bottom.name}.`,
        action: `Review cost structure of ${bottom.name} — if margin is low too, it's a Dog item.`,
        data: { itemName: bottom.name, count: bottom.count },
      });
    }
  }

  if (includeChannel && currentOrders.length > 0) {
    const channelMap = new Map<string, { count: number; revenue: number; discount: number }>();
    for (const order of currentOrders) {
      const ch = order.channel;
      if (!channelMap.has(ch)) {
        channelMap.set(ch, { count: 0, revenue: 0, discount: 0 });
      }
      const entry = channelMap.get(ch)!;
      entry.count += 1;
      entry.revenue += order.total;
      entry.discount += order.discount;
    }

    const channelArr = [...channelMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
    if (channelArr.length > 0) {
      const [topCh, topData] = channelArr[0];
      const totalRevenue = currentOrders.reduce((s, o) => s + o.total, 0);
      const share = totalRevenue > 0 ? (topData.revenue / totalRevenue) * 100 : 0;

      insights.push({
        type: "top_channel",
        priority: 3,
        headline: `${topCh.replace(/_/g, " ")} drives ${share.toFixed(0)}% of revenue`,
        detail: `${topData.count} orders, ₹${Math.round(topData.revenue).toLocaleString("en-IN")} revenue.`,
        action:
          topCh === "ZOMATO" || topCh === "SWIGGY"
            ? `Aggregator commissions may be eating 20-30% margin. Encourage direct orders.`
            : `Your top channel is ${topCh.replace(/_/g, " ")}. Invest in keeping this experience excellent.`,
        data: { channel: topCh, revenue: topData.revenue, share },
      });
    }

    // High discount channel
    for (const [ch, data] of channelArr) {
      const discountRate = data.revenue > 0 ? (data.discount / data.revenue) * 100 : 0;
      if (discountRate > 15) {
        insights.push({
          type: "high_discount",
          priority: 2,
          headline: `${ch.replace(/_/g, " ")} has ${discountRate.toFixed(1)}% discount rate`,
          detail: `You are discounting ₹${Math.round(data.discount).toLocaleString("en-IN")} on this channel.`,
          action: `Review your discount strategy on ${ch.replace(/_/g, " ")} — this is hurting margins.`,
          data: { channel: ch, discountRate, totalDiscount: data.discount },
        });
        break; // Only flag the worst one
      }
    }
  }

  if (includeServer) {
    const servers = await prisma.server.findMany({
      where: { restaurantId, isActive: true },
      include: {
        orders: {
          where: { orderedAt: { gte: since } },
        },
      },
    });

    if (servers.length > 1) {
      const serverStats = servers
        .map((s) => ({
          name: s.name,
          orders: s.orders.length,
          revenue: s.orders.reduce((sum, o) => sum + o.total, 0),
          avg: s.orders.length > 0 ? s.orders.reduce((sum, o) => sum + o.total, 0) / s.orders.length : 0,
        }))
        .filter((s) => s.orders > 0)
        .sort((a, b) => b.avg - a.avg);

      if (serverStats.length >= 2) {
        const best = serverStats[0];
        const worst = serverStats[serverStats.length - 1];
        const gap = best.avg - worst.avg;

        if (gap > 50) {
          insights.push({
            type: "server_gap",
            priority: 3,
            headline: `${best.name} averages ₹${Math.round(best.avg)} vs ${worst.name}'s ₹${Math.round(worst.avg)}`,
            detail: `A ₹${Math.round(gap)} gap in avg check size between your best and worst performer.`,
            action: `Have ${best.name} train others on upsell techniques.`,
            data: { bestServer: best.name, worstServer: worst.name, gap },
          });
        }
      }
    }
  }

  // Associations insight
  const topAssociations = await prisma.itemAssociation.findMany({
    where: { restaurantId, lift: { gte: 2 } },
    include: {
      itemA: { select: { name: true } },
      itemB: { select: { name: true } },
    },
    orderBy: { lift: "desc" },
    take: 1,
  });

  if (topAssociations.length > 0) {
    const assoc = topAssociations[0];
    insights.push({
      type: "association",
      priority: 3,
      headline: `Customers who order ${assoc.itemA.name} often also order ${assoc.itemB.name}`,
      detail: `${(assoc.confidence * 100).toFixed(0)}% of ${assoc.itemA.name} buyers also get ${assoc.itemB.name} (${assoc.lift.toFixed(1)}x more likely than chance).`,
      action: `Create a combo: "${assoc.itemA.name} + ${assoc.itemB.name}" at a 5-8% discount.`,
      data: { itemA: assoc.itemA.name, itemB: assoc.itemB.name, confidence: assoc.confidence, lift: assoc.lift },
    });
  }

  // Sort by priority and return top N
  insights.sort((a, b) => a.priority - b.priority);
  return insights;
}
