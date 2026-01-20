-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT,
    "restaurantId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "serverId" INTEGER,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceAtTime" REAL NOT NULL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "currentPrice" REAL NOT NULL,
    "cost" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Server" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Server_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TimeAggregate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantId" INTEGER NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalRevenue" REAL NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "avgOrderValue" REAL NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "uniqueItems" INTEGER NOT NULL,
    "hourOfDay" INTEGER,
    "dayOfWeek" INTEGER,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "TimeAggregate_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemBaseline" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "menuItemId" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "avgDailyQuantity" REAL NOT NULL,
    "stdDevQuantity" REAL NOT NULL,
    "avgDailyRevenue" REAL NOT NULL,
    "stdDevRevenue" REAL NOT NULL,
    "priceElasticity" REAL,
    "seasonalityIndex" REAL,
    "trendSlope" REAL,
    "sampleSize" INTEGER NOT NULL,
    "confidenceScore" REAL NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ItemBaseline_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "causalFactors" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "assumptions" TEXT NOT NULL,
    "sampleSize" INTEGER,
    "confidenceScore" REAL NOT NULL,
    "recommendation" TEXT,
    "decisionId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "Insight_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Insight_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "recommendation" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "predictedImpact" TEXT NOT NULL,
    "simulationId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userFeedback" TEXT,
    "implementedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Decision_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Decision_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DecisionOutcome" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "decisionId" INTEGER NOT NULL,
    "actualImpact" TEXT NOT NULL,
    "accuracyScore" REAL NOT NULL,
    "errorAnalysis" TEXT NOT NULL,
    "beforeMetrics" TEXT NOT NULL,
    "afterMetrics" TEXT NOT NULL,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "daysSinceImpl" INTEGER NOT NULL,
    CONSTRAINT "DecisionOutcome_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "inputParams" TEXT NOT NULL,
    "assumptions" TEXT NOT NULL,
    "assumptionSource" TEXT NOT NULL,
    "projectedMetrics" TEXT NOT NULL,
    "confidenceScore" REAL NOT NULL,
    "sensitivityData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Simulation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Order_restaurantId_timestamp_idx" ON "Order"("restaurantId", "timestamp");

-- CreateIndex
CREATE INDEX "Order_timestamp_idx" ON "Order"("timestamp");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_restaurantId_name_key" ON "MenuItem"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "Server_restaurantId_idx" ON "Server"("restaurantId");

-- CreateIndex
CREATE INDEX "TimeAggregate_restaurantId_periodType_periodStart_idx" ON "TimeAggregate"("restaurantId", "periodType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "TimeAggregate_restaurantId_periodType_periodStart_periodEnd_version_key" ON "TimeAggregate"("restaurantId", "periodType", "periodStart", "periodEnd", "version");

-- CreateIndex
CREATE INDEX "ItemBaseline_menuItemId_periodEnd_idx" ON "ItemBaseline"("menuItemId", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ItemBaseline_menuItemId_periodEnd_version_key" ON "ItemBaseline"("menuItemId", "periodEnd", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Insight_decisionId_key" ON "Insight"("decisionId");

-- CreateIndex
CREATE INDEX "Insight_restaurantId_createdAt_idx" ON "Insight"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Insight_type_severity_idx" ON "Insight"("type", "severity");

-- CreateIndex
CREATE INDEX "Decision_restaurantId_status_idx" ON "Decision"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "Decision_entityType_entityId_idx" ON "Decision"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionOutcome_decisionId_key" ON "DecisionOutcome"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionOutcome_accuracyScore_idx" ON "DecisionOutcome"("accuracyScore");

-- CreateIndex
CREATE INDEX "Simulation_restaurantId_type_idx" ON "Simulation"("restaurantId", "type");
