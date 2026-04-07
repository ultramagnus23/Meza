import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';

const DEFAULT_CLUSTER_CANDIDATES = [4, 5, 6];
const MIN_SILHOUETTE_IMPROVEMENT = 0.05;

type FeatureVector = {
  customerId: string;
  vector: number[];
  raw: {
    avgSpend: number;
    totalSpend: number;
    visitFrequency: number;
    avgPartySize: number;
    lunchProportion: number;
    dineinProportion: number;
    deliveryProportion: number;
    dessertProportion: number;
    drinkProportion: number;
    spendVariance: number;
    dayOfWeekEntropy: number;
    itemCounts: Record<string, number>;
  };
};

export class ArchetypeEngine {
  constructor(private prisma: PrismaClient) {}

  async run(restaurantId: number): Promise<void> {
    const customers = await this.prisma.customer.findMany({
      where: { restaurantId },
      include: {
        visits: {
          include: {
            order: {
              include: {
                orderItems: { include: { menuItem: true } },
              },
            },
          },
        },
      },
    });

    if (customers.length === 0) return;

    const featureVectors = this.buildFeatureVectors(customers);
    if (featureVectors.length < 4) return;

    const normalizedVectors = normalizeFeatures(featureVectors);
    const candidateKs = DEFAULT_CLUSTER_CANDIDATES.filter((k) => k <= normalizedVectors.length);
    let best = runKMeans(normalizedVectors, candidateKs[0]);
    let bestScore = silhouetteScore(normalizedVectors, best.assignments);

    for (const k of candidateKs.slice(1)) {
      const candidate = runKMeans(normalizedVectors, k);
      const score = silhouetteScore(normalizedVectors, candidate.assignments);
      if (score > bestScore + MIN_SILHOUETTE_IMPROVEMENT) {
        best = candidate;
        bestScore = score;
      }
    }

    const clusters = buildClusters(normalizedVectors, best.assignments);
    const totalRevenue = customers.reduce((sum, customer) => sum + customer.totalSpend, 0) || 1;

    await this.prisma.customerArchetype.deleteMany({ where: { restaurantId } });

    for (const cluster of clusters) {
      const summary = summarizeCluster(cluster);
      const { name, description } = nameArchetype(summary);
      const archetype = await this.prisma.customerArchetype.create({
        data: {
          restaurantId,
          name,
          description,
          avgSpend: summary.avgSpend,
          avgPartySize: summary.avgPartySize,
          preferredTime: summary.preferredTime,
          preferredChannel: summary.preferredChannel,
          visitFrequency: summary.visitFrequency.toFixed(2),
          customerCount: cluster.length,
          revenueShare: summary.clusterRevenue / totalRevenue,
          topItems: summary.topItems,
        },
      });

      await this.prisma.customer.updateMany({
        where: { id: { in: cluster.map((item) => item.customerId) } },
        data: { archetypeId: archetype.id },
      });

      if (summary.avgSpend > summary.spendHighThreshold && summary.visitFrequency < 1.5) {
        await this.prisma.insight.create({
          data: {
            restaurantId,
            type: 'ARCHETYPE_OPPORTUNITY',
            severity: 'info',
            observation: `${name} customers spend ₹${summary.avgSpend.toFixed(0)} per visit but come ${summary.visitFrequency.toFixed(1)}x/month.`,
            explanation: description,
            causalFactors: '[]',
            formula: '',
            assumptions: '[]',
            confidenceScore: 0.55,
          },
        });
      }
    }
  }

