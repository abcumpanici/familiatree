import {
  hourglassLayout,
  type Layout,
  type LayoutEdge,
  relationLabel,
  type TreeIndex,
} from '@familytree/domain'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { prefersReducedMotion } from '../lib/prefs.ts'
import { type AddKind, CARD_H, CARD_W, PersonCard } from './PersonCard.tsx'

gsap.registerPlugin(DrawSVGPlugin)
gsap.config({ nullTargetWarn: false })

interface Camera {
  x: number
  y: number
  s: number
}

export interface CanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  recenter: () => void
  fit: () => void
}

const MIN_SCALE = 0.25
const MAX_SCALE = 2

const defaultScale = (vp: HTMLElement | null) => ((vp?.clientWidth ?? 1000) < 640 ? 0.78 : 1)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const TreeCanvas = forwardRef<
  CanvasHandle,
  {
    index: TreeIndex
    focusId: string
    selectedId: string | null
    homeId: string | null
    onOpen: (personId: string) => void
    onAdd: (kind: AddKind, personId: string) => void
    insetRight: number
  }
>(function TreeCanvas({ index, focusId, selectedId, homeId, onOpen, onAdd, insetRight }, ref) {
  const viewport = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const cam = useRef<Camera>({ x: 0, y: 0, s: 1 })
  const prev = useRef<{
    positions: Map<string, { x: number; y: number }>
    edgeKeys: Set<string>
    cam: Camera
    focusId: string
  } | null>(null)

  const layout = useMemo(
    () => hourglassLayout(index, focusId, { cardWidth: CARD_W, cardHeight: CARD_H, rowGap: 76 }),
    [index, focusId],
  )
  const relations = useMemo(
    () => new Map(layout.nodes.map((n) => [n.personId, relationLabel(index, focusId, n.personId)])),
    [index, focusId, layout],
  )

  const applyCam = useCallback(() => {
    const { x, y, s } = cam.current
    if (world.current) world.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`
  }, [])

  const focusTarget = useCallback(
    (scale: number): Camera => {
      const vp = viewport.current
      const node = layout.nodes.find((n) => n.role === 'focus')
      if (!vp || !node) return { x: 0, y: 0, s: scale }
      const narrow = vp.clientWidth < 640
      return {
        s: scale,
        x: (vp.clientWidth - insetRight) / 2 - node.x * scale,
        y: vp.clientHeight * (narrow ? 0.4 : 0.45) - (node.y + CARD_H / 2) * scale,
      }
    },
    [layout, insetRight],
  )

  const animateCam = useCallback(
    (target: Camera) => {
      gsap.killTweensOf(cam.current)
      if (prefersReducedMotion()) {
        Object.assign(cam.current, target)
        applyCam()
        return
      }
      gsap.to(cam.current, { ...target, duration: 0.6, ease: 'power3.inOut', onUpdate: applyCam })
    },
    [applyCam],
  )

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const c = cam.current
      const s = clamp(c.s * factor, MIN_SCALE, MAX_SCALE)
      c.x = px - (px - c.x) * (s / c.s)
      c.y = py - (py - c.y) * (s / c.s)
      c.s = s
      applyCam()
    },
    [applyCam],
  )

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        const vp = viewport.current
        if (!vp) return
        const c = cam.current
        const s = clamp(c.s * 1.25, MIN_SCALE, MAX_SCALE)
        const cx = vp.clientWidth / 2
        const cy = vp.clientHeight / 2
        animateCam({ s, x: cx - (cx - c.x) * (s / c.s), y: cy - (cy - c.y) * (s / c.s) })
      },
      zoomOut: () => {
        const vp = viewport.current
        if (!vp) return
        const c = cam.current
        const s = clamp(c.s / 1.25, MIN_SCALE, MAX_SCALE)
        const cx = vp.clientWidth / 2
        const cy = vp.clientHeight / 2
        animateCam({ s, x: cx - (cx - c.x) * (s / c.s), y: cy - (cy - c.y) * (s / c.s) })
      },
      recenter: () => animateCam(focusTarget(defaultScale(viewport.current))),
      fit: () => {
        const vp = viewport.current
        if (!vp) return
        const { minX, minY, maxX, maxY } = layout.bounds
        const pad = 64
        const s = clamp(
          Math.min(
            (vp.clientWidth - pad * 2) / (maxX - minX),
            (vp.clientHeight - pad * 2) / (maxY - minY),
          ),
          MIN_SCALE,
          1.2,
        )
        animateCam({
          s,
          x: vp.clientWidth / 2 - ((minX + maxX) / 2) * s,
          y: vp.clientHeight / 2 - ((minY + maxY) / 2) * s,
        })
      },
    }),
    [animateCam, focusTarget, layout],
  )

  const focusTargetRef = useRef(focusTarget)
  focusTargetRef.current = focusTarget
  const replay = useRef<{ layout: Layout; before: typeof prev.current; cam: Camera } | null>(null)

  useLayoutEffect(() => {
    const host = world.current
    if (!host) return
    if (replay.current?.layout === layout) {
      prev.current = replay.current.before
      Object.assign(cam.current, replay.current.cam)
    }
    replay.current = null
    const focusTarget = focusTargetRef.current
    const before = prev.current
    const focusChanged = !before || before.focusId !== focusId
    const oldCam = { ...cam.current }
    if (focusChanged) {
      gsap.killTweensOf(cam.current)
      Object.assign(
        cam.current,
        focusTarget(before ? cam.current.s : defaultScale(viewport.current)),
      )
      applyCam()
    }
    const reduce = prefersReducedMotion()
    const cards = [...host.querySelectorAll<HTMLElement>('[data-card]')]
    const paths = [...host.querySelectorAll<SVGPathElement>('[data-edge]')]
    gsap.killTweensOf(cards)
    gsap.killTweensOf(paths)
    if (reduce) {
      gsap.set(cards, { clearProps: 'all' })
      gsap.set(paths, { clearProps: 'all' })
      for (const path of paths) path.style.animation = ''
    } else if (!before) {
      gsap.fromTo(
        cards,
        { opacity: 0, scale: 0.86, y: 14 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.7,
          ease: 'back.out(1.5)',
          delay: (_i, el: HTMLElement) => 0.08 + Math.abs(Number(el.dataset.generation)) * 0.14,
        },
      )
      drawEdges(paths, 0.55)
    } else {
      const byKey = new Map(layout.nodes.map((n) => [n.key, n]))
      const c = cam.current
      for (const el of cards) {
        const key = el.dataset.flipId ?? ''
        const node = byKey.get(key)
        const old = before.positions.get(key)
        if (!node) continue
        if (old) {
          const dx = (oldCam.x + old.x * oldCam.s - (c.x + node.x * c.s)) / c.s
          const dy = (oldCam.y + old.y * oldCam.s - (c.y + node.y * c.s)) / c.s
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            gsap.fromTo(
              el,
              { x: dx, y: dy },
              {
                x: 0,
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.8,
                ease: 'power3.inOut',
                overwrite: true,
              },
            )
          } else {
            gsap.to(el, {
              x: 0,
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.25,
              ease: 'power2.out',
              overwrite: true,
            })
          }
        } else {
          gsap.fromTo(
            el,
            { opacity: 0, scale: 0.8, x: 0, y: 0 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.55,
              delay: focusChanged ? 0.4 : 0.1,
              ease: 'back.out(1.7)',
              overwrite: true,
            },
          )
        }
      }
      const fresh = focusChanged
        ? paths
        : paths.filter((p) => !before.edgeKeys.has(p.dataset.key ?? ''))
      const kept = paths.filter((p) => !fresh.includes(p))
      gsap.set(kept, { opacity: 1 })
      gsap.set(
        kept.filter((p) => !p.dataset.dashed),
        { drawSVG: '100%' },
      )
      drawEdges(fresh, focusChanged ? 0.5 : 0.15)
    }
    prev.current = {
      positions: new Map(layout.nodes.map((n) => [n.key, { x: n.x, y: n.y }])),
      edgeKeys: new Set(layout.edges.map((e) => e.key)),
      cam: { ...cam.current },
      focusId,
    }
    return () => {
      replay.current = { layout, before, cam: oldCam }
    }
  }, [layout, focusId, applyCam])

  const lastView = useRef({ insetRight, selectedId })
  useEffect(() => {
    const last = lastView.current
    if (last.insetRight === insetRight && last.selectedId === selectedId) return
    lastView.current = { insetRight, selectedId }
    const vp = viewport.current
    const node = selectedId && layout.nodes.find((n) => n.personId === selectedId)
    if (!vp || !node) return
    const { x, s } = cam.current
    const margin = 24
    const left = x + (node.x - CARD_W / 2) * s
    const right = x + (node.x + CARD_W / 2) * s
    const visible = vp.clientWidth - insetRight
    const shift =
      right > visible - margin ? visible - margin - right : left < margin ? margin - left : 0
    if (shift) animateCam({ ...cam.current, x: x + shift })
  }, [insetRight, selectedId, layout, animateCam])

  useEffect(() => {
    const vp = viewport.current
    if (!vp) return
    const pointers = new Map<number, { x: number; y: number }>()
    let start: { x: number; y: number } | null = null
    let dragged = false
    let pinch: { dist: number } | null = null

    const local = (e: { clientX: number; clientY: number }) => {
      const r = vp.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      gsap.killTweensOf(cam.current)
      pointers.set(e.pointerId, local(e))
      if (pointers.size === 1) {
        start = local(e)
        dragged = false
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ]
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) }
        dragged = true
      }
    }

    const onMove = (e: PointerEvent) => {
      const last = pointers.get(e.pointerId)
      if (!last) return
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        if (e.pointerId === [...pointers.keys()][0]) {
          cam.current.x += (p.x - last.x) / 2
          cam.current.y += (p.y - last.y) / 2
        }
        zoomAt(mid.x, mid.y, dist / pinch.dist)
        pinch.dist = dist
        return
      }
      if (!start) return
      if (!dragged && Math.hypot(p.x - start.x, p.y - start.y) > 5) {
        dragged = true
        vp.setPointerCapture(e.pointerId)
        vp.dataset.dragging = 'true'
      }
      if (dragged) {
        cam.current.x += p.x - last.x
        cam.current.y += p.y - last.y
        applyCam()
      }
    }

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = null
      if (pointers.size === 0) {
        start = null
        delete vp.dataset.dragging
      }
    }

    const onClickCapture = (e: MouseEvent) => {
      if (dragged) {
        e.stopPropagation()
        e.preventDefault()
        dragged = false
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      gsap.killTweensOf(cam.current)
      const p = local(e)
      const mouseWheel =
        e.deltaMode === 1 ||
        (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50)
      if (e.ctrlKey || e.metaKey) zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01))
      else if (mouseWheel)
        zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)))
      else {
        cam.current.x -= e.deltaX
        cam.current.y -= e.deltaY
        applyCam()
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.target !== vp && !(e.target as HTMLElement).closest?.('[data-card]')) return
      const step = 80
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      }
      const move = moves[e.key]
      if (move && e.target === vp) {
        e.preventDefault()
        animateCam({ ...cam.current, x: cam.current.x + move[0], y: cam.current.y + move[1] })
      } else if (e.key === '+' || e.key === '=')
        zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, 1.2)
      else if (e.key === '-') zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, 1 / 1.2)
    }

    vp.addEventListener('pointerdown', onDown)
    vp.addEventListener('pointermove', onMove)
    vp.addEventListener('pointerup', onUp)
    vp.addEventListener('pointercancel', onUp)
    vp.addEventListener('click', onClickCapture, true)
    vp.addEventListener('wheel', onWheel, { passive: false })
    vp.addEventListener('keydown', onKey)
    return () => {
      vp.removeEventListener('pointerdown', onDown)
      vp.removeEventListener('pointermove', onMove)
      vp.removeEventListener('pointerup', onUp)
      vp.removeEventListener('pointercancel', onUp)
      vp.removeEventListener('click', onClickCapture, true)
      vp.removeEventListener('wheel', onWheel)
      vp.removeEventListener('keydown', onKey)
    }
  }, [applyCam, zoomAt, animateCam])

  return (
    <div
      ref={viewport}
      role="application"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the canvas pans with the arrow keys
      tabIndex={0}
      aria-label="Family tree. Drag to move, pinch or scroll to zoom."
      className="paper-grain absolute inset-0 touch-none overflow-hidden outline-none select-none data-[dragging]:cursor-grabbing"
    >
      <div ref={world} className="absolute top-0 left-0 origin-top-left will-change-transform">
        <Edges edges={layout.edges} />
        {layout.nodes.map((node) => {
          const person = index.people.get(node.personId)
          if (!person) return null
          const birthParents = (index.parentsOf.get(person.id) ?? []).filter(
            (l) => l.kind === 'birth',
          ).length
          return (
            <PersonCard
              key={node.key}
              node={node}
              person={person}
              focused={node.role === 'focus'}
              selected={selectedId === person.id}
              home={homeId === person.id}
              relation={relations.get(person.id) ?? null}
              canAddParent={birthParents < 2}
              onOpen={onOpen}
              onAdd={onAdd}
            />
          )
        })}
      </div>
    </div>
  )
})

function drawEdges(paths: SVGPathElement[], delay: number) {
  const solid = paths.filter((p) => !p.dataset.dashed)
  const dashed = paths.filter((p) => p.dataset.dashed)
  if (solid.length) {
    gsap.fromTo(
      solid,
      { drawSVG: '0%', opacity: 1 },
      { drawSVG: '100%', duration: 0.7, delay, ease: 'power2.inOut', stagger: 0.012 },
    )
  }
  for (const path of dashed) {
    path.style.animation = 'none'
    path.getBoundingClientRect()
    path.style.animation = `fade 500ms ease-out ${delay + 0.2}s both`
  }
}

const Edges = memo(function Edges({ edges }: { edges: LayoutEdge[] }) {
  return (
    <svg
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
      width="1"
      height="1"
      aria-hidden="true"
    >
      {edges.map((e) => {
        const dashed = e.kind === 'partner' ? Boolean(e.ended) : e.parentKind !== 'birth'
        const marker = e.kind === 'partner' && e.partnership?.married ? midpoint(e.path) : null
        return (
          <g key={e.key}>
            <path
              data-edge
              data-key={e.key}
              data-dashed={dashed ? 'true' : undefined}
              d={e.path}
              fill="none"
              stroke="color-mix(in oklab, var(--muted) 60%, transparent)"
              strokeWidth={e.kind === 'partner' ? 2 : 1.6}
              strokeLinecap="round"
              strokeDasharray={dashed ? '4 6' : undefined}
            />
            {marker && (
              <g transform={`translate(${marker.x} ${marker.y})`}>
                <circle
                  cx={-3}
                  r={4.5}
                  fill="var(--paper)"
                  stroke="var(--muted)"
                  strokeWidth={1.4}
                />
                <circle cx={3} r={4.5} fill="none" stroke="var(--muted)" strokeWidth={1.4} />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
})

function midpoint(path: string) {
  const m = /^M ([-\d.]+) ([-\d.]+) H ([-\d.]+)$/.exec(path)
  if (!m) return null
  return { x: (Number(m[1]) + Number(m[3])) / 2, y: Number(m[2]) }
}

export { CARD_W }
