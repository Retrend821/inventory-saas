import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect('http://localhost:3000/settings/google-drive?error=google_auth_failed')
  }

  if (!code) {
    return NextResponse.redirect('http://localhost:3000/settings/google-drive?error=no_code')
  }

  try {
    // コードをトークンに交換
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: 'http://localhost:3000/api/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('Token error:', tokenData)
      return NextResponse.redirect('http://localhost:3000/settings/google-drive?error=token_error')
    }

    // ユーザー情報を取得してトークンを保存
    // 注: 実際の実装ではセッションからuser_idを取得する必要があります
    // ここでは一時的にクッキーにトークンを保存します
    const response = NextResponse.redirect('http://localhost:3000/settings/google-drive?success=google_connected')

    // トークンをHTTPOnlyクッキーに保存（セキュリティ向上）
    response.cookies.set('google_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in,
    })

    if (tokenData.refresh_token) {
      response.cookies.set('google_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30日
      })
    }

    return response
  } catch (error) {
    console.error('Google auth error:', error)
    return NextResponse.redirect('http://localhost:3000/settings/google-drive?error=server_error')
  }
}
