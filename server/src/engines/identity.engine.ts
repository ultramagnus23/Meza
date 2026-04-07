import { PrismaClient, Order } from '@prisma/client';
import { differenceInDays, subDays } from 'date-fns';

type ParsedMetadata = {
  tableNumber?: string;
  zomatoId?: string;
  swiggyId?: string;
  phone?: string;
  partySize?: number;
};

export class IdentityEngine {
  constructor(private prisma: PrismaClient) {}

  async resolveCustomerIdentity(order: Order): Promise<void> {
    const metadata = parseMetadata(order.metadata);
    const phone = order.customerPhone || metadata.phone;
    const platformId = metadata.zomatoId || metadata.swiggyId;

    let customer =
      (phone
        ? await this.prisma.customer.findFirst({
            where: { restaurantId: order.restaurantId, phone },
          })
        : null) ||
      (platformId
        ? await this.prisma.customer.findFirst({
            where: {
              restaurantId: order.restaurantId,
              OR: [
                metadata.zomatoId ? { zomatoId: metadata.zomatoId } : undefined,
                metadata.swiggyId ? { swiggyId: metadata.swiggyId } : undefined,
              ].filter(Boolean),
            },
          })
        : null);

    if (customer && phone && !customer.phone) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { phone },
      });
    }

    let isNewCustomer = false;
    if (!customer && (phone || platformId)) {
      customer = await this.prisma.customer.create({
        data: {
          restaurantId: order.restaurantId,
          phone: phone || null,
          zomatoId: metadata.zomatoId || null,
          swiggyId: metadata.swiggyId || null,
          displayName: phone ? `Regular ${phone.slice(-4)}` : undefined,
          firstSeenAt: order.timestamp,
          lastSeenAt: order.timestamp,
          visitCount: 1,
          totalSpend: order.totalAmount,
          avgOrderValue: order.totalAmount,
          preferredChannel: order.channel,
          preferredTime: getTimeband(order.timestamp),
        },
      });
      isNewCustomer = true;
    }

    if (customer) {
      const isNewVisit = await this.updateCustomerVisit(customer.id, order, metadata);
      if (!isNewCustomer && isNewVisit) {
        await this.updateCustomerAggregate(customer.id, order);
      }
      await this.trackTableCluster(order, metadata);
      return;
    }

    await this.trackTableCluster(order, metadata);
  }

  async mergeCustomerRecords(primaryId: string, secondaryId: string): Promise<void> {
    if (primaryId === secondaryId) return;

    const [primary, secondary] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: primaryId } }),
      this.prisma.customer.findUnique({ where: { id: secondaryId } }),
    ]);

    if (!primary || !secondary) return;

    const totalSpend = primary.totalSpend + secondary.totalSpend;
    const visitCount = primary.visitCount + secondary.visitCount;
    const avgOrderValue = visitCount > 0 ? totalSpend / visitCount : 0;

    await this.prisma.customer.update({
      where: { id: primaryId },
      data: {
        totalSpend,
        visitCount,
        avgOrderValue,
        phone: primary.phone || secondary.phone,
        zomatoId: primary.zomatoId || secondary.zomatoId,
        swiggyId: primary.swiggyId || secondary.swiggyId,
        lastSeenAt: primary.lastSeenAt > secondary.lastSeenAt ? primary.lastSeenAt : secondary.lastSeenAt,
      },
    });

    await this.prisma.customerVisit.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    });

    await this.prisma.customerSignal.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    });

    await this.prisma.customer.delete({ where: { id: secondaryId } });
  }

  async generateRepeatInsights(restaurantId: number): Promise<void> {
    const customers = await this.prisma.customer.findMany({
      where: { restaurantId },
      include: { visits: { orderBy: { visitedAt: 'desc' }, take: 6 } },
    });

    for (const customer of customers) {
      if (customer.visitCount >= 4 && customer.visits.length >= 5) {
        const gaps: number[] = [];
        for (let i = 0; i < customer.visits.length - 1; i += 1) {
          gaps.push(
            differenceInDays(customer.visits[i].visitedAt, customer.visits[i + 1].visitedAt)
          );
        }
        const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
        const daysSinceLast = differenceInDays(new Date(), customer.lastSeenAt);
        if (avgGap > 0 && daysSinceLast > avgGap * 1.8) {
          await this.createInsight(
            restaurantId,
            'REPEAT_DECLINE',
            `A regular customer (last visit ${daysSinceLast} days ago) has gone quiet.`,
            `Typical gap is ${avgGap.toFixed(1)} days. Consider a win-back offer.`
          );
        }
      }

      if (customer.visitCount === 10) {
        await this.createInsight(
          restaurantId,
          'REPEAT_MILESTONE',
          `Customer hit their 10th visit milestone.`,
          `Send a thank-you or loyalty perk to reinforce repeat behavior.`
        );
      }
    }

    await this.generateAcquisitionInsights(restaurantId);
  }

  private async updateCustomerVisit(
    customerId: string,
    order: Order,
    metadata: ParsedMetadata
  ): Promise<boolean> {
    const existingVisit = await this.prisma.customerVisit.findUnique({
      where: { orderId: order.id },
    });
    await this.prisma.customerVisit.upsert({
      where: { orderId: order.id },
      update: {
        visitedAt: order.timestamp,
        partySize: order.guestCount || metadata.partySize || null,
        channel: order.channel,
        totalSpend: order.totalAmount,
        tableNumber: metadata.tableNumber || null,
        serverId: order.serverId,
      },
      create: {
        customerId,
        orderId: order.id,
        visitedAt: order.timestamp,
        partySize: order.guestCount || metadata.partySize || null,
        channel: order.channel,
        totalSpend: order.totalAmount,
        tableNumber: metadata.tableNumber || null,
        serverId: order.serverId,
      },
    });
    return !existingVisit;
  }

  private async updateCustomerAggregate(customerId: string, order: Order): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return;

    const visitCount = customer.visitCount + 1;
    const totalSpend = customer.totalSpend + order.totalAmount;
    const avgOrderValue = totalSpend / visitCount;

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        visitCount,
        totalSpend,
        avgOrderValue,
        lastSeenAt: order.timestamp,
        preferredChannel: customer.preferredChannel || order.channel,
        preferredTime: customer.preferredTime || getTimeband(order.timestamp),
      },
    });
  }

  private async trackTableCluster(order: Order, metadata: ParsedMetadata): Promise<void> {
    if (order.orderType !== 'DINE_IN') return;
    if (!metadata.tableNumber) return;

    const timeband = getTimeband(order.timestamp);
    const dayOfWeek = order.timestamp.getDay();
    const partySize = order.guestCount || metadata.partySize || 1;
    const spend = order.totalAmount;

    const existing = await this.prisma.tableCluster.findFirst({
      where: {
        restaurantId: order.restaurantId,
        tableNumber: metadata.tableNumber,
        dayOfWeek,
        timeband,
      },
    });

    if (!existing) {
      await this.prisma.tableCluster.create({
        data: {
          restaurantId: order.restaurantId,
          tableNumber: metadata.tableNumber,
          dayOfWeek,
          timeband,
          avgPartySize: partySize,
          avgSpend: spend,
          dominantChannel: order.channel,
          visitCount: 1,
          probabilityRepeat: 0.33,
        },
      });
      return;
    }

    const visitCount = existing.visitCount + 1;
    const avgPartySize =
      (existing.avgPartySize * existing.visitCount + partySize) / visitCount;
    const avgSpend = (existing.avgSpend * existing.visitCount + spend) / visitCount;
    const probabilityRepeat = Math.min(1, visitCount / 3);

    await this.prisma.tableCluster.update({
      where: { id: existing.id },
      data: {
        avgPartySize,
        avgSpend,
        visitCount,
        probabilityRepeat,
      },
    });
  }

  private async generateAcquisitionInsights(restaurantId: number): Promise<void> {
    const since = subDays(new Date(), 60);
    const customers = await this.prisma.customer.findMany({
      where: {
        restaurantId,
        firstSeenAt: { gte: since },
      },
      include: {
        visits: true,
      },
    });

    const channelStats = new Map<string, { total: number; converted: number }>();

    for (const customer of customers) {
      const firstVisit = customer.visits.sort((a, b) => a.visitedAt.getTime() - b.visitedAt.getTime())[0];
      if (!firstVisit) continue;
      const firstChannel = firstVisit.channel;
      const hasDineIn = customer.visits.some((visit) => visit.channel === 'DIRECT');

      const stats = channelStats.get(firstChannel) || { total: 0, converted: 0 };
      stats.total += 1;
      if (hasDineIn && firstChannel !== 'DIRECT') stats.converted += 1;
      channelStats.set(firstChannel, stats);
    }

    for (const [channel, stats] of channelStats.entries()) {
      if (channel === 'DIRECT') continue;
      const conversionRate = stats.total > 0 ? stats.converted / stats.total : 0;
      if (channel === 'ZOMATO' && conversionRate > 0.15) {
        await this.createInsight(
          restaurantId,
          'ACQUISITION_CHANNEL',
          `Zomato delivery customers convert to dine-in at ${(conversionRate * 100).toFixed(1)}%.`,
          'This channel is bringing repeat dine-in customers.'
        );
      }
      if (channel === 'SWIGGY' && conversionRate < 0.05) {
        await this.createInsight(
          restaurantId,
          'CHANNEL_DRAIN',
          `Swiggy delivery conversion to dine-in is ${(conversionRate * 100).toFixed(1)}%.`,
          'Consider adjusting Swiggy promotions or packaging.'
        );
      }
    }
  }

  private async createInsight(
    restaurantId: number,
    type: string,
    observation: string,
    explanation: string
  ): Promise<void> {
    await this.prisma.insight.create({
      data: {
        restaurantId,
        type,
        severity: 'info',
        observation,
        explanation,
        causalFactors: '[]',
        formula: '',
        assumptions: '[]',
        confidenceScore: 0.6,
      },
    });
  }
}

function parseMetadata(raw?: string | null): ParsedMetadata {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    return {
      tableNumber: data.tableNumber,
      zomatoId: data.zomatoId,
      swiggyId: data.swiggyId,
      phone: data.phone,
      partySize: data.partySize,
    };
  } catch {
    return {};
  }
}

function getTimeband(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return 'BREAKFAST';
  if (hour < 15) return 'LUNCH';
  if (hour < 19) return 'EVENING';
  return 'DINNER';
}
