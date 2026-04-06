import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findFirst();
    return NextResponse.json({ restaurant });
  } catch (error) {
    console.error("Get restaurant error:", error);
    return NextResponse.json({ error: "Failed to fetch restaurant" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const restaurant = await prisma.restaurant.create({
      data: {
        name: data.name || "My Restaurant",
        city: data.city || "",
        timezone: data.timezone || "Asia/Kolkata",
        currency: data.currency || "INR",
        totalSeats: data.totalSeats || 40,
        hoursOpen: data.hoursOpen || 12,
      },
    });
    return NextResponse.json({ restaurant });
  } catch (error) {
    console.error("Create restaurant error:", error);
    return NextResponse.json({ error: "Failed to create restaurant" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        name: data.name,
        city: data.city,
        timezone: data.timezone,
        currency: data.currency,
        totalSeats: data.totalSeats ? parseInt(data.totalSeats) : undefined,
        hoursOpen: data.hoursOpen ? parseFloat(data.hoursOpen) : undefined,
        posSystem: data.posSystem,
      },
    });
    return NextResponse.json({ restaurant: updated });
  } catch (error) {
    console.error("Update restaurant error:", error);
    return NextResponse.json({ error: "Failed to update restaurant" }, { status: 500 });
  }
}
