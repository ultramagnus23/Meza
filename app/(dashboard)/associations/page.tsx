"use client";

import { useEffect, useState } from "react";

interface Association {
  id: string;
  itemAName: string;
  itemBName: string;
  support: number;
  confidence: number;
  lift: number;
  occurrences: number;
}

export default function AssociationsPage() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/associations")
      .then((r) => r.json())
      .then((data) => setAssociations(data.associations || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getLiftColor = (lift: number) => {
    if (lift >= 3) return "text-green-700 font-bold";
    if (lift >= 1.5) return "text-yellow-700 font-semibold";
    return "text-slate-600";
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Item Associations</h1>
        <p className="text-slate-500 mt-1">
          Which items are frequently ordered together? Use this to design combo offers.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <strong>How to read this:</strong> <em>Confidence</em> = if someone orders Item A, how likely they order Item B.{" "}
        <em>Lift</em> = how much more likely than random chance (lift &gt; 1.5 is meaningful).
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : associations.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          No association data yet. Run the association engine or wait for the nightly job.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Item A</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">→ Item B</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Support</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Confidence</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Lift</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Occurrences</th>
              </tr>
            </thead>
            <tbody>
              {associations.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.itemAName}</td>
                  <td className="px-4 py-3 text-slate-700">{a.itemBName}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{(a.support * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-slate-600">{(a.confidence * 100).toFixed(1)}%</td>
                  <td className={`px-4 py-3 text-right ${getLiftColor(a.lift)}`}>{a.lift.toFixed(2)}x</td>
                  <td className="px-4 py-3 text-right text-slate-600">{a.occurrences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
