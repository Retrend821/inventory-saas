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
 * - purchase_price: 仕入価格
 * - external_id: 外部ID（GmailのmessageId - 重複防止用）
 * - external_source: 外部ソース（"kaitorioukoku"）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
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

      // 管理番号の自動採番（最大値 + 1）+ 仕入価格
      // 形式: "番号）仕入価格" 例: "3415）33660"
      let inventoryNumber = item.inventory_number || null
      if (!inventoryNumber) {
        const { data: maxData } = await supabase
          .from('inventory')
          .select('inventory_number')
          .not('inventory_number', 'is', null)
          .order('inventory_number', { ascending: false })
          .limit(100)

        let maxNum = 0
        if (maxData) {
          for (const row of maxData) {
            // "3415）33660" の形式から番号部分を抽出
            const invNum = String(row.inventory_number || '')
            const match = invNum.match(/^(\d+)/)
            if (match) {
              const num = parseInt(match[1], 10)
              if (!isNaN(num) && num > maxNum) {
                maxNum = num
              }
            }
          }
        }
        const nextNum = maxNum + 1
        const price = item.purchase_price || 0
        inventoryNumber = `${nextNum}）${price}`
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
          memo: item.memo || null,
          listing_date: listingDate,
          external_id: item.external_id || null,
          external_source: item.external_source || null,
        })
        .select()
        .single()

      if (error) {
        errors.push({ item, error: error.message })
      } else {
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
