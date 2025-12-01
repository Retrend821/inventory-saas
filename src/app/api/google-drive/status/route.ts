import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('google_access_token')?.value

  if (!accessToken) {
    return NextResponse.json({ connected: false })
  }

  // トークンが有効かどうかを確認
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (response.ok) {
      return NextResponse.json({ connected: true })
    } else {
      return NextResponse.json({ connected: false })
    }
  } catch {
    return NextResponse.json({ connected: false })
  }
}
