import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error'
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function toast(message: string, tone: Toast['tone'] = 'info') {
  const id = nextId++
  toasts = [...toasts, { id, message, tone }]
  emit()
  setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500)
}

export function toastError(error: unknown) {
  toast(error instanceof Error ? error.message : String(error), 'error')
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
}
