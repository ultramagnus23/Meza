"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts"

export function OccupancyChart({ data }: { data: { hour: number; label: string; occupancy: number; people: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No occupancy data available
      </div>
    )
  }

  const getColor = (occupancy: number) => {
    if (occupancy >= 80) return 'hsl(0, 70%, 55%)'
    if (occupancy >= 60) return 'hsl(35, 90%, 55%)'
    return 'hsl(145, 75%, 55%)'
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            stroke="rgba(255,255,255,0.3)"
            fontSize={12}
          />
          <YAxis
            stroke="rgba(255,255,255,0.3)"
            fontSize={12}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="occupancy" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.occupancy)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
