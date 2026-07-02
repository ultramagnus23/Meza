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
      <div className="h-64 flex items-center justify-center text-muted-foreground">
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
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="x"
            name="Occupancy %"
            stroke="rgba(255,255,255,0.3)"
            fontSize={12}
          />
          <YAxis
            dataKey="y"
            name="Revenue (₹)"
            stroke="rgba(255,255,255,0.3)"
            fontSize={12}
          />
          <ZAxis dataKey="z" range={[60, 400]} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
            }}
          />
          <Scatter data={chartData} fill="hsl(145, 75%, 55%)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
