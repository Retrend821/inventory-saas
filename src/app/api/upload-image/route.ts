import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// サーバーサイド用のSupabaseクライアント（サービスロールキー使用）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET_NAME = 'inventory-images'

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, inventoryId } = await request.json()

    if (!imageUrl || !inventoryId) {
      return NextResponse.json(
        { error: 'imageUrl and inventoryId are required' },
        { status: 400 }
      )
    }

    // Base64画像の場合はそのまま保存
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) {
        return NextResponse.json({ error: 'Invalid base64 image' }, { status: 400 })
      }

      const extension = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')

      const fileName = `${inventoryId}_${Date.now()}.${extension}`

      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: `image/${extension}`,
          upsert: true
        })

      if (error) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName)

      return NextResponse.json({ url: publicUrlData.publicUrl })
    }

    // 外部URLから画像を取得
    let referer = 'https://auctions.yahoo.co.jp/'
    if (imageUrl.includes('ecoauc.com')) {
      referer = 'https://ecoauc.com/'
    } else if (imageUrl.includes('nanboya.com') || imageUrl.includes('starbuyers')) {
      referer = 'https://www.starbuyers-global-auction.com/'
    } else if (imageUrl.includes('2ndstreet.jp')) {
      referer = 'https://www.2ndstreet.jp/'
    } else if (imageUrl.includes('trefac.jp')) {
      referer = 'https://www.trefac.jp/'
    } else if (imageUrl.includes('mekiki.ai')) {
      referer = 'https://monobank.jp/'
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      console.error('Image fetch failed:', response.status)
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: 400 }
      )
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const imageBuffer = await response.arrayBuffer()

    // 拡張子を決定
    let extension = 'jpg'
    if (contentType.includes('png')) extension = 'png'
    else if (contentType.includes('gif')) extension = 'gif'
    else if (contentType.includes('webp')) extension = 'webp'

    const fileName = `${inventoryId}_${Date.now()}.${extension}`

    // Supabase Storageにアップロード
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: true
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 公開URLを取得
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    console.log('Image uploaded successfully:', fileName)

    return NextResponse.json({ url: publicUrlData.publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 一括アップロード用エンドポイント
export async function PUT(request: NextRequest) {
  try {
    const { items } = await request.json() as { items: { id: string; imageUrl: string }[] }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'items array is required' },
        { status: 400 }
      )
    }

    const results: { id: string; success: boolean; url?: string; error?: string }[] = []

    // 1件ずつ処理（メモリ節約）
    for (const item of items) {
      try {
        if (!item.imageUrl) {
          results.push({ id: item.id, success: false, error: 'No image URL' })
          continue
        }

        // Googleドライブ、Supabase Storage、Base64以外の外部URLのみ処理
        if (
          item.imageUrl.startsWith('data:') ||
          item.imageUrl.includes('supabase.co/storage') ||
          item.imageUrl.includes('googleusercontent.com')
        ) {
          results.push({ id: item.id, success: true, url: item.imageUrl })
          continue
        }

        // 外部URLから画像を取得
        let referer = 'https://auctions.yahoo.co.jp/'
        if (item.imageUrl.includes('ecoauc.com')) {
          referer = 'https://ecoauc.com/'
        } else if (item.imageUrl.includes('nanboya.com') || item.imageUrl.includes('starbuyers')) {
          referer = 'https://www.starbuyers-global-auction.com/'
        } else if (item.imageUrl.includes('2ndstreet.jp')) {
          referer = 'https://www.2ndstreet.jp/'
        } else if (item.imageUrl.includes('trefac.jp')) {
          referer = 'https://www.trefac.jp/'
        } else if (item.imageUrl.includes('mekiki.ai')) {
          referer = 'https://monobank.jp/'
        }

        const response = await fetch(item.imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': referer,
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        })

        if (!response.ok) {
          results.push({ id: item.id, success: false, error: `HTTP ${response.status}` })
          continue
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const imageBuffer = await response.arrayBuffer()

        let extension = 'jpg'
        if (contentType.includes('png')) extension = 'png'
        else if (contentType.includes('gif')) extension = 'gif'
        else if (contentType.includes('webp')) extension = 'webp'

        const fileName = `${item.id}_${Date.now()}.${extension}`

        const { error } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(fileName, imageBuffer, {
            contentType,
            upsert: true
          })

        if (error) {
          results.push({ id: item.id, success: false, error: error.message })
          continue
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from(BUCKET_NAME)
          .getPublicUrl(fileName)

        results.push({ id: item.id, success: true, url: publicUrlData.publicUrl })
      } catch (err) {
        results.push({ id: item.id, success: false, error: String(err) })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Batch upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
