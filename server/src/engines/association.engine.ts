import { PrismaClient } from "@prisma/client";

interface BasketItem {
  orderId: string;
  itemIds: string[];
}

interface AssociationRule {
  itemAId: string;
  itemBId: string;
  support: number;
  confidence: number;
  lift: number;
  occurrences: number;
}

export async function computeAssociations(
  prisma: PrismaClient,
  restaurantId: string,
  lookbackDays: number = 90,
  minSupport: number = 0.02,
  minConfidence: number = 0.3,
  minLift: number = 1.2
): Promise<AssociationRule[]> {
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  // Fetch all orders with their items
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      orderedAt: { gte: since },
    },
    include: {
      items: {
        select: { menuItemId: true },
      },
    },
  });

  // Build basket list (only orders with 2+ items)
  const baskets: BasketItem[] = orders
    .map((order) => ({
      orderId: order.id,
      itemIds: [...new Set(order.items.map((i) => i.menuItemId))],
    }))
    .filter((b) => b.itemIds.length >= 2);

  if (baskets.length === 0) return [];

  const totalOrders = orders.length;
  if (totalOrders === 0) return [];

  // Count individual item frequency
  const itemFreq = new Map<string, number>();
  for (const basket of baskets) {
    for (const itemId of basket.itemIds) {
      itemFreq.set(itemId, (itemFreq.get(itemId) || 0) + 1);
    }
  }

  // Count pair frequency
  const pairFreq = new Map<string, number>();
  for (const basket of baskets) {
    const items = basket.itemIds.sort();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const key = `${items[i]}__${items[j]}`;
        pairFreq.set(key, (pairFreq.get(key) || 0) + 1);
      }
    }
  }

  // Generate association rules
  const rules: AssociationRule[] = [];

  for (const [pairKey, pairCount] of pairFreq.entries()) {
    const [itemAId, itemBId] = pairKey.split("__");
    const support = pairCount / totalOrders;

    if (support < minSupport) continue;

    const freqA = itemFreq.get(itemAId) || 0;
    const freqB = itemFreq.get(itemBId) || 0;

    if (freqA === 0 || freqB === 0) continue;

    // A → B
    const confidenceAB = pairCount / freqA;
    const liftAB = confidenceAB / (freqB / totalOrders);

    if (confidenceAB >= minConfidence && liftAB >= minLift) {
      rules.push({
        itemAId,
        itemBId,
        support,
        confidence: confidenceAB,
        lift: liftAB,
        occurrences: pairCount,
      });
    }

    // B → A
    const confidenceBA = pairCount / freqB;
    const liftBA = confidenceBA / (freqA / totalOrders);

    if (confidenceBA >= minConfidence && liftBA >= minLift) {
      rules.push({
        itemAId: itemBId,
        itemBId: itemAId,
        support,
        confidence: confidenceBA,
        lift: liftBA,
        occurrences: pairCount,
      });
    }
  }

  // Sort by lift descending
  rules.sort((a, b) => b.lift - a.lift);

  return rules;
}

export async function saveAssociations(
  prisma: PrismaClient,
  restaurantId: string,
  rules: AssociationRule[]
): Promise<void> {
  // Upsert each rule
  for (const rule of rules) {
    await prisma.itemAssociation.upsert({
      where: {
        restaurantId_itemAId_itemBId: {
          restaurantId,
          itemAId: rule.itemAId,
          itemBId: rule.itemBId,
        },
      },
      create: {
        restaurantId,
        itemAId: rule.itemAId,
        itemBId: rule.itemBId,
        support: rule.support,
        confidence: rule.confidence,
        lift: rule.lift,
        occurrences: rule.occurrences,
      },
      update: {
        support: rule.support,
        confidence: rule.confidence,
        lift: rule.lift,
        occurrences: rule.occurrences,
        computedAt: new Date(),
      },
    });
  }
}
