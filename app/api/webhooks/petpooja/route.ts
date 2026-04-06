import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.PETPOOJA_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get("x-petpooja-signature");
      const body = await req.text();
      const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
      if (signature !== expected) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
      const payload = JSON.parse(body);
      await processPetpoojaOrder(payload);
    } else {
      const payload = await req.json();
      await processPetpoojaOrder(payload);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Petpooja webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function processPetpoojaOrder(payload: Record<string, unknown>) {
  const restaurant = await prisma.restaurant.findFirst({
    where: { posSystem: "PETPOOJA" },
  });
  if (!restaurant) return;
  // Basic order ingestion from Petpooja format
  // Adapt field names to match Petpooja's actual API response
  const orderId = payload.orderid || payload.order_id;
  if (!orderId) return;

  await prisma.order.upsert({
    where: { id: `petpooja-${orderId}` },
    create: {
      id: `petpooja-${orderId}`,
      restaurantId: restaurant.id,
      externalId: String(orderId),
      channel: "DINE_IN",
      subtotal: Number(payload.subtotal) || 0,
      tax: Number(payload.tax) || 0,
      discount: Number(payload.discount) || 0,
      total: Number(payload.total) || 0,
      orderedAt: payload.orderdate ? new Date(payload.orderdate as string) : new Date(),
    },
    update: {
      total: Number(payload.total) || 0,
    },
  });
}
