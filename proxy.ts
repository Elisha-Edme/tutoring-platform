import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Cheap presence check only — cryptographic verification happens in the page
// via getSession() (Node crypto). Verifying here with jose's jwtVerify produces
// a non-detachable ArrayBuffer that Next.js 16 can't stream ("failed to pipe
// response"). A forged cookie still fails getSession() and gets redirected.
export function proxy(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
