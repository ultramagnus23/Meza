"use client"

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ZAxis,
} from "recharts"

export function CorrelationScatter({ data }: { data: { x: string; y: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        No correlation data available
      </div>
    )
  }

  const chartData = data.map((d) => ({
    x: parseFloat(d.x),
    y: parseFloat(d.y),
    z: d.value,
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="x"
            name="Occupancy %"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            dataKey="y"
            name="Revenue (₹)"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis dataKey="z" range={[60, 400]} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
            }}
            labelStyle={{ color: 'var(--muted-foreground)' }}
            cursor={{ strokeDasharray: '3 3', stroke: 'var(--border)' }}
          />
          <Scatter data={chartData} fill="var(--primary)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
