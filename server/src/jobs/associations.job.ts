import { PrismaClient } from "@prisma/client";
import { computeAssociations, saveAssociations } from "../engines/association.engine.js";

export async function runAssociationsJob(prisma: PrismaClient): Promise<void> {
  console.log("[Associations Job] Starting...");

  const restaurants = await prisma.restaurant.findMany();

  for (const restaurant of restaurants) {
    try {
      console.log(`[Associations Job] Computing for restaurant: ${restaurant.name}`);
      const rules = await computeAssociations(prisma, restaurant.id);
      await saveAssociations(prisma, restaurant.id, rules);
      console.log(`[Associations Job] Saved ${rules.length} rules for ${restaurant.name}`);
    } catch (error) {
      console.error(`[Associations Job] Error for ${restaurant.name}:`, error);
    }
  }

  console.log("[Associations Job] Complete");
}
