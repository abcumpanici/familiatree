import gsap from 'gsap'
import { useLayoutEffect, useRef, useState } from 'react'
import { createTree, treePath } from '../data/trees.ts'
import { prefersReducedMotion } from '../lib/prefs.ts'
import { navigate } from '../lib/router.ts'
import { toastError } from '../lib/toast.ts'
import { Button } from '../ui/controls.tsx'

export function Welcome() {
  const [busy, setBusy] = useState(false)
  const start = async (example: boolean) => {
    setBusy(true)
    try {
      const id = await createTree(example ? 'The Hale family' : 'My family', example)
      navigate(treePath(id))
    } catch (error) {
      toastError(error)
      setBusy(false)
    }
  }
  return (
    <main className="paper-grain min-h-full overflow-y-auto">
      <div className="mx-auto grid min-h-full max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-[1.05fr_1fr] md:px-10">
        <div>
          <h1 className="display text-[clamp(44px,7vw,84px)] leading-[0.98]">
            Keep your family's story.
          </h1>
          <p className="mt-6 max-w-[34ch] font-serif text-[20px] leading-relaxed text-muted">
            Add the people, how they are related, and the things worth remembering about them.
            Simple, private and free.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              icon="plus"
              disabled={busy}
              onClick={() => start(false)}
            >
              Start my tree
            </Button>
            <Button variant="ghost" size="lg" disabled={busy} onClick={() => start(true)}>
              Explore an example family
            </Button>
          </div>
          <p className="mt-12 max-w-md text-[14px] leading-relaxed text-muted">
            Your trees are kept on this server. Download a copy of a tree at any time, as JSON or
            GEDCOM.
          </p>
        </div>
        <GrowingTree />
      </div>
    </main>
  )
}

const NODES = [
  { x: 70, y: 40, t: 'b', g: 0 },
  { x: 150, y: 40, t: 'a', g: 0 },
  { x: 290, y: 40, t: 'b', g: 0 },
  { x: 370, y: 40, t: 'a', g: 0 },
  { x: 110, y: 160, t: 'b', g: 1 },
  { x: 330, y: 160, t: 'a', g: 1 },
  { x: 220, y: 280, t: 'c', g: 2 },
  { x: 140, y: 280, t: 'a', g: 2 },
  { x: 300, y: 280, t: 'b', g: 2 },
] as const

const LINES = [
  'M 92 40 H 128',
  'M 312 40 H 348',
  'M 110 40 V 100 Q 110 110 110 110 V 138',
  'M 330 40 V 138',
  'M 132 160 H 308',
  'M 220 160 V 210 Q 220 220 210 220 H 150 Q 140 220 140 230 V 258',
  'M 220 220 V 258',
  'M 220 220 H 290 Q 300 220 300 230 V 258',
]

function GrowingTree() {
  const ref = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      tl.from('[data-node]', {
        scale: 0,
        opacity: 0,
        transformOrigin: '50% 50%',
        duration: 0.6,
        ease: 'back.out(1.8)',
        stagger: { each: 0.08, from: 'start' },
      })
      tl.fromTo(
        '[data-line]',
        { drawSVG: '0%' },
        { drawSVG: '100%', duration: 0.9, stagger: 0.07 },
        0.35,
      )
      tl.from('[data-leaf]', { opacity: 0, y: 6, duration: 0.6, stagger: 0.05 }, '-=0.4')
    }, svg)
    return () => ctx.revert()
  }, [])
  return (
    <svg
      ref={ref}
      viewBox="0 0 440 340"
      className="mx-auto w-full max-w-[520px]"
      aria-hidden="true"
    >
      {LINES.map((d) => (
        <path
          key={d}
          data-line
          d={d}
          fill="none"
          stroke="var(--muted)"
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {NODES.map((n) => (
        <g key={`${n.x}-${n.y}`} data-node transform={`translate(${n.x} ${n.y})`}>
          <circle r={n.g === 2 && n.t === 'c' ? 30 : 22} fill="var(--surface)" />
          <circle
            r={n.g === 2 && n.t === 'c' ? 30 : 22}
            fill={`color-mix(in oklab, var(--tint-${n.t}) 30%, var(--surface))`}
            stroke={n.g === 2 && n.t === 'c' ? 'var(--accent)' : `var(--tint-${n.t})`}
            strokeWidth={n.g === 2 && n.t === 'c' ? 2.5 : 1.5}
          />
        </g>
      ))}
      {NODES.map((n) => (
        <rect
          key={`l-${n.x}-${n.y}`}
          data-leaf
          x={n.x - 22}
          y={n.y + (n.g === 2 && n.t === 'c' ? 40 : 32)}
          width={44}
          height={5}
          rx={2.5}
          fill="var(--line)"
        />
      ))}
    </svg>
  )
}
