import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const restaurant = restaurantId
      ? await prisma.restaurant.findFirst({ where: { id: restaurantId } })
      : await prisma.restaurant.findFirst();

    if (!restaurant) {
      return NextResponse.json({ orders: [], total: 0 });
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { restaurantId: restaurant.id },
        include: {
          items: { include: { menuItem: true } },
          server: true,
        },
        orderBy: { orderedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.order.count({ where: { restaurantId: restaurant.id } }),
    ]);

    return NextResponse.json({ orders, total });
  } catch (error) {
    console.error("Orders error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found" }, { status: 404 });
    }

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        channel: data.channel || "DINE_IN",
        subtotal: data.subtotal || 0,
        tax: data.tax || 0,
        discount: data.discount || 0,
        total: data.total || 0,
        partySize: data.partySize || null,
        orderedAt: data.orderedAt ? new Date(data.orderedAt) : new Date(),
        tableNumber: data.tableNumber || null,
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
