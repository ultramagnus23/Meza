"use client";

import { useEffect, useState } from "react";
import { Star, TrendingDown, HelpCircle, Minus } from "lucide-react";

interface MenuItemEngineering {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  classification: "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";
  totalSold: number;
  revenue: number;
  margin: number;
}

const classificationConfig = {
  STAR: { label: "Star", color: "bg-green-100 text-green-800", icon: Star },
  PLOWHORSE: { label: "Plowhorse", color: "bg-blue-100 text-blue-800", icon: TrendingDown },
  PUZZLE: { label: "Puzzle", color: "bg-yellow-100 text-yellow-800", icon: HelpCircle },
  DOG: { label: "Dog", color: "bg-red-100 text-red-800", icon: Minus },
};

export default function MenuPage() {
  const [items, setItems] = useState<MenuItemEngineering[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/menu")
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Menu Engineering</h1>
        <p className="text-slate-500 mt-1">Boston Matrix analysis — Stars, Plowhorses, Puzzles, Dogs</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          No menu data available. Upload POS data to get started.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Item</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Category</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Price</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Sold</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Revenue</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Margin%</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Classification</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const config = classificationConfig[item.classification] || classificationConfig.DOG;
                const marginPct = item.price > 0 ? ((item.price - item.costPrice) / item.price * 100) : 0;
                return (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{item.category}</td>
                    <td className="px-4 py-3 text-right text-slate-700">₹{item.price.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{item.totalSold}</td>
                    <td className="px-4 py-3 text-right text-slate-700">₹{item.revenue.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{marginPct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                        {item.classification}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
