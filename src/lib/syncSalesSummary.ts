import { supabase } from '@/lib/supabase'

// 同期に必要な型定義（各テーブルの必要フィールド）
export type SyncInventoryItem = {
  id: string
  inventory_number: string | null
  product_name: string
  brand_name: string | null
  category: string | null
  image_url: string | null
  saved_image_url: string | null
  purchase_price: number | null
  purchase_total: number | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  other_cost: number | null
  photography_fee: number | null
  deposit_amount: number | null
  status: string
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  sale_destination: string | null
  purchase_source: string | null
  memo: string | null
}

export type SyncBulkPurchase = {
  id: string
  genre: string
  purchase_date: string
  purchase_source: string | null
  total_amount: number
  total_quantity: number
}

export type SyncBulkSale = {
  id: string
  bulk_purchase_id: string
  sale_date: string
  sale_destination: string | null
  quantity: number
  sale_amount: number
  commission: number
  shipping_cost: number
  memo: string | null
  product_name: string | null
  brand_name: string | null
  category: string | null
  image_url: string | null
  purchase_price: number | null
  other_cost: number | null
  photography_fee: number | null
  deposit_amount: number | null
  listing_date: string | null
}

export type SyncManualSale = {
  id: string
  product_name: string | null
  brand_name: string | null
  category: string | null
  purchase_source: string | null
  sale_destination: string | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  other_cost: number | null
  photography_fee: number | null
  purchase_total: number | null
  profit: number | null
  profit_rate: number | null
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  memo: string | null
  inventory_number: string | null
  cost_recovered: boolean | null
}

export type SyncSalesSummaryRecord = {
  id: string
  source_type: 'single' | 'bulk' | 'manual'
  source_id: string
  [key: string]: unknown
}

type NewSalesSummaryRecord = {
  source_type: 'single' | 'bulk' | 'manual'
  source_id: string
  inventory_number: string | null
  product_name: string
  brand_name: string | null
  category: string | null
  image_url: string | null
  purchase_source: string | null
  sale_destination: string | null
  sale_price: number
  commission: number
  shipping_cost: number
  other_cost: number
  photography_fee: number
  purchase_price: number
  purchase_cost: number
  deposit_amount: number | null
  profit: number
  profit_rate: number
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  turnover_days: number | null
  memo: string | null
  quantity: number
}

type SyncParams = {
  inventory: SyncInventoryItem[]
  bulkPurchases: SyncBulkPurchase[]
  bulkSales: SyncBulkSale[]
  manualSales: SyncManualSale[]
  existingSalesSummary: SyncSalesSummaryRecord[]
}

type SyncResult = {
  updatedSalesSummary: SyncSalesSummaryRecord[]
  newRecordsCount: number
}

