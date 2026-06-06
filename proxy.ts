import { NextRequest, NextResponse } from 'next/server'

const HUB_URL = process.env.HUB_URL || 'https://oxfordhub.app'
const PROJECT_ID = process.env.HUB_PROJECT_ID || ''

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/api/health') return NextResponse.next()

  try {
    const res = await fetch(`${HUB_URL}/api/verify?projectId=${PROJECT_ID}`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    })
    const { authorized } = await res.json()
    if (!authorized) {
      return NextResponse.redirect(`${HUB_URL}/login?callbackUrl=${encodeURIComponent(req.url)}`)
    }
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(`${HUB_URL}/login`)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
