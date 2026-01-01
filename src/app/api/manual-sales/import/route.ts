/**
 * 手入力売上表 インポートAPI
 *
 * ★★★ 外部連携情報 ★★★
 *
 * 【Shopify売上の自動取り込み】
 * 呼び出し元: shopify-automation/spreadsheet.js の writeToInventoryApp()
 * 場所: Google Drive > 開発バックアップ > shopify-automation
 *
 * 処理フロー:
 * 1. fetch-orders.js がShopifyから未発送注文を取得
 * 2. クリックポストでラベル発行
 * 3. spreadsheet.js の writeToInventoryApp() がこのAPIを呼び出し
 *
 * 送信データ:
 * - product_name: 商品名
 * - sale_price: 売価（order.subtotal_price = 割引適用後の金額）
 * - brand_name: ブランド名
 * - inventory_number: 管理番号
 * - shipping_cost: 送料（クリックポスト185円）
 * - commission: 決済手数料
 * - sale_destination: 'shopify'
 * - sale_date: 売却日
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

type ManualSaleInput = {
  product_name: string
  sale_destination?: string
  sale_price?: number
  commission?: number
  sale_date?: string
  brand_name?: string
  category?: string
  inventory_number?: string
  external_id?: string
  shipping_cost?: number
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    const body = await request.json()

    const items: ManualSaleInput[] = Array.isArray(body) ? body : [body]

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

      // 重複チェック（商品名+売却日+売価で判定）
      if (item.product_name && item.sale_date && item.sale_price) {
        const { data: existing } = await supabase
          .from('manual_sales')
          .select('id')
          .eq('product_name', item.product_name)
          .eq('sale_date', item.sale_date)
          .eq('sale_price', item.sale_price)
          .single()

        if (existing) {
          errors.push({ item, error: 'Duplicate entry' })
          continue
        }
      }

      // 販売先の正規化: '自社サイト' → 'shopify'
      let saleDestination = item.sale_destination || null
      if (saleDestination === '自社サイト') {
        saleDestination = 'shopify'
      }

      // shopifyの場合、送料が未設定なら185円をデフォルトにする
      let shippingCost = item.shipping_cost || null
      if (saleDestination?.toLowerCase() === 'shopify' && !shippingCost) {
        shippingCost = 185
      }

      const salePrice = item.sale_price || 0
      const commission = item.commission || 0
      const profit = salePrice - commission
      const profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100 * 10) / 10 : 0

      const { data, error } = await supabase
        .from('manual_sales')
        .insert({
          product_name: item.product_name,
          sale_destination: saleDestination,
          sale_price: item.sale_price || null,
          commission: item.commission || null,
          sale_date: item.sale_date || null,
          brand_name: item.brand_name || null,
          category: item.category || null,
          inventory_number: item.inventory_number || null,
          shipping_cost: shippingCost,
          profit,
          profit_rate: profitRate,
          sale_type: 'main',
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
    console.error('Import error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
