"use client";

import { useEffect, useState } from "react";

interface ChannelData {
  channel: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalDiscount: number;
  netRevenue: number;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/channels")
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const channelColors: Record<string, string> = {
    DINE_IN: "bg-blue-100 text-blue-800",
    TAKEAWAY: "bg-purple-100 text-purple-800",
    ZOMATO: "bg-red-100 text-red-800",
    SWIGGY: "bg-orange-100 text-orange-800",
    DIRECT_DELIVERY: "bg-green-100 text-green-800",
    OTHER: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Channel Performance</h1>
        <p className="text-slate-500 mt-1">Compare revenue and margins across order channels</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : channels.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No channel data available.</div>
      ) : (
        <div className="grid gap-4">
          {channels.map((ch) => {
            const colorClass = channelColors[ch.channel] || channelColors.OTHER;
            const discountPct = ch.totalRevenue > 0 ? (ch.totalDiscount / ch.totalRevenue * 100) : 0;
            return (
              <div key={ch.channel} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colorClass}`}>
                    {ch.channel.replace(/_/g, " ")}
                  </span>
                  <span className="text-2xl font-bold text-slate-800">
                    ₹{ch.totalRevenue.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Orders</p>
                    <p className="font-semibold text-slate-800">{ch.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Avg Order Value</p>
                    <p className="font-semibold text-slate-800">₹{ch.avgOrderValue.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Discounts</p>
                    <p className="font-semibold text-red-600">{discountPct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Net Revenue</p>
                    <p className="font-semibold text-green-700">₹{ch.netRevenue.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