  private buildFeatureVectors(customers: Array<any>): FeatureVector[] {
    const vectors: FeatureVector[] = [];
    const recentThreshold = subDays(new Date(), 30);

    for (const customer of customers) {
      const visits = customer.visits;
      if (visits.length === 0) continue;

      const spendValues = visits.map((visit: any) => visit.totalSpend);
      const totalSpend = spendValues.reduce((sum, value) => sum + value, 0);
      const avgSpend = spendValues.reduce((sum, value) => sum + value, 0) / visits.length;
      const visitFrequency = visits.filter((visit: any) => visit.visitedAt >= recentThreshold).length;
      const avgPartySize =
        visits.reduce((sum: number, visit: any) => sum + (visit.partySize || 1), 0) /
        visits.length;

      const lunchVisits = visits.filter((visit: any) => getTimeband(visit.visitedAt) === 'LUNCH').length;
      const lunchProportion = lunchVisits / visits.length;

      const dineinVisits = visits.filter((visit: any) => visit.channel === 'DIRECT').length;
      const dineinProportion = dineinVisits / visits.length;
      const deliveryProportion = 1 - dineinProportion;

      let dessertVisits = 0;
      let drinkVisits = 0;
      const itemCounts: Record<string, number> = {};
      for (const visit of visits) {
        const orderItems = visit.order?.orderItems || [];
        const categories = orderItems.map((item: any) => item.menuItem?.category?.toLowerCase() || '');
        if (categories.some((category: string) => category.includes('dessert'))) dessertVisits += 1;
        if (categories.some((category: string) => category.includes('drink') || category.includes('beverage'))) drinkVisits += 1;
        for (const item of orderItems) {
          const itemId = item.menuItemId?.toString();
          if (!itemId) continue;
          itemCounts[itemId] = (itemCounts[itemId] || 0) + item.quantity;
        }
      }
      const dessertProportion = dessertVisits / visits.length;
      const drinkProportion = drinkVisits / visits.length;

      const spendVariance = variance(spendValues);
      const dayOfWeekEntropy = computeDayOfWeekEntropy(visits.map((visit: any) => visit.visitedAt));

      vectors.push({
        customerId: customer.id,
        vector: [
          avgSpend,
          visitFrequency,
          avgPartySize,
          lunchProportion,
          dineinProportion,
          deliveryProportion,
          dessertProportion,
          drinkProportion,
          spendVariance,
          dayOfWeekEntropy,
        ],
        raw: {
          avgSpend,
          totalSpend,
          visitFrequency,
          avgPartySize,
          lunchProportion,
          dineinProportion,
          deliveryProportion,
          dessertProportion,
          drinkProportion,
          spendVariance,
          dayOfWeekEntropy,
          itemCounts,
        },
      });
    }

    return vectors;
  }
}

function normalizeFeatures(vectors: FeatureVector[]): FeatureVector[] {
  const mins = new Array(vectors[0].vector.length).fill(Number.POSITIVE_INFINITY);
  const maxs = new Array(vectors[0].vector.length).fill(Number.NEGATIVE_INFINITY);

  for (const vector of vectors) {
    vector.vector.forEach((value, idx) => {
      mins[idx] = Math.min(mins[idx], value);
      maxs[idx] = Math.max(maxs[idx], value);
    });
  }

  return vectors.map((vector) => {
    const normalized = vector.vector.map((value, idx) => {
      const range = maxs[idx] - mins[idx];
      if (range === 0) return 0;
      return (value - mins[idx]) / range;
    });
    return { ...vector, vector: normalized };
  });
}

function runKMeans(data: FeatureVector[], k: number, iterations: number = 25) {
  const centroids = data.slice(0, k).map((item) => item.vector.slice());
  let assignments = new Array(data.length).fill(0);

  for (let iter = 0; iter < iterations; iter += 1) {
    assignments = data.map((item) => {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, idx) => {
        const distance = euclideanDistance(item.vector, centroid);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = idx;
        }
      });
      return bestIndex;
    });

    const sums = centroids.map(() => new Array(data[0].vector.length).fill(0));
    const counts = centroids.map(() => 0);
    assignments.forEach((clusterIdx, idx) => {
      counts[clusterIdx] += 1;
      data[idx].vector.forEach((value, dim) => {
        sums[clusterIdx][dim] += value;
      });
    });

    centroids.forEach((centroid, idx) => {
      if (counts[idx] === 0) return;
      centroids[idx] = centroid.map((_, dim) => sums[idx][dim] / counts[idx]);
    });
  }

  return { centroids, assignments };
}

