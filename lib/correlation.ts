// Pearson correlation + significance, shared by the recommendation engine
// and anything else that wants the same numbers CorrelationScatter.tsx
// visualizes (components/CorrelationScatter.tsx).

export function pearson(xs: number[], ys: number[]): { r: number; n: number } {
  const n = xs.length
  if (n < 2) return { r: 0, n }

  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let cov = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  if (varX === 0 || varY === 0) return { r: 0, n }
  return { r: cov / Math.sqrt(varX * varY), n }
}

// Standard normal CDF via the Abramowitz & Stegun erf approximation -
// used to turn a correlation + sample size into a genuine two-tailed
// significance estimate (Fisher z-transformation), not a made-up number.
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return p
}

// Confidence in [0, 0.99] that the correlation is non-zero, derived from
// the Fisher z-transformation two-tailed p-value (1 - p, capped). Returns
// 0 when n is too small for the transform to be meaningful (n <= 3).
export function correlationConfidence(r: number, n: number): number {
  if (n <= 3 || Math.abs(r) >= 1) return 0
  const z = Math.atanh(r) * Math.sqrt(n - 3)
  const pTwoTailed = 2 * (1 - normalCdf(Math.abs(z)))
  return Math.max(0, Math.min(0.99, 1 - pTwoTailed))
}

export type TimestampedValue = { timestamp: string; value: number }

// Pairs two time series by nearest timestamp within maxDiffMs, so e.g. an
// environment reading at 7:03pm can be matched to a table session that
// started at 7:00pm. Each point in `primary` is matched to at most one
// point in `secondary` (closest in time); unmatched points are dropped.
export function pairByNearestTimestamp(
  primary: TimestampedValue[],
  secondary: TimestampedValue[],
  maxDiffMs: number
): { x: number; y: number }[] {
  const sorted = [...secondary].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  const pairs: { x: number; y: number }[] = []

  for (const p of primary) {
    const pTime = new Date(p.timestamp).getTime()
    let best: TimestampedValue | null = null
    let bestDiff = Infinity
    for (const s of sorted) {
      const diff = Math.abs(new Date(s.timestamp).getTime() - pTime)
      if (diff < bestDiff) {
        bestDiff = diff
        best = s
      }
    }
    if (best && bestDiff <= maxDiffMs) {
      pairs.push({ x: p.value, y: best.value })
    }
  }

  return pairs
}
