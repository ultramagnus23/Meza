import { PrismaClient, SignalType } from '@prisma/client';
import { subDays } from 'date-fns';

const QUALITY_ALERT_THRESHOLD = 3;
const MENU_GAP_THRESHOLD = 4;
const SERVICE_SPEED_THRESHOLD = 3;
const SERVER_STAR_MULTIPLIER = 2;
const SERVER_STAR_MIN_WINS = 3;

type ExtractionResult = {
  signalType: SignalType;
  sentiment: number;
  menuItemId?: number;
};

export class WaiterSignalProcessor {
  constructor(private prisma: PrismaClient) {}

  async processPendingSignals(restaurantId: number): Promise<void> {
    const pendingSignals = await this.prisma.waiterSignal.findMany({
      where: { restaurantId, processed: false },
    });

    for (const signal of pendingSignals) {
      const bodyNormalized = normalizeSignal(signal.body);
      const extraction = await this.extractSignal(restaurantId, bodyNormalized);
      await this.prisma.waiterSignal.update({
        where: { id: signal.id },
        data: {
          bodyNormalized,
          signalType: extraction.signalType,
          sentiment: extraction.sentiment,
          menuItemId: extraction.menuItemId || null,
          processed: true,
        },
      });
    }
  }

  async aggregateSignals(restaurantId: number): Promise<void> {
    const since = subDays(new Date(), 14);
    const signals = await this.prisma.waiterSignal.findMany({
      where: { restaurantId, createdAt: { gte: since }, processed: true },
    });

    const grouped = new Map<string, { count: number; signalType: SignalType; menuItemId?: number }>();
    signals.forEach((signal) => {
      const key = `${signal.menuItemId || 'none'}|${signal.signalType}`;
      const entry = grouped.get(key) || { count: 0, signalType: signal.signalType, menuItemId: signal.menuItemId || undefined };
      entry.count += 1;
      grouped.set(key, entry);
    });

    for (const entry of grouped.values()) {
      if (entry.signalType === 'DISH_COMPLAINT' && entry.count >= QUALITY_ALERT_THRESHOLD) {
        await this.createInsight(
          restaurantId,
          'QUALITY_ALERT',
          `A dish received ${entry.count} complaints from waiters recently.`,
          'Investigate consistency or preparation issues.'
        );
      }
      if (entry.signalType === 'DISH_REQUEST' && entry.count >= MENU_GAP_THRESHOLD) {
        await this.createInsight(
          restaurantId,
          'MENU_GAP',
          `Waiters reported ${entry.count} requests for items not on the menu.`,
          'Consider adding a lighter or requested option.'
        );
      }
      if (entry.signalType === 'EARLY_BILL' && entry.count >= SERVICE_SPEED_THRESHOLD) {
        await this.createInsight(
          restaurantId,
          'SERVICE_SPEED',
          `Early bill requests spiked (${entry.count} mentions).`,
          'Check table pacing and service speed.'
        );
      }
    }

    await this.aggregateServerWins(restaurantId, since);
  }

  private async aggregateServerWins(restaurantId: number, since: Date): Promise<void> {
    const signals = await this.prisma.waiterSignal.findMany({
      where: { restaurantId, createdAt: { gte: since } },
    });

    const serverStats = new Map<number, { wins: number; fails: number }>();
    signals.forEach((signal) => {
      if (!signal.serverId) return;
      const stats = serverStats.get(signal.serverId) || { wins: 0, fails: 0 };
      if (signal.signalType === 'UPSELL_WIN') stats.wins += 1;
      if (signal.signalType === 'UPSELL_FAIL') stats.fails += 1;
      serverStats.set(signal.serverId, stats);
    });

    const rates = Array.from(serverStats.values()).map((stats) =>
      stats.wins + stats.fails > 0 ? stats.wins / (stats.wins + stats.fails) : 0
    );
    const averageRate = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;

    for (const [serverId, stats] of serverStats.entries()) {
      const rate = stats.wins + stats.fails > 0 ? stats.wins / (stats.wins + stats.fails) : 0;
      if (rate > averageRate * SERVER_STAR_MULTIPLIER && stats.wins >= SERVER_STAR_MIN_WINS) {
        await this.createInsight(
          restaurantId,
          'SERVER_STAR',
          `Server ${serverId} has a high upsell win rate (${Math.round(rate * 100)}%).`,
          'Share this server’s approach with the team.'
        );
      }
    }
  }

  private async extractSignal(restaurantId: number, body: string): Promise<ExtractionResult> {
    const menuItems = await this.prisma.menuItem.findMany({ where: { restaurantId } });
    const lower = body.toLowerCase();

    const menuItem = menuItems.find((item) => lower.includes(item.name.toLowerCase()));
    const signalType = detectSignalType(lower);
    const sentiment = detectSentiment(lower);

    return { signalType, sentiment, menuItemId: menuItem?.id };
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
        severity: 'warning',
        observation,
        explanation,
        causalFactors: '[]',
        formula: '',
        assumptions: '[]',
        confidenceScore: 0.55,
      },
    });
  }
}

function normalizeSignal(body: string): string {
  if (!containsHindi(body)) return body.trim();
  return body.trim();
}

function containsHindi(body: string): boolean {
  return /[\u0900-\u097F]/.test(body);
}

function detectSignalType(lower: string): SignalType {
  if (lower.includes('complaint') || lower.includes('bad') || lower.includes('cold')) {
    return 'DISH_COMPLAINT';
  }
  if (lower.includes('asked') || lower.includes('request') || lower.includes('nahi') || lower.includes('not on menu')) {
    return 'DISH_REQUEST';
  }
  if (lower.includes('bill early') || lower.includes('jaldi bill')) {
    return 'EARLY_BILL';
  }
  if (lower.includes('upsell') && lower.includes('accepted')) {
    return 'UPSELL_WIN';
  }
  if (lower.includes('upsell') && lower.includes('declined')) {
    return 'UPSELL_FAIL';
  }
  if (lower.includes('great') || lower.includes('excellent') || lower.includes('praised')) {
    return 'POSITIVE_SHOUTOUT';
  }
  return 'TABLE_FEEDBACK';
}

function detectSentiment(lower: string): number {
  if (lower.includes('good') || lower.includes('great') || lower.includes('excellent')) return 0.6;
  if (lower.includes('bad') || lower.includes('cold') || lower.includes('slow')) return -0.6;
  return 0;
}
