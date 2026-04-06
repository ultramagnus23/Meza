"use client";

import { useEffect, useState } from "react";

interface ServerStats {
  id: string;
  name: string;
  totalOrders: number;
  totalRevenue: number;
  avgCheckSize: number;
  upsellScore: number;
}

export default function ServersPage() {
  const [servers, setServers] = useState<ServerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/servers")
      .then((r) => r.json())
      .then((data) => setServers(data.servers || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Server Performance</h1>
        <p className="text-slate-500 mt-1">Track upsell rates and revenue per server</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : servers.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No server data available.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Server</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Orders</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Revenue</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Avg Check</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Upsell Score</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{s.totalOrders}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{s.totalRevenue.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right text-slate-700">₹{s.avgCheckSize.toFixed(0)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${s.upsellScore >= 70 ? "text-green-600" : s.upsellScore >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                      {s.upsellScore.toFixed(0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
