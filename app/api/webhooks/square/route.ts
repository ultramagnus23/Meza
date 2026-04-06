import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const secret = process.env.SQUARE_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get("x-square-hmacsha256-signature");
      const url = req.url;
      const expected = crypto.createHmac("sha256", secret).update(url + body).digest("base64");
      if (signature !== expected) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    if (payload.type === "payment.completed" || payload.type === "order.updated") {
      await processSquareOrder(payload);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Square webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function processSquareOrder(payload: Record<string, unknown>) {
  const restaurant = await prisma.restaurant.findFirst({
    where: { posSystem: "SQUARE" },
  });
  if (!restaurant) return;

  const orderData = (payload.data as Record<string, unknown>)?.object as Record<string, unknown> | undefined;
  if (!orderData) return;

  const total = Number((orderData.total_money as Record<string, unknown>)?.amount || 0) / 100; // Square uses cents

  await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      externalId: String(orderData.id || ""),
      channel: "DINE_IN",
      subtotal: total,
      total,
      orderedAt: orderData.created_at ? new Date(orderData.created_at as string) : new Date(),
    },
  });
}