function silhouetteScore(data: FeatureVector[], assignments: number[]): number {
  const clusterMap = buildClusters(data, assignments);
  const clusterVectors = clusterMap.map((cluster) => cluster.map((item) => item.vector));

  const scores = data.map((item, idx) => {
    const clusterIdx = assignments[idx];
    const ownCluster = clusterVectors[clusterIdx];
    const a = averageDistance(item.vector, ownCluster);
    let b = Number.POSITIVE_INFINITY;
    clusterVectors.forEach((cluster, otherIdx) => {
      if (otherIdx === clusterIdx) return;
      b = Math.min(b, averageDistance(item.vector, cluster));
    });
    if (!isFinite(b)) return 0;
    return (b - a) / Math.max(a, b);
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function buildClusters(data: FeatureVector[], assignments: number[]): FeatureVector[][] {
  const clusters: FeatureVector[][] = [];
  assignments.forEach((clusterIdx, idx) => {
    if (!clusters[clusterIdx]) clusters[clusterIdx] = [];
    clusters[clusterIdx].push(data[idx]);
  });
  return clusters.filter(Boolean);
}

function summarizeCluster(cluster: FeatureVector[]) {
  const avgSpend = mean(cluster.map((item) => item.raw.avgSpend));
  const avgPartySize = mean(cluster.map((item) => item.raw.avgPartySize));
  const visitFrequency = mean(cluster.map((item) => item.raw.visitFrequency));
  const preferredTime = dominantValue(cluster.map((item) => timeLabel(item.raw.lunchProportion)));
  const preferredChannel = dominantValue(
    cluster.map((item) => (item.raw.dineinProportion >= 0.5 ? 'DIRECT' : 'DELIVERY'))
  );
  const clusterRevenue = cluster.reduce((sum, item) => sum + item.raw.totalSpend, 0);
  const itemCounts: Record<string, number> = {};
  cluster.forEach((item) => {
    Object.entries(item.raw.itemCounts).forEach(([itemId, count]) => {
      itemCounts[itemId] = (itemCounts[itemId] || 0) + count;
    });
  });
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([itemId]) => itemId);
  const spendHighThreshold = avgSpend * 1.2;

  return {
    avgSpend,
    avgPartySize,
    visitFrequency,
    preferredTime,
    preferredChannel,
    clusterRevenue,
    topItems,
    spendHighThreshold,
  };
}

function nameArchetype(summary: ReturnType<typeof summarizeCluster>) {
  if (summary.avgPartySize >= 4) {
    return {
      name: 'Weekend Family',
      description: 'Larger groups who visit together and spend above average.',
    };
  }
  if (summary.preferredChannel === 'DELIVERY') {
    return {
      name: 'Delivery Explorer',
      description: 'Prefer ordering in and show variety across visits.',
    };
  }
  if (summary.visitFrequency >= 2 && summary.avgPartySize <= 1.5) {
    return {
      name: 'Loyal Solo',
      description: 'Frequent visits, solo dining, steady spend.',
    };
  }
  if (summary.avgSpend > summary.spendHighThreshold) {
    return {
      name: 'Occasion Spender',
      description: 'Infrequent but high-spend visits, likely special occasions.',
    };
  }
  return {
    name: 'Regulars',
    description: 'Consistent customers with balanced visit patterns.',
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return mean(values.map((value) => Math.pow(value - avg, 2)));
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, value, idx) => sum + Math.pow(value - b[idx], 2), 0));
}

function averageDistance(vector: number[], cluster: number[][]): number {
  if (cluster.length === 0) return 0;
  const sum = cluster.reduce((acc, point) => acc + euclideanDistance(vector, point), 0);
  return sum / cluster.length;
}

function computeDayOfWeekEntropy(dates: Date[]): number {
  const counts = new Array(7).fill(0);
  dates.forEach((date) => {
    counts[date.getDay()] += 1;
  });
  const total = counts.reduce((sum, count) => sum + count, 0) || 1;
  const entropy = counts.reduce((sum, count) => {
    if (count === 0) return sum;
    const p = count / total;
    return sum - p * Math.log(p);
  }, 0);
  return entropy / Math.log(7);
}

function getTimeband(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return 'BREAKFAST';
  if (hour < 15) return 'LUNCH';
  if (hour < 19) return 'EVENING';
  return 'DINNER';
}

function timeLabel(lunchProportion: number): string {
  return lunchProportion >= 0.5 ? 'LUNCH' : 'DINNER';
}

function dominantValue(values: string[]): string {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
