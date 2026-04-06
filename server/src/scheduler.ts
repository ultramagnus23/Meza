import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { runDigestJob } from "./jobs/digest.job.js";
import { runAssociationsJob } from "./jobs/associations.job.js";

export function startScheduler(prisma: PrismaClient): void {
  const tz = process.env.CRON_TIMEZONE || "Asia/Kolkata";

  // Daily digest — default 8 AM IST, but also checks per-restaurant sendTime
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("[Scheduler] Running daily digest job...");
      await runDigestJob(prisma);
    },
    { timezone: tz }
  );

  // Nightly associations recompute — 2 AM IST
  cron.schedule(
    "0 2 * * *",
    async () => {
      console.log("[Scheduler] Running nightly associations job...");
      await runAssociationsJob(prisma);
    },
    { timezone: tz }
  );

  console.log(`[Scheduler] Started. Timezone: ${tz}`);
}
