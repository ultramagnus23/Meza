import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ config: null });
    }

    let config = await prisma.digestConfig.findUnique({
      where: { restaurantId: restaurant.id },
    });

    if (!config) {
      config = await prisma.digestConfig.create({
        data: { restaurantId: restaurant.id },
      });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Digest config error:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const config = await prisma.digestConfig.upsert({
      where: { restaurantId: restaurant.id },
      create: {
        restaurantId: restaurant.id,
        isEnabled: data.isEnabled ?? true,
        sendTime: data.sendTime ?? "08:00",
        timezone: data.timezone ?? "Asia/Kolkata",
        lookbackDays: data.lookbackDays ?? 7,
        maxInsights: data.maxInsights ?? 5,
        includeRevenue: data.includeRevenue ?? true,
        includeMenu: data.includeMenu ?? true,
        includeChannel: data.includeChannel ?? true,
        includeServer: data.includeServer ?? true,
      },
      update: {
        isEnabled: data.isEnabled,
        sendTime: data.sendTime,
        timezone: data.timezone,
        lookbackDays: data.lookbackDays,
        maxInsights: data.maxInsights,
        includeRevenue: data.includeRevenue,
        includeMenu: data.includeMenu,
        includeChannel: data.includeChannel,
        includeServer: data.includeServer,
      },
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Update digest config error:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
