import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 });
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return NextResponse.json({ error: "No restaurant found. Create one first." }, { status: 404 });
    }

    let imported = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

        const orderedAt = new Date(row.timestamp || row.date || row.ordered_at || row.order_date);
        if (isNaN(orderedAt.getTime())) { errors++; continue; }

        const total = parseFloat(row.total || row.total_amount || row.amount || "0");
        const channel = (row.channel || "DINE_IN").toUpperCase().replace(/ /g, "_");
        const validChannels = ["DINE_IN", "TAKEAWAY", "ZOMATO", "SWIGGY", "DIRECT_DELIVERY", "OTHER"];
        const mappedChannel = validChannels.includes(channel) ? channel : "OTHER";

        // Get or create menu item if item_name is present
        let menuItemId: string | null = null;
        if (row.item_name || row.item) {
          const itemName = row.item_name || row.item;
          let menuItem = await prisma.menuItem.findFirst({
            where: { restaurantId: restaurant.id, name: itemName },
          });
          if (!menuItem) {
            menuItem = await prisma.menuItem.create({
              data: {
                restaurantId: restaurant.id,
                name: itemName,
                category: row.category || "Uncategorized",
                price: parseFloat(row.price || "0"),
                costPrice: parseFloat(row.cost || "0"),
              },
            });
          }
          menuItemId = menuItem.id;
        }

        // Get or create order
        const externalId = row.order_id || row.id;
        let order = externalId
          ? await prisma.order.findFirst({
              where: { restaurantId: restaurant.id, externalId },
            })
          : null;

        if (!order) {
          order = await prisma.order.create({
            data: {
              restaurantId: restaurant.id,
              externalId: externalId || null,
              channel: mappedChannel as "DINE_IN" | "TAKEAWAY" | "ZOMATO" | "SWIGGY" | "DIRECT_DELIVERY" | "OTHER",
              subtotal: parseFloat(row.subtotal || String(total)),
              tax: parseFloat(row.tax || "0"),
              discount: parseFloat(row.discount || "0"),
              total,
              orderedAt,
              partySize: row.party_size ? parseInt(row.party_size) : null,
            },
          });
        }

        // Create order item if we have a menu item
        if (menuItemId && order) {
          const quantity = parseInt(row.quantity || "1");
          const unitPrice = parseFloat(row.price || String(total));
          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              menuItemId,
              quantity,
              unitPrice,
              totalPrice: unitPrice * quantity,
            },
          });
        }

        imported++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      errors,
      total: lines.length - 1,
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
