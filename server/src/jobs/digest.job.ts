import { PrismaClient } from "@prisma/client";
import { generateInsights } from "../engines/insight.engine.js";
import { formatWhatsAppDigest } from "../engines/message.engine.js";
import { sendWhatsAppMessage } from "../whatsapp/twilio.client.js";
import { sendWhatsAppMessageMeta } from "../whatsapp/meta.client.js";

export async function runDigestJob(prisma: PrismaClient): Promise<void> {
  console.log("[Digest Job] Starting...");

  const restaurants = await prisma.restaurant.findMany({
    include: {
      users: { include: { user: true } },
      digestConfigs: true,
    },
  });

  for (const restaurant of restaurants) {
    try {
      const config = restaurant.digestConfigs[0];
      if (!config || !config.isEnabled) continue;

      console.log(`[Digest Job] Processing ${restaurant.name}`);

      const insights = await generateInsights(prisma, restaurant.id, config.lookbackDays, {
        includeRevenue: config.includeRevenue,
        includeMenu: config.includeMenu,
        includeChannel: config.includeChannel,
        includeServer: config.includeServer,
      });

      const message = formatWhatsAppDigest(restaurant.name, insights, config.maxInsights);

      const recipients = restaurant.users.filter(
        (ru) => ru.receiveDigest && ru.user.phone
      );

      for (const ru of recipients) {
        const phone = ru.user.phone!;
        let result = await sendWhatsAppMessage(phone, message);

        // Fallback to Meta if Twilio fails
        if (!result.success) {
          result = await sendWhatsAppMessageMeta(phone, message);
        }

        await prisma.digestLog.create({
          data: {
            restaurantId: restaurant.id,
            recipientPhone: phone,
            status: result.success ? "SENT" : "FAILED",
            whatsappMsgId: result.messageId,
            messageBody: message,
            insightCount: insights.length,
            errorMessage: result.error,
          },
        });
      }
    } catch (error) {
      console.error(`[Digest Job] Error for ${restaurant.name}:`, error);
    }
  }

  console.log("[Digest Job] Complete");
}
