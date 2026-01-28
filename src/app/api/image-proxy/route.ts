import { NextRequest, NextResponse } from 'next/server'

// Netlifyでキャッシュされないように動的ルートとして設定
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  console.log('Image proxy request for:', url)

  try {
    // cdn2.2ndstreet.jpはCDNなので直接取得可能
    if (url.includes('cdn2.2ndstreet.jp')) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.2ndstreet.jp/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      })

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const imageBuffer = await response.arrayBuffer()

        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, no-store, must-revalidate',
            'CDN-Cache-Control': 'no-store',
            'Vary': 'url',
          },
        })
      }
    }

    // www.2ndstreet.jp/trefacの場合は外部プロキシサービス（weserv.nl）を使用
    if (url.includes('2ndstreet.jp') || url.includes('trefac.jp')) {
      const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent('https://via.placeholder.com/100?text=No+Image')}`
      const response = await fetch(weservUrl)

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const imageBuffer = await response.arrayBuffer()

        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, no-store, must-revalidate',
            'CDN-Cache-Control': 'no-store',
            'Vary': 'url',
          },
        })
      }
      // weservも失敗したら透明GIFを返す
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
      return new NextResponse(transparentGif, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'private, no-store, must-revalidate',
          'CDN-Cache-Control': 'no-store',
        },
      })
    }

    // その他の画像URLに応じたRefererを設定
    let referer = 'https://auctions.yahoo.co.jp/'
    if (url.includes('ecoauc.com')) {
      referer = 'https://ecoauc.com/'
    } else if (url.includes('nanboya.com') || url.includes('starbuyers')) {
      referer = 'https://www.starbuyers-global-auction.com/'
    } else if (url.includes('mekiki.ai')) {
      referer = 'https://monobank.jp/'
    } else if (url.includes('auctions.c.yimg.jp')) {
      referer = 'https://auctions.yahoo.co.jp/'
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Origin': referer.replace(/\/$/, ''),
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    })

    if (!response.ok) {
      console.error('Image fetch failed:', response.status, response.statusText, 'for URL:', url)
      // 画像取得失敗時は透明な1x1 GIFを返す（エラー表示を防ぐ）
      const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
      return new NextResponse(transparentGif, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'private, no-store, must-revalidate',
          'CDN-Cache-Control': 'no-store',
        },
      })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const imageBuffer = await response.arrayBuffer()

    console.log('Image proxy success:', url, 'Content-Type:', contentType, 'Size:', imageBuffer.byteLength)

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vary': 'url',
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error, 'for URL:', url)
    // エラー時も透明な1x1 GIFを返す
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    return new NextResponse(transparentGif, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'private, no-store, must-revalidate',
        'CDN-Cache-Control': 'no-store',
      },
    })
  }
}
