// 在庫高（原価）計算 — ダッシュボードと資産状況ページで共通利用

type InventoryForCalc = {
  purchase_price: number | null
  purchase_total: number | null
  sale_date: string | null
  listing_date: string | null
}

type BulkPurchaseForCalc = {
  id: string
  total_amount: number
}

type BulkSaleForCalc = {
  bulk_purchase_id: string
  sale_destination: string | null
  sale_amount: number
  commission: number
  shipping_cost: number
  purchase_price: number | null
  other_cost: number | null
  deposit_amount: number | null
}

export function calcStockValueCost(
  inventory: InventoryForCalc[],
  bulkPurchases: BulkPurchaseForCalc[],
  bulkSales: BulkSaleForCalc[],
): number {
  const isExcludedText = (value: string | null) => {
    if (!value) return false
    return value.includes('返品') || value.includes('不明')
  }

  // 単品在庫の原価
  const validItems = inventory.filter(item =>
    !isExcludedText(item.sale_date) && !isExcludedText(item.listing_date)
  )
  const unsold = validItems.filter(item => !item.sale_date)
  const unsoldValueCost = unsold.reduce((sum, item) => sum + (item.purchase_price || 0), 0)

  // まとめ仕入れの未回収額
  let bulkCumulativeProfit = 0
  bulkPurchases.forEach(bp => {
    const relatedSales = bulkSales.filter(sale => sale.bulk_purchase_id === bp.id)

    bulkCumulativeProfit -= bp.total_amount
    relatedSales.forEach(sale => {
      if (sale.sale_destination) {
        const depositAmount = sale.deposit_amount ?? ((sale.sale_amount || 0) - (sale.commission || 0) - (sale.shipping_cost || 0))
        bulkCumulativeProfit += depositAmount
      } else {
        bulkCumulativeProfit -= (sale.purchase_price || 0)
      }
    })
  })

  const bulkUnrecovered = Math.max(0, -bulkCumulativeProfit)
  const bulkUnrecoveredExTax = Math.round(bulkUnrecovered / 1.1)

  return unsoldValueCost + bulkUnrecoveredExTax
}
