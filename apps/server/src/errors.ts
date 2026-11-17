import { DomainError } from '@familytree/domain'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const DOMAIN_STATUS: Record<DomainError['code'], ContentfulStatusCode> = {
  invalid: 400,
  not_found: 404,
  duplicate: 409,
  cycle: 409,
  too_many_birth_parents: 409,
  limit: 403,
}

export function notFound(what = 'Not found'): never {
  throw new ApiError(404, 'not_found', what)
}

export function zodMessage(error: ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
    .join('; ')
}

export function errorBody(code: string, message: string) {
  return { error: { code, message } }
}

export function handleError(error: Error, c: Context) {
  if (error instanceof ApiError) return c.json(errorBody(error.code, error.message), error.status)
  if (error instanceof DomainError) {
    return c.json(errorBody(error.code, error.message), DOMAIN_STATUS[error.code])
  }
  if (error instanceof ZodError) return c.json(errorBody('invalid', zodMessage(error)), 400)
  if (error instanceof SyntaxError)
    return c.json(errorBody('invalid', 'Body is not valid JSON'), 400)
  console.error(error)
  return c.json(errorBody('internal', 'Something went wrong'), 500)
}
