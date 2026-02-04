import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // エコオクで手数料が550/1100/2200円のものを取得（2025-01-01以降）
    const { data: items, error: fetchError } = await supabase
      .from('inventory')
      .select('id, sale_price, commission, other_cost, purchase_total, shipping_cost')
      .eq('sale_destination', 'エコオク')
      .gte('sale_date', '2025-01-01')
      .in('commission', [550, 1100, 2200])

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: '対象データがありません', count: 0 })
    }

    // 各アイテムを更新
    const updates = []
    for (const item of items) {
      const newOtherCost = (item.other_cost || 0) + 440

      // 利益を再計算: 売価 - 仕入総額 - 手数料 - 送料 - その他
      const salePrice = item.sale_price || 0
      const purchaseTotal = item.purchase_total || 0
      const commission = item.commission || 0
      const shippingCost = item.shipping_cost || 0
      const newProfit = salePrice - purchaseTotal - commission - shippingCost - newOtherCost

      // 利益率を計算
      const newProfitRate = salePrice > 0 ? Math.round((newProfit / salePrice) * 100) : 0

      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          other_cost: newOtherCost,
          profit: newProfit,
          profit_rate: newProfitRate
        })
        .eq('id', item.id)

      if (updateError) {
        updates.push({ id: item.id, status: 'error', error: updateError.message })
      } else {
        updates.push({ id: item.id, status: 'success', other_cost: newOtherCost, profit: newProfit })
      }
    }

    const successCount = updates.filter(u => u.status === 'success').length
    const errorCount = updates.filter(u => u.status === 'error').length

    return NextResponse.json({
      message: `${successCount}件を更新しました`,
      total: items.length,
      success: successCount,
      errors: errorCount,
      details: updates
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
