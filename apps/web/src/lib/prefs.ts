import { useSyncExternalStore } from 'react'

export const PALETTES = [
  { id: 'terracotta', name: 'Terracotta', swatch: ['#f8efec', '#9c3b2a', '#2c1a17'] },
  { id: 'forest', name: 'Forest', swatch: ['#ecefe6', '#2c5a43', '#18241c'] },
  { id: 'honey', name: 'Honey', swatch: ['#f7f0dc', '#9a6408', '#2a2214'] },
] as const

export type Palette = (typeof PALETTES)[number]['id']
export type ThemePref = 'system' | 'light' | 'dark'

interface Prefs {
  palette: Palette
  theme: ThemePref
  lastTree: string | null
}

const KEY = 'familytree.prefs'
const listeners = new Set<() => void>()
const media = window.matchMedia('(prefers-color-scheme: dark)')

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    return {
      palette: PALETTES.some((p) => p.id === raw.palette) ? (raw.palette as Palette) : 'terracotta',
      theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
      lastTree: typeof raw.lastTree === 'string' ? raw.lastTree : null,
    }
  } catch {
    return { palette: 'terracotta', theme: 'system', lastTree: null }
  }
}

let prefs = load()

function apply() {
  const root = document.documentElement
  root.dataset.palette = prefs.palette
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && media.matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', getComputedStyle(root).getPropertyValue('--paper').trim())
}

media.addEventListener('change', () => {
  apply()
  for (const l of listeners) l()
})
apply()

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {}
  apply()
  for (const l of listeners) l()
}

export function getPrefs() {
  return prefs
}

export function usePrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
  )
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
