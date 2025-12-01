// Next.js 16では middleware が非推奨のため、クライアント側で認証チェックを行う
// このファイルは使用しない

import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 何もせずにそのまま通す
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
