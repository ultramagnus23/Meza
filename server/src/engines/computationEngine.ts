import { PrismaClient } from '@prisma/client';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';

export class ComputationEngine {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async recomputeAll(restaurantId: number, affectedDate?: Date): Promise<void> {
    const date = affectedDate || new Date();
    console.log(`[Engine] Starting recompute for Restaurant ${restaurantId}`);

    try {
      // 1. Recompute Aggregates
      await this.recomputeTimeAggregates(restaurantId, date);
      
      // 2. Recompute Baselines (Using the new safe method)
      await this.recomputeBaselines(restaurantId, date);
      
      console.log(`[Engine] Recompute complete.`);
    } catch (error) {
      console.error(`[Engine] Critical Error:`, error);
      // We catch the error but don't re-throw to keep the server alive
    }
  }

  // --- TIME AGGREGATION ---
  private async recomputeTimeAggregates(restaurantId: number, date: Date): Promise<void> {
    await this.computeAggregate(restaurantId, startOfDay(date), endOfDay(date), 'day');
    
    // Optional: Add week/month logic here if needed, but 'day' is essential for the dashboard
  }

  private async computeAggregate(restaurantId: number, start: Date, end: Date, type: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        timestamp: { gte: start, lte: end }
      },
      include: { orderItems: true }
    });

    if (orders.length === 0) return;

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalRevenue / totalOrders;
    
    const itemSet = new Set<string>();
    orders.forEach(o => o.orderItems.forEach(i => itemSet.add(i.menuItemId)));

    const existing = await this.prisma.timeAggregate.findFirst({
        where: { restaurantId, periodType: type, periodStart: start }
    });

    const data = {
        restaurantId,
        periodType: type,
        periodStart: start,
        periodEnd: end,
        totalRevenue,
        totalOrders,
        avgOrderValue,
        totalItems: orders.reduce((sum, o) => sum + o.orderItems.length, 0),
        uniqueItems: itemSet.size,
        version: (existing?.version || 0) + 1
    };

    if (existing) {
        await this.prisma.timeAggregate.update({ where: { id: existing.id }, data });
    } else {
        await this.prisma.timeAggregate.create({ data });
    }
    console.log(`[Aggregate] Computed ${type} stats: ₹${totalRevenue}`);
  }

  // --- BASELINES (SAFE VERSION) ---
  private async recomputeBaselines(restaurantId: number, date: Date): Promise<void> {
    const menuItems = await this.prisma.menuItem.findMany({
      where: { restaurantId, isActive: true }
    });

    for (const item of menuItems) {
      await this.computeItemBaseline(item.id, 30);
    }
  }

  async computeItemBaseline(menuItemId: number, lookbackDays: number = 30): Promise<void> {
    const endDate = new Date();
    const startDate = subDays(endDate, lookbackDays);

    // FIX: Replaced Raw SQL with standard Prisma findMany
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        menuItemId,
        order: { timestamp: { gte: startDate } }
      },
      include: { order: true }
    });

    if (orderItems.length < 5) return;

    // Group by Day in JavaScript
    const dailyMap = new Map<string, { qty: number; rev: number; prices: number[] }>();

    for (const item of orderItems) {
      const dayKey = format(item.order.timestamp, 'yyyy-MM-dd');
      const entry = dailyMap.get(dayKey) || { qty: 0, rev: 0, prices: [] };
      
      entry.qty += item.quantity;
      entry.rev += (item.quantity * item.priceAtTime);
      entry.prices.push(item.priceAtTime);
      
      dailyMap.set(dayKey, entry);
    }

    // Convert Map to Arrays for statistics
    const days = Array.from(dailyMap.values());
    const quantities = days.map(d => d.qty);
    const revenues = days.map(d => d.rev);

    const avgQty = this.mean(quantities);
    const stdQty = this.stdDev(quantities);
    
    // Save Baseline
    const existing = await this.prisma.itemBaseline.findFirst({
        where: { menuItemId, periodEnd: endDate }
    });

    const data = {
        menuItemId,
        periodStart: startDate,
        periodEnd: endDate,
        avgDailyQuantity: avgQty,
        stdDevQuantity: stdQty,
        avgDailyRevenue: this.mean(revenues),
        stdDevRevenue: this.stdDev(revenues),
        sampleSize: orderItems.length,
        confidenceScore: 0.85, // Default confidence
        version: (existing?.version || 0) + 1
    };

    if (existing) {
        await this.prisma.itemBaseline.update({ where: { id: existing.id }, data });
    } else {
        await this.prisma.itemBaseline.create({ data });
    }
  }

  private mean(arr: number[]) { 
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; 
  }
  
  private stdDev(arr: number[]) {
    if (arr.length < 2) return 0;
    const avg = this.mean(arr);
    return Math.sqrt(arr.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / arr.length);
  }
}