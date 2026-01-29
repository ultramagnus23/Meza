import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Menu Sync API
 * Syncs menu changes (price, availability) with Swiggy/Zomato
 * This is a mock implementation - actual integration requires API keys
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      menuItemId,
      restaurantId,
      action, // UPDATE_PRICE, UPDATE_AVAILABILITY, SYNC_ALL
      newPrice,
      newSwiggyPrice,
      newZomatoPrice,
      isAvailable,
      platforms, // ['SWIGGY', 'ZOMATO']
    } = body

    if (!menuItemId && action !== "SYNC_ALL") {
      return NextResponse.json(
        { success: false, error: "menuItemId is required" },
        { status: 400 }
      )
    }

    const targetPlatforms = platforms || ["SWIGGY", "ZOMATO"]
    const syncResults: Array<{
      platform: string
      itemName: string
      action: string
      success: boolean
      message: string
      syncedAt: string
    }> = []

    if (action === "SYNC_ALL") {
      // Sync all menu items
      const whereClause: Record<string, unknown> = {}
      if (restaurantId) {
        whereClause.restaurantId = parseInt(restaurantId)
      }

      const menuItems = await prisma.menuItem.findMany({
        where: {
          ...whereClause,
          isActive: true,
        },
      })

      for (const item of menuItems) {
        for (const platform of targetPlatforms) {
          const result = await syncItemToPlatform(item, platform, {
            price: platform === "SWIGGY" ? item.swiggyPrice : item.zomatoPrice,
            isAvailable: item.isActive,
          })
          syncResults.push(result)
        }
      }
    } else {
      // Sync specific item
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: parseInt(menuItemId) },
      })

      if (!menuItem) {
        return NextResponse.json(
          { success: false, error: "Menu item not found" },
          { status: 404 }
        )
      }

      // Update local prices if provided
      const updateData: Record<string, unknown> = {}
      if (newPrice !== undefined) {
        updateData.currentPrice = newPrice
      }
      if (newSwiggyPrice !== undefined) {
        updateData.swiggyPrice = newSwiggyPrice
      }
      if (newZomatoPrice !== undefined) {
        updateData.zomatoPrice = newZomatoPrice
      }
      if (isAvailable !== undefined) {
        updateData.isActive = isAvailable
      }

      // Update in database
      if (Object.keys(updateData).length > 0) {
        await prisma.menuItem.update({
          where: { id: parseInt(menuItemId) },
          data: updateData,
        })
      }

      // Sync to platforms
      for (const platform of targetPlatforms) {
        let platformPrice = menuItem.currentPrice
        if (platform === "SWIGGY") {
          platformPrice = newSwiggyPrice ?? menuItem.swiggyPrice ?? menuItem.currentPrice
        } else if (platform === "ZOMATO") {
          platformPrice = newZomatoPrice ?? menuItem.zomatoPrice ?? menuItem.currentPrice
        }

        const result = await syncItemToPlatform(menuItem, platform, {
          price: platformPrice,
          isAvailable: isAvailable ?? menuItem.isActive,
        })
        syncResults.push(result)
      }
    }

    // Summary
    const successCount = syncResults.filter((r) => r.success).length
    const failureCount = syncResults.length - successCount

    return NextResponse.json({
      success: true,
      data: {
        totalSynced: syncResults.length,
        successCount,
        failureCount,
        results: syncResults,
        message:
          failureCount === 0
            ? "All items synced successfully"
            : `${successCount} synced, ${failureCount} failed`,
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error in menu sync:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * Mock function to sync item to aggregator platform
 * In production, this would call actual Swiggy/Zomato APIs
 */
async function syncItemToPlatform(
  menuItem: { id: number; name: string },
  platform: string,
  data: { price: number | null; isAvailable: boolean }
): Promise<{
  platform: string
  itemName: string
  action: string
  success: boolean
  message: string
  syncedAt: string
}> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Mock success rate of 95%
  const isSuccess = Math.random() > 0.05

  if (isSuccess) {
    return {
      platform,
      itemName: menuItem.name,
      action: data.isAvailable ? "UPDATE" : "MARK_UNAVAILABLE",
      success: true,
      message: `Successfully synced to ${platform}. Price: ₹${data.price?.toFixed(0) || "N/A"}, Available: ${data.isAvailable}`,
      syncedAt: new Date().toISOString(),
    }
  } else {
    return {
      platform,
      itemName: menuItem.name,
      action: "UPDATE",
      success: false,
      message: `Failed to sync to ${platform}. Error: API timeout. Please retry.`,
      syncedAt: new Date().toISOString(),
    }
  }
}

/**
 * GET method to check sync status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get("restaurantId")

    const whereClause: Record<string, unknown> = {}
    if (restaurantId) {
      whereClause.restaurantId = parseInt(restaurantId)
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        ...whereClause,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        currentPrice: true,
        swiggyPrice: true,
        zomatoPrice: true,
        isActive: true,
        updatedAt: true,
      },
    })

    // Check for price discrepancies
    const priceMismatches = menuItems.filter(
      (item) =>
        (item.swiggyPrice && Math.abs(item.swiggyPrice - item.currentPrice) > 1) ||
        (item.zomatoPrice && Math.abs(item.zomatoPrice - item.currentPrice) > 1)
    )

    return NextResponse.json({
      success: true,
      data: {
        totalItems: menuItems.length,
        itemsWithSwiggyPrice: menuItems.filter((i) => i.swiggyPrice).length,
        itemsWithZomatoPrice: menuItems.filter((i) => i.zomatoPrice).length,
        priceMismatchCount: priceMismatches.length,
        priceMismatches: priceMismatches.map((item) => ({
          id: item.id,
          name: item.name,
          dineInPrice: item.currentPrice,
          swiggyPrice: item.swiggyPrice,
          zomatoPrice: item.zomatoPrice,
          swiggyDiff: item.swiggyPrice ? item.swiggyPrice - item.currentPrice : null,
          zomatoDiff: item.zomatoPrice ? item.zomatoPrice - item.currentPrice : null,
        })),
        recommendation:
          priceMismatches.length > 0
            ? `${priceMismatches.length} items have different prices on aggregators. Consider syncing.`
            : "All prices are in sync.",
      },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Error checking menu sync status:", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
