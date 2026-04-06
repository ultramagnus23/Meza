import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { MenuItem } from "@/lib/types"

export async function GET() {
  try {
    const menuItems = await prisma.menuItem.findMany({
      include: {
        orderItems: true,
      },
    })

    const result: MenuItem[] = menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      costPrice: item.costPrice,
      prepTimeMin: item.prepTimeMin,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
