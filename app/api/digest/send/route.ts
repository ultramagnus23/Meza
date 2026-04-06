import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const restaurant = await prisma.restaurant.findFirst({
      include: { users: { include: { user: true } } },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 });
    }

    // Get the digest preview message
    const previewRes = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/digest/preview`);
    const { message } = await previewRes.json();

    const recipients = restaurant.users
      .filter((ru) => ru.receiveDigest && ru.user.phone)
      .map((ru) => ru.user.phone!);

    if (recipients.length === 0) {
      return NextResponse.json({ message: "No recipients configured with WhatsApp numbers." });
    }

    // Send via Twilio if configured
    let sent = 0;
    let failed = 0;

    for (const phone of recipients) {
      try {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
          const twilio = (await import("twilio")).default;
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const msgResult = await client.messages.create({
            body: message,
            from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
            to: `whatsapp:${phone}`,
          });

          await prisma.digestLog.create({
            data: {
              restaurantId: restaurant.id,
              recipientPhone: phone,
              status: "SENT",
              whatsappMsgId: msgResult.sid,
              messageBody: message,
              insightCount: (message.match(/•/g) || []).length,
            },
          });
          sent++;
        } else {
          // Log as pending if Twilio not configured
          await prisma.digestLog.create({
            data: {
              restaurantId: restaurant.id,
              recipientPhone: phone,
              status: "PENDING",
              messageBody: message,
              insightCount: (message.match(/•/g) || []).length,
              errorMessage: "Twilio not configured",
            },
          });
        }
      } catch (sendError) {
        const errMsg = sendError instanceof Error ? sendError.message : "Unknown error";
        await prisma.digestLog.create({
          data: {
            restaurantId: restaurant.id,
            recipientPhone: phone,
            status: "FAILED",
            messageBody: message,
            insightCount: 0,
            errorMessage: errMsg,
          },
        });
        failed++;
      }
    }

    return NextResponse.json({
      message: `Digest sent to ${sent} recipients. ${failed > 0 ? `${failed} failed.` : ""}`,
      sent,
      failed,
    });
  } catch (error) {
    console.error("Send digest error:", error);
    return NextResponse.json({ error: "Failed to send digest" }, { status: 500 });
  }
}
