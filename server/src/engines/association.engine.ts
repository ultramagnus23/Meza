import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';

export type Timeband = 'BREAKFAST' | 'LUNCH' | 'EVENING' | 'DINNER';
export type PartySizeBucket = 'SOLO' | 'PAIR' | 'SMALL_GROUP' | 'LARGE_GROUP' | 'ALL';
export type ServerTier = 'SENIOR' | 'JUNIOR' | 'ALL';

export interface ContextSlice {
  timeband: Timeband;
  channel: string;
  partySizeBucket: PartySizeBucket;
  serverTier: ServerTier;
}

export interface ContextualAssociationResult {
  itemAId: number;
  itemBId: number;
  context: ContextSlice;
  support: number;
  confidence: number;
  lift: number;
  occurrences: number;
  estimatedWeeklyUplift: number;
  trainabilityScore: number;
}

type ContextStats = {
  totalOrders: number;
  itemCounts: Map<number, number>;
  pairCounts: Map<string, number>;
};

export class ContextualAssociationEngine {
  constructor(private prisma: PrismaClient) {}

  async run(restaurantId: number, lookbackDays: number = 30): Promise<ContextualAssociationResult[]> {
    const since = subDays(new Date(), lookbackDays);

    const orders = await this.prisma.order.findMany({
      where: { restaurantId, timestamp: { gte: since } },
      include: { orderItems: true },
    });

    if (orders.length === 0) return [];

    const serverTierMap = await this.computeServerTiers(restaurantId, since);
    const contextMap = new Map<string, ContextStats>();

    for (const order of orders) {
      const timeband = getTimeband(order.timestamp);
      const channel = order.channel || 'ALL';
      const partySizeBucket = getPartySizeBucket(order.guestCount);
      const serverTier = order.serverId ? serverTierMap.get(order.serverId) || 'ALL' : 'ALL';
      const contextKey = `${timeband}|${channel}|${partySizeBucket}|${serverTier}`;
      const stats = contextMap.get(contextKey) || {
        totalOrders: 0,
        itemCounts: new Map<number, number>(),
        pairCounts: new Map<string, number>(),
      };

      stats.totalOrders += 1;

      const uniqueItems = Array.from(
        new Set(order.orderItems.map((item) => item.menuItemId))
      );

      for (const itemId of uniqueItems) {
        stats.itemCounts.set(itemId, (stats.itemCounts.get(itemId) || 0) + 1);
      }

      for (const itemA of uniqueItems) {
        for (const itemB of uniqueItems) {
          if (itemA === itemB) continue;
          const pairKey = `${itemA}|${itemB}`;
          stats.pairCounts.set(pairKey, (stats.pairCounts.get(pairKey) || 0) + 1);
        }
      }

      contextMap.set(contextKey, stats);
    }

    const menuItems = await this.prisma.menuItem.findMany({
      where: { restaurantId },
    });
    const marginMap = new Map<number, number>();
    for (const item of menuItems) {
      const fallbackMargin = item.currentPrice - (item.cost || 0);
      marginMap.set(item.id, item.margin ?? fallbackMargin);
    }

    const results: ContextualAssociationResult[] = [];
    const liftMap = new Map<string, { senior?: number; junior?: number }>();

    for (const [key, stats] of contextMap.entries()) {
      const [timeband, channel, partySizeBucket, serverTier] = key.split('|') as [
        Timeband,
        string,
        PartySizeBucket,
        ServerTier
      ];

      for (const [pairKey, occurrences] of stats.pairCounts.entries()) {
        const [itemAId, itemBId] = pairKey.split('|').map((id) => Number(id));
        const countA = stats.itemCounts.get(itemAId) || 0;
        const countB = stats.itemCounts.get(itemBId) || 0;
        if (countA === 0 || countB === 0) continue;

        const support = occurrences / stats.totalOrders;
        const confidence = occurrences / countA;
        const lift = countB > 0 ? confidence / (countB / stats.totalOrders) : 0;
        const ordersWithAButNotB = Math.max(countA - occurrences, 0);
        const marginB = marginMap.get(itemBId) || 0;
        // ordersWithAButNotB (missed upsells) * confidence (capture rate) * marginB (₹ per item)
        // scaled to weekly impact based on lookback window.
        const estimatedWeeklyUplift =
          ordersWithAButNotB * confidence * marginB * (7 / lookbackDays);

        const context = { timeband, channel, partySizeBucket, serverTier };
        results.push({
          itemAId,
          itemBId,
          context,
          support,
          confidence,
          lift,
          occurrences,
          estimatedWeeklyUplift,
          trainabilityScore: 0,
        });

        const liftKey = `${itemAId}|${itemBId}|${timeband}|${channel}|${partySizeBucket}`;
        const liftEntry = liftMap.get(liftKey) || {};
        if (serverTier === 'SENIOR') liftEntry.senior = lift;
        if (serverTier === 'JUNIOR') liftEntry.junior = lift;
        liftMap.set(liftKey, liftEntry);
      }
    }

    for (const result of results) {
      const liftKey = `${result.itemAId}|${result.itemBId}|${result.context.timeband}|${result.context.channel}|${result.context.partySizeBucket}`;
      const liftEntry = liftMap.get(liftKey);
      if (liftEntry?.senior && liftEntry?.junior && liftEntry.senior > 0) {
        const delta = liftEntry.senior - liftEntry.junior;
        result.trainabilityScore = Math.max(0, delta / liftEntry.senior);
      }
    }

    await this.prisma.contextualAssociation.deleteMany({
      where: { restaurantId },
    });

    if (results.length > 0) {
      await this.prisma.contextualAssociation.createMany({
        data: results.map((result) => ({
          restaurantId,
          itemAId: result.itemAId,
          itemBId: result.itemBId,
          timeband: result.context.timeband,
          channel: result.context.channel,
          partySizeBucket: result.context.partySizeBucket,
          serverTier: result.context.serverTier,
          support: result.support,
          confidence: result.confidence,
          lift: result.lift,
          occurrences: result.occurrences,
          estimatedWeeklyUplift: result.estimatedWeeklyUplift,
          trainabilityScore: result.trainabilityScore,
        })),
      });
    }

    return results;
  }

