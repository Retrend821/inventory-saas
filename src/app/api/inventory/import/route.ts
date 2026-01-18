/**
 * 単品在庫 インポートAPI
 *
 * ★★★ 外部連携情報 ★★★
 *
 * 【買取王国の仕入れ自動取り込み】
 * 呼び出し元: Google Apps Script (importKaitorioukokuFromGmail)
 *
 * 処理フロー:
 * 1. GASがGmailから買取王国の注文確認メールを取得
 * 2. メールから商品名、価格、日付などを抽出
 * 3. このAPIを呼び出してinventoryテーブルに登録
 *
 * 送信データ:
 * - product_name: 商品名（必須）
 * - brand_name: ブランド名
 * - category: カテゴリ
 * - supplier: 仕入先（"買取王国"）
 * - purchase_date: 仕入日（YYYY-MM-DD）
 * - purchase_price: 仕入価格（税込）
 * - external_id: 外部ID（GmailのmessageId - 重複防止用）
 * - external_source: 外部ソース（"kaitorioukoku"）
 *
 * ---
 *
 * 【オフモール（HARDOFFオフモール）の仕入れ自動取り込み】
 * 呼び出し元: Google Apps Script (importOffmallFromGmail)
 * GASファイル: scripts/importOffmallFromGmail.gs
 *
 * 処理フロー:
 * 1. GASがGmailから「【HARDOFFオフモール】ご注文内容確認書」を検索
 * 2. メール本文から商品名([商品]〜[価格])、価格、商品URLを抽出
 * 3. 商品ページから画像URLを取得し、Google Driveに保存
 * 4. このAPIを呼び出してinventoryテーブルに登録
 *
 * 送信データ:
 * - product_name: 商品名（必須）
 * - brand_name: ブランド名（自動検出）
 * - category: カテゴリ（自動検出）
 * - supplier: 仕入先（"オフモール"）
 * - purchase_date: 仕入日（YYYY/MM/DD）
 * - purchase_price: 仕入価格（税込）
 * - image_url: 画像URL（外部URL → Supabase Storageに自動アップロード）
 * - external_id: 外部ID（GmailのmessageId - 重複防止用）
 * - external_source: 外部ソース（"offmall"）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET_NAME = 'inventory-images'

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * 外部画像URLをSupabase Storageにアップロード
 */
