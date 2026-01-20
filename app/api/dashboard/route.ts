import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
// MAKE SURE THESE PATHS MATCH YOUR FILE STRUCTURE
import { ExplainableInsightEngine } from '@/server/src/engines/explainableInsightEngine';
import { ComputationEngine } from '@/server/src/engines/computationEngine';

export async function GET() {
  try {
    const RESTAURANT_ID = 1;
    const insightEngine = new ExplainableInsightEngine(prisma);
    
    // 1. Get Real-time Revenue Analysis
    const revenueInsight = await insightEngine.analyzeRevenueChange(RESTAURANT_ID, 7);

    // 2. Get Historical Active Insights
    const activeInsights = await insightEngine.getActiveInsights(RESTAURANT_ID);

    // 3. Get basic daily stats
    const today = new Date();
    const startOfDay = new Date(today.setHours(0,0,0,0));
    
    const dailyStats = await prisma.timeAggregate.findFirst({
        where: { 
            restaurantId: RESTAURANT_ID, 
            periodType: 'day',
            periodStart: startOfDay 
        },
        orderBy: { version: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: dailyStats || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
        mainInsight: revenueInsight,
        alerts: activeInsights
      }
    });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch data" }, { status: 500 });
  }
}