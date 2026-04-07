import { PrismaClient } from '@prisma/client';
import { addDays, addHours, addMinutes, startOfDay } from 'date-fns';

export type MessageType = 'DIGEST' | 'ALERT' | 'BOT_REPLY' | 'WAITER_PROMPT';

export interface OutboundRules {
  maxDigestPerDay: number;
  maxAlertPerDay: number;
  maxAlertPerHour: number;
  maxBotRepliesPerSession: number;
  alertCooldownMinutes: number;
  digestCooldownHours: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxWaiterPromptsPerShift: number;
}

export const DEFAULT_RULES: OutboundRules = {
  maxDigestPerDay: 1,
  maxAlertPerDay: 3,
  maxAlertPerHour: 1,
  maxBotRepliesPerSession: 20,
  alertCooldownMinutes: 60,
  digestCooldownHours: 20,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
  maxWaiterPromptsPerShift: 1,
};

export class WhatsAppRateLimiter {
  constructor(private prisma: PrismaClient, private rules: OutboundRules = DEFAULT_RULES) {}

  async canSend(params: {
    restaurantId: number;
    phone: string;
    userId?: string | null;
    messageType: MessageType;
    alertType?: string;
    now?: Date;
  }): Promise<{ allowed: boolean; reason?: string; nextAllowedAt?: Date }> {
    const now = params.now || new Date();
    const quietCheck = this.checkQuietHours(now);
    if (!quietCheck.allowed) return quietCheck;

    if (params.messageType === 'DIGEST') {
      const digestCount = await this.countMessages(params, 'DIGEST', startOfDay(now));
      if (digestCount >= this.rules.maxDigestPerDay) {
        return { allowed: false, reason: 'Daily digest limit reached' };
      }
      const lastDigest = await this.findLastMessage(params, 'DIGEST');
      if (lastDigest) {
        const cooldownUntil = addHours(lastDigest.createdAt, this.rules.digestCooldownHours);
        if (cooldownUntil > now) {
          return { allowed: false, reason: 'Digest cooldown active', nextAllowedAt: cooldownUntil };
        }
      }
    }

    if (params.messageType === 'ALERT') {
      const dailyAlerts = await this.countMessages(params, 'ALERT', startOfDay(now));
      if (dailyAlerts >= this.rules.maxAlertPerDay) {
        return { allowed: false, reason: 'Daily alert limit reached' };
      }
      const hourlyAlerts = await this.countMessages(
        params,
        'ALERT',
        addMinutes(now, -60)
      );
      if (hourlyAlerts >= this.rules.maxAlertPerHour) {
        return { allowed: false, reason: 'Hourly alert limit reached' };
      }
      if (params.alertType) {
        const lastAlert = await this.findLastMessage(params, 'ALERT', params.alertType);
        if (lastAlert) {
          const cooldownUntil = addMinutes(lastAlert.createdAt, this.rules.alertCooldownMinutes);
          if (cooldownUntil > now) {
            return { allowed: false, reason: 'Alert cooldown active', nextAllowedAt: cooldownUntil };
          }
        }
      }
    }

    return { allowed: true };
  }

  async shouldBatchAlerts(params: {
    restaurantId: number;
    phone: string;
    userId?: string | null;
  }): Promise<boolean> {
    const recent = await this.findLastMessage(params, 'ALERT');
    if (!recent) return false;
    const cutoff = addMinutes(new Date(), -30);
    return recent.createdAt >= cutoff;
  }

  async recordAttempt(params: {
    restaurantId: number;
    phone: string;
    userId?: string | null;
    messageType: MessageType;
    status: 'SENT' | 'BLOCKED' | 'QUEUED';
    reason?: string;
    message?: string;
  }): Promise<void> {
    await this.prisma.digestLog.create({
      data: {
        restaurantId: params.restaurantId,
        userId: params.userId || null,
        phone: params.phone,
        messageType: params.messageType,
        status: params.status,
        reason: params.reason,
        message: params.message,
      },
    });
  }

  private async countMessages(
    params: { restaurantId: number; phone: string; userId?: string | null },
    messageType: MessageType,
    since: Date
  ): Promise<number> {
    return await this.prisma.digestLog.count({
      where: {
        restaurantId: params.restaurantId,
        phone: params.phone,
        messageType,
        status: 'SENT',
        createdAt: { gte: since },
      },
    });
  }

  private async findLastMessage(
    params: { restaurantId: number; phone: string; userId?: string | null },
    messageType: MessageType,
    alertType?: string
  ) {
    return await this.prisma.digestLog.findFirst({
      where: {
        restaurantId: params.restaurantId,
        phone: params.phone,
        messageType,
        ...(alertType ? { reason: alertType } : {}),
        status: 'SENT',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private checkQuietHours(now: Date): { allowed: boolean; reason?: string; nextAllowedAt?: Date } {
    const [quietStartHour, quietStartMinute] = this.rules.quietHoursStart.split(':').map(Number);
    const [quietEndHour, quietEndMinute] = this.rules.quietHoursEnd.split(':').map(Number);

    const start = new Date(now);
    start.setHours(quietStartHour, quietStartMinute, 0, 0);
    const end = new Date(now);
    end.setHours(quietEndHour, quietEndMinute, 0, 0);

    if (quietStartHour > quietEndHour) {
      if (now >= start || now <= end) {
        const nextAllowed = now >= start ? addDays(end, 1) : end;
        return { allowed: false, reason: 'Quiet hours', nextAllowedAt: nextAllowed };
      }
    } else if (now >= start && now <= end) {
      return { allowed: false, reason: 'Quiet hours', nextAllowedAt: end };
    }

    return { allowed: true };
  }
}
