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

      const salePrice = item.sale_price || 0
      const commission = item.commission || 0
      const profit = salePrice - commission
      const profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100 * 10) / 10 : 0

      const { data, error } = await supabase
        .from('manual_sales')
        .insert({
          product_name: item.product_name,
          sale_destination: item.sale_destination || null,
          sale_price: item.sale_price || null,
          commission: item.commission || null,
          sale_date: item.sale_date || null,
          brand_name: item.brand_name || null,
          category: item.category || null,
          inventory_number: item.inventory_number || null,
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
