// 既存の売却済みデータを sales_summary テーブルにマイグレーションするスクリプト
// 実行方法: node scripts/migrate-to-sales-summary.js

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impld2xhbnFmbHVyY3FyZW1hbnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODY2NDgsImV4cCI6MjA3OTY2MjY0OH0.eZiO_lkE7dM5ih3kHjrLCeaQ5ozpilRwTVgLsLnCp8I'

const supabase = createClient(supabaseUrl, supabaseKey)

// 日付のバリデーション（無効な日付は null に変換）
function sanitizeDate(dateStr) {
  if (!dateStr) return null
  if (typeof dateStr !== 'string') return dateStr
  // 「不明」「返品」「キャンセル」などの無効な値をnullに
  if (/不明|返品|キャンセル|未定/.test(dateStr)) return null
  // 有効な日付形式かチェック
  if (!/^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)) return null
  return dateStr
}

// 回転日数計算
function calculateTurnoverDays(purchaseDate, saleDate) {
  const validPurchase = sanitizeDate(purchaseDate)
  const validSale = sanitizeDate(saleDate)
  if (!validPurchase || !validSale) return null
  const purchase = new Date(validPurchase)
  const sale = new Date(validSale)
  const diffTime = sale.getTime() - purchase.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

async function migrateToSalesSummary() {
  console.log('=== sales_summary テーブルへのマイグレーション開始 ===\n')

  // 1. inventory（単品仕入れ）から売却済みデータを取得
  console.log('1. inventory テーブルから売却済みデータを取得中...')
  let allInventory = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('status', '売却済み')
      .not('sale_destination', 'is', null)
      .neq('sale_destination', '返品')
      .not('sale_date', 'is', null)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('inventory 取得エラー:', error)
      process.exit(1)
    }

    if (!data || data.length === 0) break
    allInventory = allInventory.concat(data)
    console.log(`  ${allInventory.length}件取得済み...`)

    if (data.length < pageSize) break
    from += pageSize
  }
  console.log(`  → inventory: ${allInventory.length}件\n`)

  // 2. bulk_purchases を取得（まとめ仕入れ情報参照用）
  console.log('2. bulk_purchases テーブルを取得中...')
  const { data: bulkPurchases, error: bpError } = await supabase
    .from('bulk_purchases')
    .select('*')

  if (bpError) {
    console.error('bulk_purchases 取得エラー:', bpError)
    process.exit(1)
  }

  const bulkPurchaseMap = new Map()
  bulkPurchases?.forEach(bp => bulkPurchaseMap.set(bp.id, bp))
  console.log(`  → bulk_purchases: ${bulkPurchases?.length || 0}件\n`)

  // 3. bulk_sales を取得
  console.log('3. bulk_sales テーブルを取得中...')
  const { data: bulkSales, error: bsError } = await supabase
    .from('bulk_sales')
    .select('*')

  if (bsError) {
    console.error('bulk_sales 取得エラー:', bsError)
    process.exit(1)
  }
  console.log(`  → bulk_sales: ${bulkSales?.length || 0}件\n`)

  // 4. manual_sales を取得
  console.log('4. manual_sales テーブルを取得中...')
  let allManualSales = []
  from = 0

  while (true) {
    const { data, error } = await supabase
      .from('manual_sales')
      .select('*')
      .not('sale_date', 'is', null)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('manual_sales 取得エラー:', error)
      process.exit(1)
    }

    if (!data || data.length === 0) break
    allManualSales = allManualSales.concat(data)
    console.log(`  ${allManualSales.length}件取得済み...`)

    if (data.length < pageSize) break
    from += pageSize
  }
  console.log(`  → manual_sales: ${allManualSales.length}件\n`)

  // 5. sales_summary に挿入するデータを作成
  console.log('5. sales_summary 用のデータを作成中...\n')
  const salesSummaryData = []

  // bulk_sales のキーを記録（重複排除用）
  const bulkSalesKeys = new Set()
  bulkSales?.forEach(sale => {
    if (sale.product_name && sale.sale_date) {
      const key = `${sale.product_name.trim().toLowerCase()}|${sale.sale_date}`
      bulkSalesKeys.add(key)
    }
  })

  // 5-1. inventory（単品）
  allInventory.forEach(item => {
    const salePrice = item.sale_price || 0
    const purchaseCost = item.purchase_total || 0
    const purchasePrice = item.purchase_price || 0
    const commission = item.commission || 0
    const shippingCost = item.shipping_cost || 0
    const otherCost = item.other_cost || 0
    const depositAmount = item.deposit_amount || 0
    const profit = depositAmount - purchaseCost - otherCost
    const profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100) : 0

    salesSummaryData.push({
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
      purchase_price: purchasePrice,
      purchase_cost: purchaseCost,
      deposit_amount: item.deposit_amount,
      profit,
      profit_rate: profitRate,
      purchase_date: sanitizeDate(item.purchase_date),
      listing_date: sanitizeDate(item.listing_date),
      sale_date: sanitizeDate(item.sale_date),
      turnover_days: calculateTurnoverDays(item.purchase_date, item.sale_date),
      memo: item.memo,
      quantity: 1
    })
  })
  console.log(`  単品（single）: ${allInventory.length}件`)

  // 5-2. bulk_sales（まとめ売り）
  let bulkCount = 0
  bulkSales?.forEach(sale => {
    const bulkPurchase = bulkPurchaseMap.get(sale.bulk_purchase_id)
    if (!bulkPurchase) return

    const hasProductDetails = sale.product_name || sale.brand_name || sale.category
    const unitCost = bulkPurchase.total_quantity > 0
      ? Math.round(bulkPurchase.total_amount / bulkPurchase.total_quantity)
      : 0
    const purchasePrice = sale.purchase_price ?? unitCost * sale.quantity
    const otherCost = sale.other_cost ?? 0
    const depositAmount = sale.deposit_amount || 0
    const profit = depositAmount - purchasePrice - otherCost
    const profitRate = sale.sale_amount > 0 ? Math.round((profit / sale.sale_amount) * 100) : 0

    salesSummaryData.push({
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
      purchase_price: purchasePrice,
      purchase_cost: purchasePrice + otherCost,
      deposit_amount: sale.deposit_amount,
      profit,
      profit_rate: profitRate,
      purchase_date: sanitizeDate(bulkPurchase.purchase_date),
      listing_date: sanitizeDate(sale.listing_date),
      sale_date: sanitizeDate(sale.sale_date),
      turnover_days: calculateTurnoverDays(bulkPurchase.purchase_date, sale.sale_date),
      memo: sale.memo,
      quantity: sale.quantity
    })
    bulkCount++
  })
  console.log(`  まとめ売り（bulk）: ${bulkCount}件`)

  // 5-3. manual_sales（手入力）- cost_recovered が false のもののみ、bulk_sales と重複しないもの
  let manualCount = 0
  allManualSales.forEach(item => {
    if (item.cost_recovered) return

    // bulk_sales との重複チェック
    if (item.product_name && item.sale_date) {
      const key = `${item.product_name.trim().toLowerCase()}|${item.sale_date}`
      if (bulkSalesKeys.has(key)) return
    }

    const salePrice = item.sale_price || 0
    const purchaseCost = item.purchase_total || 0
    const commission = item.commission || 0
    const shippingCost = item.shipping_cost || 0
    const otherCost = item.other_cost || 0
    const profit = item.profit ?? (salePrice - purchaseCost - commission - shippingCost - otherCost)
    const profitRate = item.profit_rate ?? (salePrice > 0 ? Math.round((profit / salePrice) * 100) : 0)

    salesSummaryData.push({
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
      purchase_price: purchaseCost,
      purchase_cost: purchaseCost,
      deposit_amount: salePrice - commission - shippingCost - otherCost,
      profit,
      profit_rate: profitRate,
      purchase_date: sanitizeDate(item.purchase_date),
      listing_date: sanitizeDate(item.listing_date),
      sale_date: sanitizeDate(item.sale_date),
      turnover_days: calculateTurnoverDays(item.purchase_date, item.sale_date),
      memo: item.memo,
      quantity: 1
    })
    manualCount++
  })
  console.log(`  手入力（manual）: ${manualCount}件`)
  console.log(`\n  合計: ${salesSummaryData.length}件\n`)

  // 6. sales_summary に挿入（バッチ処理）
  console.log('6. sales_summary テーブルにデータを挿入中...')
  const batchSize = 500
  let insertedCount = 0
  let errorCount = 0

  for (let i = 0; i < salesSummaryData.length; i += batchSize) {
    const batch = salesSummaryData.slice(i, i + batchSize)

    const { error } = await supabase
      .from('sales_summary')
      .upsert(batch, { onConflict: 'source_type,source_id' })

    if (error) {
      console.error(`  バッチ ${Math.floor(i / batchSize) + 1} でエラー:`, error.message)
      errorCount += batch.length
    } else {
      insertedCount += batch.length
      console.log(`  ${insertedCount}/${salesSummaryData.length}件 挿入済み...`)
    }
  }

  console.log('\n=== マイグレーション完了 ===')
  console.log(`成功: ${insertedCount}件`)
  console.log(`エラー: ${errorCount}件`)
}

migrateToSalesSummary().catch(console.error)
