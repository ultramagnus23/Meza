import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ associations: [] });
    }

    const associations = await prisma.itemAssociation.findMany({
      where: { restaurantId: restaurant.id },
      include: {
        itemA: { select: { name: true } },
        itemB: { select: { name: true } },
      },
      orderBy: { lift: "desc" },
      take: 50,
    });

    const result = associations.map((a) => ({
      id: a.id,
      itemAName: a.itemA.name,
      itemBName: a.itemB.name,
      support: a.support,
      confidence: a.confidence,
      lift: a.lift,
      occurrences: a.occurrences,
    }));

    return NextResponse.json({ associations: result });
  } catch (error) {
    console.error("Associations error:", error);
    return NextResponse.json({ error: "Failed to fetch associations" }, { status: 500 });
  }
}
