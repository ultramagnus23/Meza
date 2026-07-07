'use client'

import { useEffect, useRef, useState } from 'react'

// Decorative simulation for the landing hero only - not real restaurant
// data. The real, data-backed floor plan (reading cameras.table_regions +
// live table_sessions) is separate follow-on work; this component exists
// to demonstrate what that scene looks and feels like: tables filling and
// emptying across a service, scrubbed by a timeline.

type DemoTable = {
  id: number
  shape: 'rect' | 'circle'
  x: number
  y: number
  w: number
  h: number
  seats: number
  // [start, end] in scrubber units (0-100), each pair one seating.
  occupied: [number, number][]
}

const TABLES: DemoTable[] = [
  { id: 1, shape: 'rect', x: 30, y: 30, w: 55, h: 38, seats: 2, occupied: [[8, 38], [55, 92]] },
  { id: 2, shape: 'rect', x: 105, y: 30, w: 55, h: 38, seats: 4, occupied: [[4, 34], [48, 96]] },
  { id: 3, shape: 'rect', x: 180, y: 30, w: 55, h: 38, seats: 2, occupied: [[18, 58]] },
  { id: 4, shape: 'rect', x: 255, y: 30, w: 55, h: 38, seats: 4, occupied: [[0, 22], [42, 100]] },
  { id: 5, shape: 'rect', x: 330, y: 30, w: 55, h: 38, seats: 2, occupied: [[28, 66]] },
  { id: 6, shape: 'circle', x: 58, y: 145, w: 56, h: 56, seats: 4, occupied: [[12, 46], [62, 98]] },
  { id: 7, shape: 'circle', x: 150, y: 145, w: 56, h: 56, seats: 2, occupied: [[0, 28], [58, 88]] },
  { id: 8, shape: 'rect', x: 235, y: 128, w: 68, h: 44, seats: 6, occupied: [[10, 44], [54, 94]] },
  { id: 9, shape: 'rect', x: 335, y: 128, w: 68, h: 44, seats: 4, occupied: [[24, 78]] },
]

const AUTOPLAY_TARGET = 62
const AUTOPLAY_MS = 1600

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4)
}

function tableState(table: DemoTable, tick: number) {
  const range = table.occupied.find(([start, end]) => tick >= start && tick <= end)
  if (!range) return { occupied: false, minutesIn: 0, longStay: false }
  const [start, end] = range
  const span = end - start
  const progress = span > 0 ? (tick - start) / span : 0
  const minutesIn = Math.round(progress * 95) // decorative "minutes seated"
  return { occupied: true, minutesIn, longStay: progress > 0.65 }
}

export function FloorScene() {
  const [tick, setTick] = useState(0)
  const [autoPlaying, setAutoPlaying] = useState(true)
  const rafRef = useRef<number>()

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setTick(AUTOPLAY_TARGET)
      setAutoPlaying(false)
      return
    }

    const start = performance.now()
    const step = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / AUTOPLAY_MS)
      setTick(Math.round(easeOutQuart(t) * AUTOPLAY_TARGET))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setAutoPlaying(false)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const timeLabel = (() => {
    // 18:00 -> 23:30 across the scrubber, decorative only
    const totalMinutes = 18 * 60 + Math.round((tick / 100) * (5.5 * 60))
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  })()

  return (
    <div className="w-full">
      <svg
        viewBox="0 0 440 210"
        className="w-full h-auto"
        role="img"
        aria-label="Simulated floor plan replaying a service"
      >
        <rect x="0" y="0" width="440" height="210" rx="6" fill="none" stroke="var(--line)" strokeWidth="1" />
        {TABLES.map((table) => {
          const state = tableState(table, tick)
          const fill = !state.occupied
            ? 'transparent'
            : state.longStay
              ? 'var(--candle-dim)'
              : 'var(--candle)'
          const stroke = 'var(--line)'
          const cx = table.x + table.w / 2
          const cy = table.y + table.h / 2
          const dotCount = Math.min(table.seats, 6)

          return (
            <g
              key={table.id}
              style={{
                transition: 'opacity 500ms cubic-bezier(0.25,1,0.5,1)',
                opacity: 1,
              }}
            >
              {table.shape === 'rect' ? (
                <rect
                  x={table.x}
                  y={table.y}
                  width={table.w}
                  height={table.h}
                  rx="4"
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: state.occupied ? 'scale(1)' : 'scale(0.97)',
                    transition:
                      'transform 500ms cubic-bezier(0.25,1,0.5,1), fill 500ms cubic-bezier(0.25,1,0.5,1)',
                  }}
                />
              ) : (
                <circle
                  cx={cx}
                  cy={cy}
                  r={table.w / 2}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: state.occupied ? 'scale(1)' : 'scale(0.97)',
                    transition:
                      'transform 500ms cubic-bezier(0.25,1,0.5,1), fill 500ms cubic-bezier(0.25,1,0.5,1)',
                  }}
                />
              )}

              {/* party size dots */}
              {Array.from({ length: dotCount }).map((_, i) => {
                const spread = (dotCount - 1) * 5
                const dx = cx - spread / 2 + i * 5
                return (
                  <circle
                    key={i}
                    cx={dx}
                    cy={cy + table.h / 2 + 8}
                    r="1.4"
                    fill="var(--line)"
                    style={{ opacity: 0.9 }}
                  />
                )
              })}

              {state.occupied && (
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="10"
                  fill={state.longStay ? 'var(--room)' : 'var(--primary-foreground)'}
                >
                  {state.minutesIn}m
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{timeLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={tick}
          onChange={(e) => {
            setAutoPlaying(false)
            setTick(Number(e.target.value))
          }}
          className="flex-1 accent-[var(--candle)]"
          aria-label="Service timeline"
        />
        <span className="font-mono text-xs text-muted-foreground w-16 shrink-0 text-right">
          {autoPlaying ? 'replaying' : 'scrub freely'}
        </span>
      </div>
    </div>
  )
}
