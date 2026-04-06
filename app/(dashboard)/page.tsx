"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ShoppingBag, DollarSign, Users } from "lucide-react";

interface OverviewStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  revpash: number;
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">{title}</p>
        <Icon className="w-5 h-5 text-orange-500" />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    fetch("/api/analytics/overview")
      .then((r) => r.json())
      .then((data) => setStats(data.stats || null))
      .catch(console.error);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Good morning 👋</h1>
        <p className="text-slate-500 mt-1">Here&apos;s how your restaurant is performing.</p>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Revenue (7 days)"
            value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`}
            icon={DollarSign}
          />
          <StatCard
            title="Orders (7 days)"
            value={stats.totalOrders.toLocaleString("en-IN")}
            icon={ShoppingBag}
          />
          <StatCard
            title="Avg Order Value"
            value={`₹${stats.avgOrderValue.toLocaleString("en-IN")}`}
            icon={TrendingUp}
          />
          <StatCard
            title="RevPASH"
            value={`₹${stats.revpash.toFixed(2)}`}
            icon={Users}
            subtitle="Revenue per available seat per hour"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-3" />
              <div className="h-8 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-orange-800 mb-2">
          🌟 Welcome to Meza
        </h2>
        <p className="text-orange-700 text-sm">
          Upload your POS data or connect your POS system to start receiving AI-powered insights
          delivered to your WhatsApp every morning.
        </p>
      </div>
    </div>
  );
}
