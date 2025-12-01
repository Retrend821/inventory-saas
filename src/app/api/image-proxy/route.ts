import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  console.log('Image proxy request for:', url)

  try {
    // 画像URLに応じたRefererを設定
    let referer = 'https://auctions.yahoo.co.jp/'
    if (url.includes('ecoauc.com')) {
      referer = 'https://ecoauc.com/'
    } else if (url.includes('nanboya.com') || url.includes('starbuyers')) {
      referer = 'https://www.starbuyers-global-auction.com/'
    } else if (url.includes('2ndstreet.jp')) {
      referer = 'https://www.2ndstreet.jp/'
    } else if (url.includes('trefac.jp')) {
      referer = 'https://www.trefac.jp/'
    } else if (url.includes('mekiki.ai')) {
      referer = 'https://monobank.jp/'
    } else if (url.includes('auctions.c.yimg.jp')) {
      referer = 'https://auctions.yahoo.co.jp/'
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      console.error('Image fetch failed:', response.status, response.statusText, 'for URL:', url)
      // 画像取得失敗時は透明な1x1 GIFを返す（エラー表示を防ぐ）
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
      return new NextResponse(transparentGif, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const imageBuffer = await response.arrayBuffer()

    console.log('Image proxy success:', url, 'Content-Type:', contentType, 'Size:', imageBuffer.byteLength)

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error, 'for URL:', url)
    // エラー時も透明な1x1 GIFを返す
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    return new NextResponse(transparentGif, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }
}
