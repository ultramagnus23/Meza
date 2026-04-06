import { Insight } from "./insight.engine.js";

export function formatWhatsAppDigest(
  restaurantName: string,
  insights: Insight[],
  maxInsights: number = 5
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const topInsights = insights.slice(0, maxInsights);

  let message = `🍽️ *Meza Digest* — ${dateStr}\n`;
  message += `Namaste ${restaurantName}! 🙏\n\n`;

  if (topInsights.length === 0) {
    message += `No new insights today. Keep collecting data!\n\n`;
  } else {
    const icons: Record<string, string> = {
      revenue_trend: "📊",
      top_item: "⭐",
      slow_item: "📉",
      top_channel: "📦",
      high_discount: "⚠️",
      server_gap: "👥",
      association: "🔗",
    };

    topInsights.forEach((insight, idx) => {
      const icon = icons[insight.type] || "💡";
      message += `${icon} *${idx + 1}. ${insight.headline}*\n`;
      message += `${insight.detail}\n`;
      message += `→ _${insight.action}_\n\n`;
    });
  }

  message += `──────────────────\n`;
  message += `_Powered by Meza · Reply STOP to unsubscribe_`;

  return message;
}
