"use client"

import { useState } from "react"

export function PriceSimulator({
  baseRevenue,
}: {
  baseRevenue: number
}) {
  const [percent, setPercent] = useState(10)

  const projected =
    baseRevenue * (1 + percent / 100) * 0.97

  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-2">
        Price Simulation
      </h2>

      <input
        type="range"
        min={-20}
        max={20}
        value={percent}
        onChange={(e) => setPercent(+e.target.value)}
      />

      <p>Price change: {percent}%</p>
      <p className="font-bold">
        Projected Revenue: ₹{projected.toFixed(2)}
      </p>
    </div>
  )
}
