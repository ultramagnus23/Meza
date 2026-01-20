"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export function RevenueChart({ data }: { data: any[] }) {
  return (
    <div className="h-64 border rounded p-4">
      <h2 className="font-semibold mb-2">Revenue Over Time</h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line dataKey="revenue" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
