import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { ComputationEngine } from './engines/computationEngine';
import { ExplainableInsightEngine } from './engines/explainableInsightEngine';

const app = express();
const prisma = new PrismaClient();S
const upload = multer({ dest: 'uploads/' });

// Initialize engines
const computationEngine = new ComputationEngine(prisma);
const insightEngine = new ExplainableInsightEngine(prisma);

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get or create restaurant
app.post('/api/restaurants', async (req, res) => {
  try {
    const { name } = req.body;
    
    let restaurant = await prisma.restaurant.findFirst({
      where: { name },
    });

    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: { name },
      });
    }

    res.json(restaurant);
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

// Upload CSV and process
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const restaurantId = parseInt(req.body.restaurantId);
    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurantId is required' });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse CSV
    const parseResult = Papa.parse(fileContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: 'CSV parsing failed', 
        details: parseResult.errors 
      });
    }

    const rows = parseResult.data as any[];
    console.log(`Processing ${rows.length} rows...`);

    // Process each row
    let processedCount = 0;
    const affectedDates = new Set<Date>();

    for (const row of rows) {
      try {
        // Parse timestamp
        const timestamp = new Date(row.timestamp || row.date || row.order_date);
        if (isNaN(timestamp.getTime())) {
          console.warn('Invalid timestamp in row:', row);
          continue;
        }

        affectedDates.add(timestamp);

        // Get or create menu item
        const itemName = row.item_name || row.item || row.product;
        if (!itemName) continue;

        let menuItem = await prisma.menuItem.findUnique({
          where: {
            restaurantId_name: {
              restaurantId,
              name: itemName,
            },
          },
        });

        if (!menuItem) {
          menuItem = await prisma.menuItem.create({
            data: {
              restaurantId,
              name: itemName,
              category: row.category || 'Uncategorized',
              currentPrice: parseFloat(row.price) || 0,
              cost: row.cost ? parseFloat(row.cost) : null,
            },
          });
        }

        // Get or create server
        let serverId: number | null = null;
        if (row.server_name || row.server) {
          const serverName = row.server_name || row.server;
          let server = await prisma.server.findFirst({
            where: {
              restaurantId,
              name: serverName,
            },
          });

          if (!server) {
            server = await prisma.server.create({
              data: {
                restaurantId,
                name: serverName,
              },
            });
          }
          serverId = server.id;
        }

        // Create or find order
        const orderId = row.order_id || row.id;
        let order = await prisma.order.findFirst({
          where: {
            restaurantId,
            externalId: orderId?.toString(),
            timestamp,
          },
        });

        if (!order) {
          order = await prisma.order.create({
            data: {
              restaurantId,
              externalId: orderId?.toString(),
              timestamp,
              totalAmount: parseFloat(row.total_amount || row.total || row.amount) || 0,
              serverId,
            },
          });
        }

        // Create order item
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: menuItem.id,
            quantity: parseInt(row.quantity) || 1,
            priceAtTime: parseFloat(row.price) || menuItem.currentPrice,
            discountAmount: row.discount ? parseFloat(row.discount) : 0,
          },
        });

        processedCount++;
      } catch (rowError) {
        console.error('Error processing row:', rowError);
      }
    }

    // Trigger recomputation for all affected dates
    console.log('Triggering recomputation...');
    for (const date of affectedDates) {
      await computationEngine.recomputeAll(restaurantId, date);
    }

    // Generate insights
    console.log('Generating insights...');
    await insightEngine.analyzeRevenueChange(restaurantId, 7);

    // Cleanup uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      processedRows: processedCount,
      totalRows: rows.length,
    });
  } catch (error) {
    console.error('Error processing CSV:', error);
    res.status(500).json({ error: 'Failed to process CSV' });
  }
});

// Get comprehensive analytics
app.get('/api/analytics/comprehensive', async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId as string);

    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurantId is required' });
    }

    // Get latest insights
    const insights = await insightEngine.getActiveInsights(restaurantId);

    // Get recent aggregates
    const recentAggregates = await prisma.timeAggregate.findMany({
      where: {
        restaurantId,
        periodType: 'day',
      },
      orderBy: { periodStart: 'desc' },
      take: 30,
      distinct: ['periodStart'],
    });

    // Get menu items with baselines
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId, isActive: true },
      include: {
        baselines: {
          orderBy: { computedAt: 'desc' },
          take: 1,
        },
      },
    });

    res.json({
      insights,
      aggregates: recentAggregates,
      menuItems,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get insights for a restaurant
app.get('/api/insights', async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId as string);
    const insights = await insightEngine.getActiveInsights(restaurantId);
    res.json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Manually trigger recomputation
app.post('/api/recompute', async (req, res) => {
  try {
    const { restaurantId } = req.body;
    await computationEngine.recomputeAll(restaurantId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error recomputing:', error);
    res.status(500).json({ error: 'Failed to recompute' });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});