// 回転日数計算
const calcTurnover = (purchaseDate: string | null, saleDate: string | null): number | null => {
  if (!purchaseDate || !saleDate) return null
  const purchase = new Date(purchaseDate)
  const sale = new Date(saleDate)
  const diffTime = sale.getTime() - purchase.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export async function syncSalesSummary(params: SyncParams): Promise<SyncResult> {
  const { inventory, bulkPurchases, bulkSales, manualSales, existingSalesSummary } = params

  // 既存の sales_summary のキーをセットに格納（重複チェック用）
  const existingKeys = new Set(existingSalesSummary.map(s => `${s.source_type}:${s.source_id}`))

  // bulkレコードは毎回再計算するため、既存のbulkレコードを削除
  const existingBulkIds = existingSalesSummary.filter(s => s.source_type === 'bulk').map(s => s.id)
  if (existingBulkIds.length > 0) {
    const batchSize = 500
    for (let i = 0; i < existingBulkIds.length; i += batchSize) {
      const batch = existingBulkIds.slice(i, i + batchSize)
      await supabase.from('sales_summary').delete().in('id', batch)
    }
    // 削除したキーをexistingKeysから除外
    existingSalesSummary.filter(s => s.source_type === 'bulk').forEach(s => {
      existingKeys.delete(`bulk:${s.source_id}`)
    })
  }

  // bulkPurchase のマップを作成
  const bpMap = new Map<string, SyncBulkPurchase>()
  bulkPurchases.forEach(bp => bpMap.set(bp.id, bp))

  // bulk_sales のキーを記録（manual_sales との重複排除用）
  const bulkSalesKeys = new Set<string>()
  bulkSales.forEach(sale => {
    if (sale.product_name && sale.sale_date) {
      const key = `${sale.product_name.trim().toLowerCase()}|${sale.sale_date}`
      bulkSalesKeys.add(key)
    }
  })

  // 不足分を追加するためのデータを収集
  const newRecords: NewSalesSummaryRecord[] = []

  // 1. inventory（単品）の不足分を追加
  inventory.forEach(item => {
    if (item.status === '売却済み' && item.sale_destination && item.sale_destination !== '返品' && item.sale_date) {
      const key = `single:${item.id}`
      if (!existingKeys.has(key)) {
        const salePrice = item.sale_price || 0
        const purchasePrice = item.purchase_price || 0
        const commission = item.commission || 0
        const shippingCost = item.shipping_cost || 0
        const otherCost = item.other_cost || 0
        const photographyFee = item.photography_fee || 0
        // 入金額 = 売値 - 販売手数料 - 送料 - 撮影手数料
        const depositAmount = item.deposit_amount || (salePrice - commission - shippingCost - photographyFee)
        // 仕入総額がある場合はそれを使用、なければ原価+修理費（撮影手数料は入金額から引く）
        const purchaseCost = item.purchase_total ?? (purchasePrice + otherCost)
        const profit = depositAmount - purchaseCost
        const profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100) : 0

        newRecords.push({
          source_type: 'single',
          source_id: item.id,
          inventory_number: item.inventory_number,
          product_name: item.product_name || '',
          brand_name: item.brand_name,
          category: item.category,
          image_url: item.saved_image_url || item.image_url,
          purchase_source: item.purchase_source,
          sale_destination: item.sale_destination,
          sale_price: salePrice,
          commission,
          shipping_cost: shippingCost,
          other_cost: otherCost,
          photography_fee: photographyFee,
          purchase_price: purchasePrice,
          purchase_cost: purchaseCost,
          deposit_amount: depositAmount,
          profit,
          profit_rate: profitRate,
          purchase_date: item.purchase_date,
          listing_date: item.listing_date,
          sale_date: item.sale_date,
          turnover_days: calcTurnover(item.purchase_date, item.sale_date),
          memo: item.memo,
          quantity: 1
        })
      }
    }
  })

  // 2. bulk_sales（まとめ売り）の不足分を追加（販売先があるもののみ＝販売確定分）
  bulkSales.filter(sale => sale.sale_destination).forEach(sale => {
    const key = `bulk:${sale.id}`
    if (!existingKeys.has(key)) {
      const bulkPurchase = bpMap.get(sale.bulk_purchase_id)
      if (bulkPurchase) {
        const hasProductDetails = sale.product_name || sale.brand_name || sale.category
        const unitCost = bulkPurchase.total_quantity > 0
          ? Math.round(bulkPurchase.total_amount / bulkPurchase.total_quantity)
          : 0
        const otherCost = sale.other_cost ?? 0
        const photographyFee = sale.photography_fee ?? 0
        const depositAmount = sale.deposit_amount ?? ((sale.sale_amount || 0) - (sale.commission || 0) - (sale.shipping_cost || 0))
        // purchase_priceが明示的に設定されていればそれを使用、
        // 未設定（原価回収モード）の場合はdepositAmountを使用して利益を0にする
        const purchasePrice = sale.purchase_price ?? depositAmount
        // 原価回収のためマイナス利益は0にクランプ
        const profit = Math.max(0, depositAmount - purchasePrice - otherCost)
        const profitRate = sale.sale_amount > 0 ? Math.round((profit / sale.sale_amount) * 100) : 0

        newRecords.push({
          source_type: 'bulk',
          source_id: sale.id,
          inventory_number: null,
          product_name: hasProductDetails
            ? (sale.product_name || `【まとめ】${bulkPurchase.genre}`)
            : `【まとめ】${bulkPurchase.genre}${sale.quantity > 1 ? ` × ${sale.quantity}` : ''}`,
          brand_name: sale.brand_name,
          category: sale.category || bulkPurchase.genre,
          image_url: sale.image_url,
          purchase_source: bulkPurchase.purchase_source,
          sale_destination: sale.sale_destination,
          sale_price: sale.sale_amount,
          commission: sale.commission,
          shipping_cost: sale.shipping_cost,
          other_cost: otherCost,
          photography_fee: photographyFee,
          purchase_price: purchasePrice,
          // 仕入総額 = 原価 + 修理費（撮影手数料は入金額から引くので含めない）
          purchase_cost: purchasePrice + otherCost,
          deposit_amount: sale.deposit_amount,
          profit,
          profit_rate: profitRate,
          purchase_date: bulkPurchase.purchase_date,
          listing_date: sale.listing_date,
          sale_date: sale.sale_date,
          turnover_days: calcTurnover(bulkPurchase.purchase_date, sale.sale_date),
          memo: sale.memo,
          quantity: sale.quantity
        })
      }
    }
  })

  // 3. manual_sales（手入力）の不足分を追加
  manualSales.forEach(item => {
    if (item.sale_date && !item.cost_recovered) {
      // bulk_sales との重複チェック
      if (item.product_name && item.sale_date) {
        const dupKey = `${item.product_name.trim().toLowerCase()}|${item.sale_date}`
        if (bulkSalesKeys.has(dupKey)) return
      }

      const key = `manual:${item.id}`
      if (!existingKeys.has(key)) {
        const salePrice = item.sale_price || 0
        const commission = item.commission || 0
        const shippingCost = item.shipping_cost || 0
        const otherCost = item.other_cost || 0
        const photographyFee = item.photography_fee || 0
        // manual_salesでは仕入総額（purchase_total）を使用
        const purchaseCost = item.purchase_total || 0
        // 入金額 = 売値 - 販売手数料 - 送料 - 撮影手数料（修理費は仕入側コストなので含めない）
        const depositAmount = salePrice - commission - shippingCost - photographyFee
        // 利益 = 入金額 - 仕入総額
        const profit = item.profit ?? (depositAmount - purchaseCost)
        const profitRate = item.profit_rate ?? (salePrice > 0 ? Math.round((profit / salePrice) * 100) : 0)

        newRecords.push({
          source_type: 'manual',
          source_id: item.id,
          inventory_number: item.inventory_number,
          product_name: item.product_name || '(手入力)',
          brand_name: item.brand_name,
          category: item.category,
          image_url: null,
          purchase_source: item.purchase_source,
          sale_destination: item.sale_destination,
          sale_price: salePrice,
          commission,
          shipping_cost: shippingCost,
          other_cost: otherCost,
          photography_fee: photographyFee,
          purchase_price: purchaseCost,
          purchase_cost: purchaseCost,
          deposit_amount: depositAmount,
          profit,
          profit_rate: profitRate,
          purchase_date: item.purchase_date,
          listing_date: item.listing_date,
          sale_date: item.sale_date,
          turnover_days: calcTurnover(item.purchase_date, item.sale_date),
          memo: item.memo,
          quantity: 1
        })
      }
    }
  })

  // 不足分があれば sales_summary に追加
  // 削除済みのbulkレコードを除外した状態で開始
  let allSalesSummary = existingSalesSummary.filter(s => s.source_type !== 'bulk')
  if (newRecords.length > 0) {
    console.log(`Adding ${newRecords.length} new records to sales_summary`)
    const batchSize = 500
    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize)
      const { data: insertedData, error: insertError } = await supabase
        .from('sales_summary')
        .insert(batch)
        .select()

      if (insertError) {
        console.error('Error inserting to sales_summary:', insertError)
      } else if (insertedData) {
        allSalesSummary = [...allSalesSummary, ...(insertedData as SyncSalesSummaryRecord[])]
      }
    }
  }

  return {
    updatedSalesSummary: allSalesSummary,
    newRecordsCount: newRecords.length
  }
}
