import { PrismaClient, SessionRole, SignalType } from '@prisma/client';
import { addMinutes, startOfDay, subDays } from 'date-fns';
import { WhatsAppRateLimiter, DEFAULT_RULES } from './rateLimit';

const KEYWORD_COMMANDS: Record<string, string> = {
  PAUSE: 'pause_digest',
  RESUME: 'resume_digest',
  HELP: 'show_help',
  STATUS: 'show_status',
  TODAY: 'todays_numbers',
  WEEK: 'weekly_summary',
  MENU: 'menu_insights',
  CHANNELS: 'channel_insights',
  TEAM: 'server_insights',
  'SEND NOW': 'trigger_digest',
  SETTINGS: 'open_settings_flow',
  REPORT: 'open_report_flow',
};

const ROLE_VALUES = new Set<SessionRole>(['OWNER', 'MANAGER', 'WAITER']);

export class WhatsAppBot {
  private rateLimiter: WhatsAppRateLimiter;

  constructor(private prisma: PrismaClient) {
    this.rateLimiter = new WhatsAppRateLimiter(prisma);
  }

  async processInboundMessage(params: {
    phone: string;
    body: string;
    restaurantId: number;
  }): Promise<{ response: string }> {
    const normalized = params.body.trim();
    const upper = normalized.toUpperCase();

    const user = await this.prisma.user.findFirst({
      where: { phone: params.phone, restaurantId: params.restaurantId },
    });

    const normalizedRole = user?.role?.toUpperCase() as SessionRole | undefined;
    const role = normalizedRole && ROLE_VALUES.has(normalizedRole) ? normalizedRole : 'OWNER';

    await this.prisma.whatsAppInbound.create({
      data: {
        from: params.phone,
        restaurantId: params.restaurantId,
        body: normalized,
      },
    });

    let session = await this.prisma.whatsAppSession.findFirst({
      where: { phone: params.phone, restaurantId: params.restaurantId },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!session || session.expiresAt < new Date()) {
      session = await this.prisma.whatsAppSession.create({
        data: {
          phone: params.phone,
          restaurantId: params.restaurantId,
          userId: user?.id || null,
          role,
          state: 'IDLE',
          context: {},
          expiresAt: addMinutes(new Date(), 30),
        },
      });
    }

    const context = (session.context as Record<string, any>) || {};
    const replyCount = (context.replyCount || 0) + 1;
    context.replyCount = replyCount;

    if (replyCount > DEFAULT_RULES.maxBotRepliesPerSession) {
      await this.updateSession(session.id, 'IDLE', context);
      return { response: 'Session limit reached. Please start again with HELP.' };
    }

    let response = '';
    let nextState = session.state;

    if (session.state.startsWith('SETTINGS')) {
      ({ response, nextState } = await this.handleSettingsFlow(
        params.restaurantId,
        user?.id,
        session.state,
        normalized
      ));
    } else if (session.state === 'WAITER_DETAIL') {
      ({ response, nextState } = await this.handleWaiterDetail(
        params.restaurantId,
        user?.id,
        role,
        normalized,
        context
      ));
    } else if (session.state === 'REPORT_DETAIL') {
      ({ response, nextState } = await this.handleReportDetail(
        params.restaurantId,
        user?.id,
        normalized,
        context
      ));
    } else {
      const intent = KEYWORD_COMMANDS[upper] || '';
      if (intent) {
        ({ response, nextState } = await this.handleCommand(
          params.restaurantId,
          user?.id,
          role,
          intent
        ));
      } else if (role === 'WAITER') {
        ({ response, nextState } = await this.handleWaiterFlow(
          params.restaurantId,
          user?.id,
          normalized,
          context
        ));
      } else {
        response = 'Sorry, I did not understand. Reply HELP for commands.';
        nextState = 'IDLE';
      }
    }

    await this.updateSession(session.id, nextState, context);
    return { response };
  }

  private async handleCommand(
    restaurantId: number,
    userId: string | undefined,
    role: SessionRole,
    intent: string
  ): Promise<{ response: string; nextState: string }> {
    switch (intent) {
      case 'pause_digest':
        await this.updatePreference(restaurantId, userId, { digestEnabled: false });
        return { response: 'Digest paused. Reply RESUME to restart.', nextState: 'IDLE' };
      case 'resume_digest':
        await this.updatePreference(restaurantId, userId, { digestEnabled: true });
        return { response: 'Digest resumed.', nextState: 'IDLE' };
      case 'show_help':
        return { response: this.buildHelp(role), nextState: 'IDLE' };
      case 'show_status':
        return { response: await this.buildStatus(restaurantId, userId), nextState: 'IDLE' };
      case 'todays_numbers':
        return { response: await this.buildTodaySnapshot(restaurantId), nextState: 'IDLE' };
      case 'weekly_summary':
        return { response: await this.buildWeeklySummary(restaurantId), nextState: 'IDLE' };
      case 'menu_insights':
        return { response: await this.buildMenuInsights(restaurantId), nextState: 'IDLE' };
      case 'channel_insights':
        return { response: await this.buildChannelInsights(restaurantId), nextState: 'IDLE' };
      case 'server_insights':
        return { response: await this.buildServerInsights(restaurantId), nextState: 'IDLE' };
      case 'trigger_digest':
        if (role !== 'OWNER') {
          return { response: 'Only owners can trigger a digest.', nextState: 'IDLE' };
        }
        return { response: await this.sendDigest(restaurantId, userId), nextState: 'IDLE' };
      case 'open_settings_flow':
        return { response: this.buildSettingsMenu(), nextState: 'SETTINGS_MENU' };
      case 'open_report_flow':
        return { response: 'Describe the report from the shift.', nextState: 'REPORT_DETAIL' };
      default:
        return { response: 'Command not recognized.', nextState: 'IDLE' };
    }
  }

  private async handleSettingsFlow(
    restaurantId: number,
    userId: string | undefined,
    state: string,
    message: string
  ): Promise<{ response: string; nextState: string }> {
    switch (state) {
      case 'SETTINGS_MENU': {
        if (message.startsWith('1')) return { response: 'Reply with time HH:MM', nextState: 'SETTINGS_TIME' };
        if (message.startsWith('2')) return { response: 'Reply with day numbers (1-7).', nextState: 'SETTINGS_DAYS' };
        if (message.startsWith('3')) return { response: this.buildInsightOptions(), nextState: 'SETTINGS_INSIGHTS' };
        if (message.startsWith('4')) return { response: this.buildThresholdOptions(), nextState: 'SETTINGS_THRESHOLDS' };
        if (message.startsWith('5')) return { response: 'Team management not yet available.', nextState: 'SETTINGS_MENU' };
        return { response: 'Settings saved. Reply HELP for more.', nextState: 'IDLE' };
      }
      case 'SETTINGS_TIME': {
        await this.updatePreference(restaurantId, userId, { digestTime: message });
        return { response: this.buildSettingsMenu(), nextState: 'SETTINGS_MENU' };
      }
      case 'SETTINGS_DAYS': {
        const days = message
          .split(/\s+/)
          .map((value) => Number(value))
          .filter((value) => value >= 1 && value <= 7);
        await this.updatePreference(restaurantId, userId, { digestDays: days });
        return { response: this.buildSettingsMenu(), nextState: 'SETTINGS_MENU' };
      }
      case 'SETTINGS_INSIGHTS': {
        const selections = new Set(message.split(/\s+/));
        await this.updatePreference(restaurantId, userId, {
          wantsMenuInsights: selections.has('1'),
          wantsChannelInsights: selections.has('2'),
          wantsServerInsights: selections.has('3'),
          wantsAssocInsights: selections.has('4'),
          wantsArchetypeInsights: selections.has('5'),
          wantsCustomerInsights: selections.has('6'),
        });
        return { response: this.buildSettingsMenu(), nextState: 'SETTINGS_MENU' };
      }
      case 'SETTINGS_THRESHOLDS': {
        const [key, value] = message.split(' ');
        const num = Number(value);
        if (key?.toUpperCase() === 'REVENUE') {
          await this.updatePreference(restaurantId, userId, { revenueDropThreshold: num / 100, tier: 'CUSTOM' });
        }
        if (key?.toUpperCase() === 'MARGIN') {
          await this.updatePreference(restaurantId, userId, { channelMarginMin: num / 100, tier: 'CUSTOM' });
        }
        if (key?.toUpperCase() === 'REVPASH') {
          await this.updatePreference(restaurantId, userId, { revpashMinThreshold: num, tier: 'CUSTOM' });
        }
        return { response: this.buildSettingsMenu(), nextState: 'SETTINGS_MENU' };
      }
      default:
        return { response: this.buildSettingsMenu(), nextState: 'SETTINGS_MENU' };
    }
  }

  private async handleWaiterFlow(
    restaurantId: number,
    userId: string | undefined,
    message: string,
    context: Record<string, any>
  ): Promise<{ response: string; nextState: string }> {
    const option = Number(message);
    if (!Number.isNaN(option) && option >= 1 && option <= 5) {
      if (option === 5) {
        await this.createWaiterSignal(restaurantId, userId, 'OTHER', 'No issues reported.');
        return { response: 'Thanks! Shift logged.', nextState: 'IDLE' };
      }
      const signalType = waiterSignalTypeFromOption(option);
      context.pendingSignalType = signalType;
      return { response: 'Please share details (dish, table number).', nextState: 'WAITER_DETAIL' };
    }
    return { response: 'Reply with a number (1-5).', nextState: 'IDLE' };
  }

  private async handleWaiterDetail(
    restaurantId: number,
    userId: string | undefined,
    role: SessionRole,
    message: string,
    context: Record<string, any>
  ): Promise<{ response: string; nextState: string }> {
    const signalType = context.pendingSignalType || (role === 'WAITER' ? 'TABLE_FEEDBACK' : 'OTHER');
    await this.createWaiterSignal(restaurantId, userId, signalType, message);
    context.pendingSignalType = null;
    return { response: 'Thanks! Your feedback is recorded.', nextState: 'IDLE' };
  }

  private async handleReportDetail(
    restaurantId: number,
    userId: string | undefined,
    message: string,
    context: Record<string, any>
  ): Promise<{ response: string; nextState: string }> {
    await this.createWaiterSignal(restaurantId, userId, 'TABLE_FEEDBACK', message);
    context.pendingSignalType = null;
    return { response: 'Report submitted. Thank you.', nextState: 'IDLE' };
  }

  private async createWaiterSignal(
    restaurantId: number,
    userId: string | undefined,
    signalType: SignalType,
    body: string
  ): Promise<void> {
    await this.prisma.waiterSignal.create({
      data: {
        restaurantId,
        serverId: null,
        shiftDate: startOfDay(new Date()),
        shiftType: inferShiftType(new Date()),
        signalType,
        body,
        processed: false,
      },
    });
  }

  private buildHelp(role: SessionRole): string {
    if (role === 'WAITER') {
      return 'Reply 1-5 after shift: 1 complaint, 2 request, 3 early bill, 4 good feedback, 5 all good.';
    }
    if (role === 'MANAGER') {
      return 'Commands: TODAY, WEEK, MENU, CHANNELS, TEAM, REPORT, HELP';
    }
    return 'Commands: TODAY, WEEK, MENU, CHANNELS, TEAM, STATUS, SETTINGS, SEND NOW, PAUSE, RESUME, HELP';
  }

  private buildSettingsMenu(): string {
    return `Your current digest settings. What would you like to change?\n1) Change digest time\n2) Change days\n3) Choose insight types\n4) Set alert thresholds (Pro)\n5) Manage team\n6) Done`;
  }

  private buildInsightOptions(): string {
    return `Choose insight types (reply with numbers):\n1) Menu\n2) Channels\n3) Servers\n4) Associations\n5) Archetypes\n6) Customers`;
  }

  private buildThresholdOptions(): string {
    return `Set thresholds:\nREVENUE [percent]\nMARGIN [percent]\nREVPASH [amount]`;
  }

  private async buildStatus(restaurantId: number, userId?: string): Promise<string> {
    const preference = await this.getPreference(restaurantId, userId);
    const lastDigest = await this.prisma.digestLog.findFirst({
      where: { restaurantId, userId: userId || null, messageType: 'DIGEST', status: 'SENT' },
      orderBy: { createdAt: 'desc' },
    });
    const lastSent = lastDigest ? lastDigest.createdAt.toLocaleString() : 'Never';
    return `Digest is ${preference.digestEnabled ? 'ON' : 'OFF'} | Last sent: ${lastSent} | Next: ${preference.digestTime}`;
  }

  private async buildTodaySnapshot(restaurantId: number): Promise<string> {
    const start = startOfDay(new Date());
    const orders = await this.prisma.order.findMany({
      where: { restaurantId, timestamp: { gte: start } },
    });
    const revenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const covers = orders.reduce((sum, order) => sum + (order.guestCount || 0), 0);
    return `Today so far: ₹${revenue.toFixed(0)} revenue, ${orders.length} orders, ${covers} covers.`;
  }

  private async buildWeeklySummary(restaurantId: number): Promise<string> {
    const start = subDays(new Date(), 7);
    const orders = await this.prisma.order.findMany({
      where: { restaurantId, timestamp: { gte: start } },
    });
    const revenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const bestDay = orders.length ? orders[0].timestamp.toLocaleDateString() : 'N/A';
    return `7-day summary: ₹${revenue.toFixed(0)} revenue, ${orders.length} orders. Best day: ${bestDay}.`;
  }

  private async buildMenuInsights(restaurantId: number): Promise<string> {
    const items = await this.prisma.menuItem.findMany({
      where: { restaurantId },
      orderBy: { salesCount: 'desc' },
      take: 3,
    });
    if (items.length === 0) return 'No menu insights yet.';
    const lines = items.map((item) => `${item.name} (${item.salesCount} orders)`);
    return `Top menu items:\n${lines.join('\n')}`;
  }

  private async buildChannelInsights(restaurantId: number): Promise<string> {
    const start = subDays(new Date(), 7);
    const orders = await this.prisma.order.findMany({
      where: { restaurantId, timestamp: { gte: start } },
    });
    const channelMap = new Map<string, { orders: number; revenue: number }>();
    orders.forEach((order) => {
      const entry = channelMap.get(order.channel) || { orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += order.totalAmount;
      channelMap.set(order.channel, entry);
    });
    const lines = Array.from(channelMap.entries()).map(
      ([channel, data]) => `${channel}: ₹${data.revenue.toFixed(0)} (${data.orders})`
    );
    return lines.length ? `Channel snapshot:\n${lines.join('\n')}` : 'No channel data yet.';
  }

  private async buildServerInsights(restaurantId: number): Promise<string> {
    const servers = await this.prisma.server.findMany({
      where: { restaurantId },
    });
    const orders = await this.prisma.order.findMany({
      where: { restaurantId, serverId: { not: null } },
    });
    const revenueByServer = new Map<number, number>();
    orders.forEach((order) => {
      if (!order.serverId) return;
      revenueByServer.set(order.serverId, (revenueByServer.get(order.serverId) || 0) + order.totalAmount);
    });
    const lines = servers
      .map((server) => ({ name: server.name, revenue: revenueByServer.get(server.id) || 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map((server) => `${server.name}: ₹${server.revenue.toFixed(0)}`);
    return lines.length ? `Top servers:\n${lines.join('\n')}` : 'No server data yet.';
  }

  private async sendDigest(restaurantId: number, userId?: string): Promise<string> {
    const phone = await this.resolveUserPhone(restaurantId, userId);
    if (!phone) return 'No phone on file for this user.';

    const rate = await this.rateLimiter.canSend({
      restaurantId,
      phone,
      userId,
      messageType: 'DIGEST',
    });

    if (!rate.allowed) {
      await this.rateLimiter.recordAttempt({
        restaurantId,
        phone,
        userId,
        messageType: 'DIGEST',
        status: 'BLOCKED',
        reason: rate.reason,
      });
      return `Digest blocked: ${rate.reason}`;
    }

    const message = await this.buildTodaySnapshot(restaurantId);
    await this.rateLimiter.recordAttempt({
      restaurantId,
      phone,
      userId,
      messageType: 'DIGEST',
      status: 'SENT',
      message,
    });
    return message;
  }

  private async updatePreference(
    restaurantId: number,
    userId: string | undefined,
    updates: Record<string, any>
  ): Promise<void> {
    if (!userId) return;
    const preference = await this.getPreference(restaurantId, userId);
    await this.prisma.whatsAppPreference.update({
      where: { id: preference.id },
      data: updates,
    });
  }

  private async getPreference(restaurantId: number, userId?: string) {
    if (!userId) {
      return {
        id: 'temp',
        userId: 'temp',
        restaurantId,
        digestEnabled: true,
        digestTime: '08:00',
        digestDays: [1, 2, 3, 4, 5, 6, 7],
        wantsMenuInsights: true,
        wantsChannelInsights: true,
        wantsServerInsights: true,
        wantsAssocInsights: true,
        wantsArchetypeInsights: true,
        wantsCustomerInsights: true,
        revenueDropThreshold: null,
        revpashMinThreshold: null,
        channelMarginMin: null,
        dogItemMinOrders: null,
        alertOnRevenueDrop: false,
        alertOnLowRevpash: false,
        alertOnChannelDrain: false,
        alertOnNewArchetype: false,
        tier: 'MEDIUM',
      };
    }
    const existing = await this.prisma.whatsAppPreference.findUnique({ where: { userId } });
    if (existing) return existing;
    return await this.prisma.whatsAppPreference.create({
      data: {
        userId,
        restaurantId,
        digestDays: [1, 2, 3, 4, 5, 6, 7],
      },
    });
  }

  private async resolveUserPhone(restaurantId: number, userId?: string): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findFirst({ where: { id: userId, restaurantId } });
    return user?.phone || null;
  }

  private async updateSession(
    sessionId: string,
    state: string,
    context: Record<string, any>
  ): Promise<void> {
    await this.prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: {
        state,
        context,
        lastMessageAt: new Date(),
        expiresAt: addMinutes(new Date(), 30),
      },
    });
  }
}

function waiterSignalTypeFromOption(option: number): SignalType {
  switch (option) {
    case 1:
      return 'DISH_COMPLAINT';
    case 2:
      return 'DISH_REQUEST';
    case 3:
      return 'EARLY_BILL';
    case 4:
      return 'POSITIVE_SHOUTOUT';
    default:
      return 'OTHER';
  }
}

function inferShiftType(now: Date): 'BREAKFAST' | 'LUNCH' | 'EVENING' | 'DINNER' {
  const hour = now.getHours();
  if (hour < 11) return 'BREAKFAST';
  if (hour < 15) return 'LUNCH';
  if (hour < 19) return 'EVENING';
  return 'DINNER';
}
