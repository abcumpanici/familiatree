import type { ReactNode } from 'react'
import { Button } from './controls.tsx'

export function LoadError({
  title = 'Cannot reach the server',
  message,
  onRetry,
  action,
}: {
  title?: string
  message: string
  onRetry?: () => void
  action?: ReactNode
}) {
  return (
    <div
      role="alert"
      className="paper-grain flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <h1 className="display text-[34px]">{title}</h1>
      <p className="max-w-sm text-muted">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  )
}
