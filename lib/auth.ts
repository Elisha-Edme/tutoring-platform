import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { timingSafeEqual, createHmac } from 'crypto'
import type { SessionPayload } from './types'

function getJoseSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getJoseSecret())
}

// Use Node's native crypto instead of jose's jwtVerify to avoid the
// "ArrayBuffer is not detachable" error in React Server Components.
export function verifySessionSync(token: string): SessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, payload, signature] = parts
    const expected = createHmac('sha256', process.env.JWT_SECRET!)
      .update(`${header}.${payload}`)
      .digest('base64url')
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null
    return decoded as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  return verifySessionSync(token)
}

// NOTE: passwords are stored in plaintext for demo visibility. Before any real
// launch, re-introduce hashing here and at the signup/signin/admin call sites.
