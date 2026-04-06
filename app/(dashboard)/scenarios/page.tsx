"use client";

import { useState } from "react";

interface SimulationResult {
  revenueChange: number;
  revenueChangePct: number;
  marginChange: number;
  confidence: number;
  notes: string[];
}

export default function ScenariosPage() {
  const [priceChange, setPriceChange] = useState(0);
  const [itemId, setItemId] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/analytics/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, priceChangePct: priceChange }),
      });
      const d = await r.json();
      setResult(d.result || null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">What-If Simulator</h1>
        <p className="text-slate-500 mt-1">Model the impact of pricing and menu changes</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg">
        <h2 className="font-semibold text-slate-800 mb-4">Price Change Simulation</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Menu Item ID (optional)</label>
            <input
              type="text"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="Leave blank for all items"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">
              Price Change: {priceChange > 0 ? "+" : ""}{priceChange}%
            </label>
            <input
              type="range"
              min={-30}
              max={30}
              value={priceChange}
              onChange={(e) => setPriceChange(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>-30%</span>
              <span>0%</span>
              <span>+30%</span>
            </div>
          </div>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "Simulating..." : "Run Simulation"}
          </button>
        </div>

        {result && (
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <h3 className="font-semibold text-slate-700 mb-3">Projected Impact</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Revenue Change</p>
                <p className={`font-bold text-lg ${result.revenueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {result.revenueChange >= 0 ? "+" : ""}₹{result.revenueChange.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Change %</p>
                <p className={`font-bold text-lg ${result.revenueChangePct >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {result.revenueChangePct >= 0 ? "+" : ""}{result.revenueChangePct.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-slate-500 text-xs">Confidence: {result.confidence}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
