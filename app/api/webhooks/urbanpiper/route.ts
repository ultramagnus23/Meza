import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.URBANPIPER_WEBHOOK_SECRET;
    const body = await req.text();
    if (secret) {
      const signature = req.headers.get("x-hub-signature-256");
      const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
      if (signature !== expected) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }
    const payload = JSON.parse(body);
    await processUrbanPiperOrder(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("UrbanPiper webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function processUrbanPiperOrder(payload: Record<string, unknown>) {
  const restaurant = await prisma.restaurant.findFirst({
    where: { posSystem: "URBANPIPER" },
  });
  if (!restaurant) return;

  const order = payload.order as Record<string, unknown> | undefined;
  if (!order) return;

  const channel = String(order.channel || "OTHER").toUpperCase();
  const validChannels = ["DINE_IN", "TAKEAWAY", "ZOMATO", "SWIGGY", "DIRECT_DELIVERY", "OTHER"];
  const mappedChannel = validChannels.includes(channel) ? channel : "OTHER";

  await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      externalId: String(order.id || ""),
      channel: mappedChannel as "DINE_IN" | "TAKEAWAY" | "ZOMATO" | "SWIGGY" | "DIRECT_DELIVERY" | "OTHER",
      subtotal: Number(order.subtotal) || 0,
      tax: Number(order.tax) || 0,
      discount: Number(order.discount) || 0,
      total: Number(order.total) || 0,
      orderedAt: order.created_at ? new Date(order.created_at as string) : new Date(),
    },
  });
}