async function uploadImageToSupabase(
  supabase: ReturnType<typeof getSupabaseClient>,
  imageUrl: string,
  inventoryId: string
): Promise<string | null> {
  try {
    // 既にSupabase StorageのURLならそのまま返す
    if (imageUrl.includes('supabase.co/storage')) {
      return imageUrl
    }

    // オフモール（hardoff）の画像URL用のリファラー設定
    let fetchUrl = imageUrl
    let headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    }

    if (imageUrl.includes('hardoff.co.jp') || imageUrl.includes('netmall.hardoff.co.jp')) {
      headers['Referer'] = 'https://netmall.hardoff.co.jp/'
    } else if (imageUrl.includes('2ndstreet.jp') || imageUrl.includes('trefac.jp')) {
      // プロキシサービス経由
      fetchUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`
      headers = {}
    } else if (imageUrl.includes('drive.google.com')) {
      // Google DriveのURLはそのまま使う（アップロード不要）
      return imageUrl
    }

    const response = await fetch(fetchUrl, { headers })

    if (!response.ok) {
      console.error('Image fetch failed:', response.status, imageUrl)
      return null
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
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: true
      })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    // 公開URLを取得
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    return publicUrlData.publicUrl
  } catch (error) {
    console.error('Image upload error:', error)
    return null
  }
}

type InventoryInput = {
  product_name: string
  brand_name?: string
  category?: string
  supplier?: string  // APIではsupplierで受け取り、DBのpurchase_sourceに保存
  purchase_date?: string
  purchase_price?: number
  other_cost?: number
  inventory_number?: string
  image_url?: string
  status?: string
  memo?: string
  listing_date?: string
  external_id?: string
  external_source?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const body = await request.json()

    const items: InventoryInput[] = Array.isArray(body) ? body : [body]

    if (items.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    const results = []
    const errors = []

    for (const item of items) {
      if (!item.product_name) {
        errors.push({ item, error: 'product_name is required' })
        continue
      }

      // 外部IDによる重複チェック
      if (item.external_id && item.external_source) {
        const { data: existing } = await supabase
          .from('inventory')
          .select('id')
          .eq('external_source', item.external_source)
          .eq('external_id', item.external_id)
          .single()

        if (existing) {
          errors.push({ item, error: 'Duplicate entry (external_id already exists)' })
          continue
        }
      }

      // 日付フォーマットを正規化 (YYYY/MM/DD → YYYY-MM-DD)
      let purchaseDate = item.purchase_date || null
      if (purchaseDate && purchaseDate.includes('/')) {
        purchaseDate = purchaseDate.replace(/\//g, '-')
      }

      let listingDate = item.listing_date || null
      if (listingDate && listingDate.includes('/')) {
        listingDate = listingDate.replace(/\//g, '-')
      }

      // 管理番号の自動採番（最大値 + 1）
      let inventoryNumber = item.inventory_number || null
      let memoText = item.memo || null
      if (!inventoryNumber) {
        // 全件取得して最大値を探す（range指定で1000件制限を回避）
        let maxNum = 0
        let offset = 0
        const batchSize = 1000

        while (true) {
          const { data: batchData } = await supabase
            .from('inventory')
            .select('inventory_number')
            .not('inventory_number', 'is', null)
            .range(offset, offset + batchSize - 1)

          if (!batchData || batchData.length === 0) break

          for (const row of batchData) {
            const invNum = String(row.inventory_number || '')
            const match = invNum.match(/^(\d+)/)
            if (match) {
              const num = parseInt(match[1], 10)
              if (!isNaN(num) && num > maxNum) {
                maxNum = num
              }
            }
          }

          if (batchData.length < batchSize) break
          offset += batchSize
        }

        const nextNum = maxNum + 1
        const price = item.purchase_price || 0
        inventoryNumber = String(nextNum)
        memoText = `${nextNum}）${price}`
      }

      // 税込→税抜計算（10%）
      const priceWithTax = item.purchase_price || 0
      const priceWithoutTax = Math.round(priceWithTax / 1.1)

      const { data, error } = await supabase
        .from('inventory')
        .insert({
          product_name: item.product_name,
          brand_name: item.brand_name || null,
          category: item.category || null,
          purchase_source: item.supplier || null,
          purchase_date: purchaseDate,
          purchase_price: priceWithoutTax,      // 税抜金額
          purchase_total: priceWithTax,          // 税込金額
          other_cost: item.other_cost || 0,
          inventory_number: inventoryNumber,
          image_url: item.image_url || null,
          status: item.status || 'in_stock',
          memo: memoText,
          listing_date: listingDate,
          external_id: item.external_id || null,
          external_source: item.external_source || null,
        })
        .select()
        .single()

      if (error) {
        errors.push({ item, error: error.message })
      } else {
        // 画像URLがあればSupabase Storageにアップロード
        if (item.image_url && data?.id) {
          const supabaseImageUrl = await uploadImageToSupabase(supabase, item.image_url, data.id)
          if (supabaseImageUrl && supabaseImageUrl !== item.image_url) {
            // DBの画像URLを更新
            await supabase
              .from('inventory')
              .update({ image_url: supabaseImageUrl })
              .eq('id', data.id)
            data.image_url = supabaseImageUrl
          }
        }
        results.push(data)
      }
    }

    return NextResponse.json({
      success: true,
      inserted: results.length,
      errors: errors.length,
      results,
      errorDetails: errors
    })

  } catch (error) {
    console.error('Inventory import error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}

// 画像をSupabase Storageに移行（PUT）
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const { source } = await request.json()

    // 指定されたソース（例：offmall）の在庫で、Google Drive画像を持つものを取得
    let query = supabase
      .from('inventory')
      .select('id, image_url')
      .not('image_url', 'is', null)
      .not('image_url', 'ilike', '%supabase.co/storage%')

    if (source) {
      query = query.eq('external_source', source)
    }

    const { data: items, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No items to migrate', migrated: 0 })
    }

    let migratedCount = 0
    const errors: { id: string; error: string }[] = []

    for (const item of items) {
      if (!item.image_url) continue

      const supabaseImageUrl = await uploadImageToSupabase(supabase, item.image_url, item.id)

      if (supabaseImageUrl && supabaseImageUrl !== item.image_url) {
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ image_url: supabaseImageUrl })
          .eq('id', item.id)

        if (updateError) {
          errors.push({ id: item.id, error: updateError.message })
        } else {
          migratedCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      migrated: migratedCount,
      total: items.length,
      errors
    })
  } catch (error) {
    console.error('Migration error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}

// 在庫一覧取得（オプション）
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const supplier = searchParams.get('supplier')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabase
      .from('inventory')
      .select('*')
      .order('purchase_date', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (supplier) {
      query = query.eq('supplier', supplier)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, count: data?.length || 0 })

  } catch (error) {
    console.error('Inventory fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
