"use client";

import { useEffect, useState } from "react";

interface RestaurantSettings {
  id: string;
  name: string;
  city: string;
  timezone: string;
  currency: string;
  totalSeats: number;
  hoursOpen: number;
  posSystem: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/restaurants")
      .then((r) => r.json())
      .then((d) => setSettings(d.restaurant || null))
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/restaurants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return (
    <div className="p-8 text-slate-400">Loading settings...</div>
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your restaurant and POS connection</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg">
        <h2 className="font-semibold text-slate-800 mb-4">Restaurant Details</h2>
        <div className="space-y-4">
          {[
            { key: "name", label: "Restaurant Name", type: "text" },
            { key: "city", label: "City", type: "text" },
            { key: "timezone", label: "Timezone", type: "text" },
            { key: "currency", label: "Currency", type: "text" },
            { key: "totalSeats", label: "Total Seats", type: "number" },
            { key: "hoursOpen", label: "Hours Open per Day", type: "number" },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-sm text-slate-600 mb-1">{label}</label>
              <input
                type={type}
                value={settings[key as keyof RestaurantSettings] as string}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    [key]: type === "number" ? parseFloat(e.target.value) : e.target.value,
                  })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm text-slate-600 mb-1">POS System</label>
            <select
              value={settings.posSystem}
              onChange={(e) => setSettings({ ...settings, posSystem: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="MANUAL">Manual / CSV</option>
              <option value="PETPOOJA">Petpooja</option>
              <option value="URBANPIPER">UrbanPiper</option>
              <option value="SQUARE">Square</option>
              <option value="CSV_IMPORT">CSV Import</option>
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
          >
            {saved ? "Saved ✓" : saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
