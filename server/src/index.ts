import express from "express";
import cors from "cors";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import Papa from "papaparse";
import fs from "fs";
import { startScheduler } from "./scheduler.js";
import { runAssociationsJob } from "./jobs/associations.job.js";
import { runDigestJob } from "./jobs/digest.job.js";

const app = express();
const prisma = new PrismaClient();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), service: "meza-server" });
});

// Get or create restaurant
app.post("/api/restaurants", async (req, res) => {
  try {
    const { name } = req.body;
    let restaurant = await prisma.restaurant.findFirst({ where: { name } });
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({ data: { name } });
    }
    res.json(restaurant);
  } catch (error) {
    console.error("Error creating restaurant:", error);
    res.status(500).json({ error: "Failed to create restaurant" });
  }
});

// Upload CSV and process
app.post("/api/upload-csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const restaurantId = req.body.restaurantId;
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId is required" });
    }

    const fileContent = fs.readFileSync(req.file.path, "utf8");
    const parseResult = Papa.parse(fileContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ error: "CSV parsing failed", details: parseResult.errors });
    }

    const rows = parseResult.data as Record<string, unknown>[];
    let processedCount = 0;

    for (const row of rows) {
      try {
        const timestamp = new Date(String(row.timestamp || row.date || row.order_date || ""));
        if (isNaN(timestamp.getTime())) continue;

        const itemName = String(row.item_name || row.item || row.product || "");
        if (!itemName) continue;

        let menuItem = await prisma.menuItem.findFirst({
          where: { restaurantId, name: itemName },
        });

        if (!menuItem) {
          menuItem = await prisma.menuItem.create({
            data: {
              restaurantId,
              name: itemName,
              category: String(row.category || "Uncategorized"),
              price: parseFloat(String(row.price || "0")) || 0,
              costPrice: parseFloat(String(row.cost || "0")) || 0,
            },
          });
        }

        let serverId: string | null = null;
        const serverName = String(row.server_name || row.server || "");
        if (serverName) {
          let server = await prisma.server.findFirst({
            where: { restaurantId, name: serverName },
          });
          if (!server) {
            server = await prisma.server.create({
              data: { restaurantId, name: serverName },
            });
          }
          serverId = server.id;
        }

        const externalId = String(row.order_id || row.id || "");
        let order = externalId
          ? await prisma.order.findFirst({ where: { restaurantId, externalId } })
          : null;

        if (!order) {
          const total = parseFloat(String(row.total_amount || row.total || row.amount || "0")) || 0;
          const channel = String(row.channel || "DINE_IN").toUpperCase().replace(/ /g, "_");
          const validChannels = ["DINE_IN", "TAKEAWAY", "ZOMATO", "SWIGGY", "DIRECT_DELIVERY", "OTHER"];
          const mappedChannel = validChannels.includes(channel) ? channel : "OTHER";

          order = await prisma.order.create({
            data: {
              restaurantId,
              externalId: externalId || null,
              channel: mappedChannel as "DINE_IN" | "TAKEAWAY" | "ZOMATO" | "SWIGGY" | "DIRECT_DELIVERY" | "OTHER",
              subtotal: total,
              total,
              orderedAt: timestamp,
              serverId,
            },
          });
        }

        const quantity = parseInt(String(row.quantity || "1")) || 1;
        const unitPrice = parseFloat(String(row.price || "0")) || menuItem.price;

        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: menuItem.id,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
          },
        });

        processedCount++;
      } catch (rowError) {
        console.error("Error processing row:", rowError);
      }
    }

    // Trigger associations after import
    await runAssociationsJob(prisma);

    fs.unlinkSync(req.file.path);
    res.json({ success: true, processedRows: processedCount, totalRows: rows.length });
  } catch (error) {
    console.error("Error processing CSV:", error);
    res.status(500).json({ error: "Failed to process CSV" });
  }
});

// Manual trigger for digest
app.post("/api/run-digest", async (_req, res) => {
  try {
    await runDigestJob(prisma);
    res.json({ success: true });
  } catch (error) {
    console.error("Error running digest:", error);
    res.status(500).json({ error: "Failed to run digest" });
  }
});

// Manual trigger for associations
app.post("/api/run-associations", async (_req, res) => {
  try {
    await runAssociationsJob(prisma);
    res.json({ success: true });
  } catch (error) {
    console.error("Error running associations:", error);
    res.status(500).json({ error: "Failed to run associations" });
  }
});

const PORT = process.env.EXPRESS_PORT || process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Meza server running on port ${PORT}`);
  startScheduler(prisma);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit();
});