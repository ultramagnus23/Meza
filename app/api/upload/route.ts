import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db'; 
import { ComputationEngine } from '@/server/src/engines/computationEngine'; // CHECK THIS PATH
import { parse } from 'csv-parse/sync';
// Define the shape of your CSV row
interface CsvRow {
  posOrderId: string;
  order_time: string;
  channel: string;
  menu_item: string;
  category: string;
  quantity: string;
  price: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 1. Parse CSV
    const buffer = Buffer.from(await file.arrayBuffer());
    const records = parse(buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV is empty' }, { status: 400 });
    }

    console.log(`[Upload] Processing ${records.length} rows...`);

    const RESTAURANT_ID = 1; // Default ID for single-tenant app

    // 2. Extract Unique Menu Items and Upsert them
    // We need real database IDs for items before we can create orders
    const uniqueItems = new Map<string, { name: string; category: string; price: number }>();
    
    records.forEach(row => {
      if (!uniqueItems.has(row.menu_item)) {
        uniqueItems.set(row.menu_item, {
          name: row.menu_item,
          category: row.category,
          price: parseFloat(row.price)
        });
      }
    });

    // Create/Update Menu Items
    const menuItemMap = new Map<string, string>(); // Name -> ID

    for (const [name, data] of uniqueItems) {
      const item = await prisma.menuItem.upsert({
        where: {
          restaurantId_name: {
            restaurantId: RESTAURANT_ID,
            name: name
          }
        },
        update: { currentPrice: data.price }, // Update price if it changed
        create: {
          restaurantId: RESTAURANT_ID,
          name: name,
          category: data.category,
          currentPrice: data.price,
          isActive: true
        }
      });
      menuItemMap.set(name, item.id);
    }

    // 3. Group Rows by Order ID
    // Convert flat CSV (1 row per item) into nested Order -> Items structure
    const ordersMap = new Map<string, {
      posOrderId: string;
      timestamp: Date;
      channel: string;
      items: { menuItemId: string; quantity: number; price: number }[];
    }>();

    for (const row of records) {
      const orderId = row.posOrderId;
      const existing = ordersMap.get(orderId);
      
      const menuItemId = menuItemMap.get(row.menu_item);
      if (!menuItemId) continue; 

      const itemData = {
        menuItemId: menuItemId,
        quantity: parseInt(row.quantity),
        price: parseFloat(row.price)
      };

      if (existing) {
        existing.items.push(itemData);
      } else {
        ordersMap.set(orderId, {
          posOrderId: row.posOrderId,
          timestamp: new Date(row.order_time),
          channel: row.channel,
          items: [itemData]
        });
      }
    }

    // 4. Save Orders to Database Transactionally
    // We create the Order AND its OrderItems in one go
    const orderInserts = Array.from(ordersMap.values()).map(orderData => {
      const totalAmount = orderData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      
      return prisma.order.create({
        data: {
          restaurantId: RESTAURANT_ID,
          posOrderId: orderData.posOrderId,
          timestamp: orderData.timestamp,
          channel: orderData.channel,
          totalAmount: totalAmount,
          status: 'completed',
          orderItems: {
            create: orderData.items.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              priceAtTime: item.price
            }))
          }
        }
      });
    });

    // Run all inserts
    await prisma.$transaction(orderInserts);
    console.log(`[Upload] Successfully saved ${orderInserts.length} orders.`);

    // 5. TRIGGER THE AI ENGINE
    // This calculates the aggregates, baselines, and insights based on the new data
    console.log("[Upload] Triggering Computation Engine...");
    const engine = new ComputationEngine(prisma);
    
    // Find the date of the latest order to ensure the dashboard focuses on the right time period
    const lastOrderDate = Array.from(ordersMap.values())
      .reduce((latest, curr) => curr.timestamp > latest ? curr.timestamp : latest, new Date(0));
    
    // Run the heavy lifting
    await engine.recomputeAll(RESTAURANT_ID, lastOrderDate);

    return NextResponse.json({ 
      success: true, 
      count: orderInserts.length,
      message: `Processed ${orderInserts.length} orders and generated insights.`
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json({ error: 'Failed to process CSV' }, { status: 500 });
  }
}