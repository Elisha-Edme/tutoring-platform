import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { checkSpreadsheet } from '@/lib/sheets'
import { verifyEmailTransport } from '@/lib/email'

// TEMPORARY read-only diagnostic for verifying credentials per environment. Delete once
// Production is confirmed. Never returns secret values.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  const provided = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.nextUrl.searchParams.get('secret')
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function run<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, ...(await fn()) }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prefix = process.env.USE_PROD_ENV === '1' ? 'PROD_' : ''
  const names = [
    'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY_B64', 'GOOGLE_SHEET_ID',
    'GMAIL_USER', 'GMAIL_APP_PASSWORD',
  ]
  const present = Object.fromEntries(names.map(n => [`${prefix}${n}`, !!process.env[`${prefix}${n}`]]))

  const [sheet, email] = await Promise.all([run(checkSpreadsheet), run(verifyEmailTransport)])
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? 'local',
    usingProdPrefixedVars: prefix === 'PROD_',
    present,
    sheet: sheet.ok ? { ...sheet, ok: sheet.missingTabs.length === 0 } : sheet,
    email,
  })
}
