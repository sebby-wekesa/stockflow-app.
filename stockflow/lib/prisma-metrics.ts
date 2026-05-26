// Emit structured logs for DB pool exhaustion and Prisma timeout errors
// Usage: import { logDbError } from './prisma-metrics' and call logDbError(err)

export function logDbError(err: any) {
  try {
    const code = err?.code || (err?.name || 'UnknownError')
    const message = (err?.message || '').slice(0, 1024)
    const prismaCode = (err as any)?.code || null
    const meta = err?.meta || null

    // Structured console log parsable by log aggregators (JSON)
    console.error(JSON.stringify({
      event: 'db_error',
      severity: 'error',
      code,
      prismaCode,
      message,
      meta,
      timestamp: new Date().toISOString(),
    }))
  } catch (e) {
    // Fallback
    console.error('logDbError failed', e, err)
  }
}
