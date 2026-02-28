import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  // Netlify Durable CDNキャッシュを無効化（デプロイ後に古いHTMLが返される問題の防止）
  response.headers.set('Netlify-CDN-Cache-Control', 'no-store')
  response.headers.set('CDN-Cache-Control', 'no-store')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
