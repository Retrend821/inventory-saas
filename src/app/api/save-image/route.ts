import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, inventoryId } = await request.json()

    if (!imageUrl || !inventoryId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // 画像URLに応じたRefererを設定
    let referer = 'https://auctions.yahoo.co.jp/'
    if (imageUrl.includes('ecoauc.com')) {
      referer = 'https://ecoauc.com/'
    } else if (imageUrl.includes('nanboya.com')) {
      referer = 'https://www.starbuyers-global-auction.com/'
    } else if (imageUrl.includes('2ndstreet.jp')) {
      referer = 'https://www.2ndstreet.jp/'
    } else if (imageUrl.includes('trefac.jp')) {
      referer = 'https://www.trefac.jp/'
    } else if (imageUrl.includes('mekiki.ai')) {
      referer = 'https://monobank.jp/'
    }

    // 外部画像を取得
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
      },
    })

    if (!imageResponse.ok) {
      console.error('Image fetch failed:', imageUrl, imageResponse.status, imageResponse.statusText)
      return NextResponse.json({ error: `Failed to fetch image: ${imageResponse.status}` }, { status: 400 })
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const fileName = `${inventoryId}.${extension}`

    // Supabase Storageにアップロード
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 公開URLを取得
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(fileName)

    // DBの saved_image_url を更新
    const { error: updateError } = await supabase
      .from('inventory')
      .update({ saved_image_url: publicUrl })
      .eq('id', inventoryId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, savedUrl: publicUrl })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
