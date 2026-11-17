export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const UNREACHABLE = 'Cannot reach the server. Check your connection and try again.'

export async function api<T>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown; raw?: boolean } = {},
): Promise<T> {
  const { body, raw, headers, ...rest } = init
  const isBlob = body instanceof Blob
  const isText = typeof body === 'string'
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(body !== undefined && !isBlob && !isText ? { 'content-type': 'application/json' } : {}),
      ...(isText ? { 'content-type': 'text/plain' } : {}),
      ...(isBlob ? { 'content-type': body.type } : {}),
      ...headers,
    },
    body:
      body === undefined ? undefined : isBlob || isText ? (body as BodyInit) : JSON.stringify(body),
  }).catch(() => {
    throw new ApiError(0, 'unreachable', UNREACHABLE)
  })
  if (!response.ok) {
    let code = 'error'
    let message = response.statusText || 'Something went wrong'
    try {
      const json = (await response.json()) as { error?: { code?: string; message?: string } }
      code = json.error?.code ?? code
      message = json.error?.message ?? message
    } catch {}
    if (response.status === 0 || response.status >= 500) {
      message = UNREACHABLE
    }
    throw new ApiError(response.status, code, message)
  }
  if (response.status === 204) return undefined as T
  if (raw) return (await response.text()) as T
  return (await response.json()) as T
}
