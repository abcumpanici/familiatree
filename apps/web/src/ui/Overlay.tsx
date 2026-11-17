import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export function Dialog({
  open,
  onClose,
  children,
  label,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  label: string
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('input, textarea, button, [tabindex]')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] animate-[fade_200ms_ease-out]"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-float animate-[rise_320ms_cubic-bezier(0.22,1,0.36,1)] sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