  private async computeServerTiers(
    restaurantId: number,
    since: Date
  ): Promise<Map<number, ServerTier>> {
    const serverStats = await this.prisma.order.groupBy({
      by: ['serverId'],
      where: {
        restaurantId,
        timestamp: { gte: since },
        serverId: { not: null },
      },
      _avg: { totalAmount: true },
      _count: { _all: true },
    });

    const entries = serverStats
      .filter((stat) => stat.serverId !== null)
      .map((stat) => ({
        serverId: stat.serverId as number,
        avgOrderValue: stat._avg.totalAmount || 0,
      }))
      .sort((a, b) => b.avgOrderValue - a.avgOrderValue);

    if (entries.length < 3) {
      return new Map<number, ServerTier>();
    }

    const tierMap = new Map<number, ServerTier>();
    const topCutoff = Math.floor(entries.length / 3);
    const bottomCutoff = entries.length - topCutoff;

    entries.forEach((entry, index) => {
      if (index < topCutoff) {
        tierMap.set(entry.serverId, 'SENIOR');
      } else if (index >= bottomCutoff) {
        tierMap.set(entry.serverId, 'JUNIOR');
      }
    });

    return tierMap;
  }
}

function getTimeband(timestamp: Date): Timeband {
  const hour = timestamp.getHours();
  if (hour < 11) return 'BREAKFAST';
  if (hour < 15) return 'LUNCH';
  if (hour < 19) return 'EVENING';
  return 'DINNER';
}

function getPartySizeBucket(partySize?: number | null): PartySizeBucket {
  if (!partySize) return 'ALL';
  if (partySize === 1) return 'SOLO';
  if (partySize === 2) return 'PAIR';
  if (partySize <= 5) return 'SMALL_GROUP';
  return 'LARGE_GROUP';
}
