"use client";

import { useEffect, useState } from "react";

interface DigestConfig {
  isEnabled: boolean;
  sendTime: string;
  timezone: string;
  lookbackDays: number;
  maxInsights: number;
  includeRevenue: boolean;
  includeMenu: boolean;
  includeChannel: boolean;
  includeServer: boolean;
}

interface DigestLog {
  id: string;
  sentAt: string;
  recipientPhone: string;
  status: "SENT" | "FAILED" | "PENDING";
  insightCount: number;
  messageBody: string;
}

export default function DigestPage() {
  const [config, setConfig] = useState<DigestConfig | null>(null);
  const [logs, setLogs] = useState<DigestLog[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/digest/config")
      .then((r) => r.json())
      .then((d) => setConfig(d.config))
      .catch(console.error);
    fetch("/api/digest/history")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await fetch("/api/digest/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const r = await fetch("/api/digest/preview");
      const d = await r.json();
      setPreview(d.message || "No preview available");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSendNow = async () => {
    setSending(true);
    try {
      const r = await fetch("/api/digest/send", { method: "POST" });
      const d = await r.json();
      alert(d.message || "Digest sent!");
    } catch {
      alert("Failed to send digest");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">WhatsApp Digest</h1>
        <p className="text-slate-500 mt-1">Configure your daily WhatsApp insights delivery</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Config Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">⚙️ Digest Settings</h2>
          {config ? (
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.isEnabled}
                  onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-slate-700">Enable daily digest</span>
              </label>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Send Time (IST)</label>
                <input
                  type="time"
                  value={config.sendTime}
                  onChange={(e) => setConfig({ ...config, sendTime: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Lookback days</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={config.lookbackDays}
                  onChange={(e) => setConfig({ ...config, lookbackDays: parseInt(e.target.value) })}
                  className="border rounded-lg px-3 py-2 text-sm w-24"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Max insights per message</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.maxInsights}
                  onChange={(e) => setConfig({ ...config, maxInsights: parseInt(e.target.value) })}
                  className="border rounded-lg px-3 py-2 text-sm w-24"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-600 font-medium">Include in digest:</p>
                {[
                  ["includeRevenue", "Revenue & Orders"],
                  ["includeMenu", "Menu Performance"],
                  ["includeChannel", "Channel Analysis"],
                  ["includeServer", "Server Performance"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config[key as keyof DigestConfig] as boolean}
                      onChange={(e) =>
                        setConfig({ ...config, [key]: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
                <button
                  onClick={handlePreview}
                  disabled={previewing}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  {previewing ? "Generating..." : "Preview"}
                </button>
                <button
                  onClick={handleSendNow}
                  disabled={sending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Now"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Loading config...</p>
          )}
        </div>

        {/* Preview Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">📱 Message Preview</h2>
          {preview ? (
            <div className="bg-[#dcf8c6] rounded-2xl rounded-tl-none p-4 max-w-sm text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {preview}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl text-slate-400 text-sm">
              Click &quot;Preview&quot; to see your digest message
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-4">📜 Send History</h2>
        {logs.length === 0 ? (
          <p className="text-slate-400 text-sm">No digests sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="pb-2 text-slate-500 font-medium">Date/Time</th>
                  <th className="pb-2 text-slate-500 font-medium">Recipient</th>
                  <th className="pb-2 text-slate-500 font-medium">Status</th>
                  <th className="pb-2 text-slate-500 font-medium">Insights</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50">
                    <td className="py-2 text-slate-600">
                      {new Date(log.sentAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 text-slate-600">{log.recipientPhone}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.status === "SENT"
                            ? "bg-green-100 text-green-700"
                            : log.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 text-slate-600">{log.insightCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
