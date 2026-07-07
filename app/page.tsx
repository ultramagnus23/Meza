'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { FloorScene } from '@/components/landing/FloorScene'
import { Button } from '@/components/ui/button'
import { Camera, LayoutGrid, ClipboardList } from 'lucide-react'

const SEQUENCE = [
  {
    icon: Camera,
    title: 'A camera you already have',
    body: 'Existing CCTV, pointed where it already is. No new hardware, no wiring, no install crew.',
  },
  {
    icon: LayoutGrid,
    title: 'Becomes a floor plan',
    body: 'Every table, live: seated or free, how long they have been there, how many are at it.',
  },
  {
    icon: ClipboardList,
    title: 'Becomes a decision',
    body: 'Add a table at 8, hold the last seating, turn the music down before the room gets loud.',
  },
]

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
      </div>
    )
  }

  if (user) {
    // Redirect effect above is in flight - render nothing rather than a
    // flash of marketing copy for a signed-in visitor.
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground font-display font-bold text-xs">
            M
          </div>
          <span className="font-display font-semibold text-sm tracking-wide">MEZA</span>
        </div>
        <Link href="/signin">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-8 pb-20 sm:pt-16">
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight max-w-2xl">
          Know your floor.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl">
          See every table, right now: seated or free, how long, how many. Read tonight against last
          Tuesday. Decide before the room tells you.
        </p>
        <div className="mt-8 max-w-2xl">
          <FloorScene />
        </div>
        <div className="mt-10">
          <Link href="/signup">
            <Button size="lg">Start free</Button>
          </Link>
        </div>
      </section>

      {/* Explainer: ruled ledger, not icon cards */}
      <section className="max-w-3xl mx-auto px-6 py-16 border-t border-border">
        <h2 className="font-display text-2xl font-semibold mb-8">From camera to decision.</h2>
        <div className="divide-y divide-border border-y border-border">
          {SEQUENCE.map((step, i) => (
            <div key={step.title} className="flex items-start gap-5 py-6">
              <span className="font-mono text-sm text-muted-foreground w-6 shrink-0 pt-0.5">
                {String(i + 1).padStart(2, '0')}
              </span>
              <step.icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy - passport-style small print, mono, plain statement */}
      <section className="max-w-3xl mx-auto px-6 py-16 border-t border-border">
        <div className="font-mono text-xs leading-relaxed text-muted-foreground border border-border rounded-md p-5 space-y-2">
          <p className="text-foreground">Privacy</p>
          <p>occupancy, not identity. no faces stored.</p>
          <p>collects: anonymous counts, table state, queue length, wait time.</p>
          <p>does not collect: names, phone numbers, ids, facial or biometric data, wifi tracking.</p>
          <p>each camera frame is processed in memory and discarded. nothing is saved or transmitted.</p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 border-t border-border text-center">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-6">
          See tonight&apos;s floor.
        </h2>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/signup">
            <Button size="lg">Start free</Button>
          </Link>
          <Link href="/signin">
            <Button size="lg" variant="outline">
              Try the demo
            </Button>
          </Link>
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-6 py-8 text-xs text-muted-foreground border-t border-border">
        MEZA
      </footer>
    </div>
  )
}
