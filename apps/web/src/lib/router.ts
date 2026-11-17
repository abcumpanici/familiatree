import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

window.addEventListener('popstate', emit)

export function navigate(to: string, options: { replace?: boolean; transition?: boolean } = {}) {
  const go = () => {
    if (options.replace) history.replaceState(null, '', to)
    else history.pushState(null, '', to)
    emit()
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (options.transition !== false && document.startViewTransition && !reduce) {
    document.startViewTransition(go)
  } else go()
}

export function useLocation() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => location.pathname + location.search,
  )
}

export function setSearchParams(
  patch: Record<string, string | null>,
  options: { push?: boolean; state?: unknown } = {},
) {
  const url = new URL(location.href)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  const to = url.pathname + url.search
  if (to === location.pathname + location.search) return
  if (options.push) history.pushState(options.state ?? null, '', to)
  else history.replaceState(options.state ?? history.state, '', to)
  emit()
}
