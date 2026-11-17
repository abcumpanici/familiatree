import { dismiss, useToasts } from '../lib/toast.ts'

export function Toaster() {
  const toasts = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <button
          type="button"
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-left text-sm shadow-float animate-[toast-in_280ms_cubic-bezier(0.22,1,0.36,1)] ${t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-paper'}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
