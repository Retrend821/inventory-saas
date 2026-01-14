'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type MonthlyGoal = {
  id?: string
  user_id?: string
  year: number
  month: number
  sales_goal: number
  profit_goal: number
  sold_count_goal: number
  purchase_count_goal: number
  listed_count_goal: number
  purchase_total_goal: number
  profit_rate_goal: number
  avg_sale_price_goal: number
  avg_profit_goal: number
  avg_purchase_price_goal: number
  stock_count_turnover_goal: number
  cost_turnover_goal: number
  sales_turnover_goal: number
  overall_profitability_goal: number
  gmroi_goal: number
}

type InventoryItem = {
  id: string
  product_name: string
  brand_name: string | null
  purchase_price: number | null
  purchase_total: number | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  other_cost: number | null
  deposit_amount: number | null
  status: string
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  sale_destination: string | null
}

type ManualSale = {
  id: string
  product_name: string
  purchase_total: number | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  profit: number | null
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
}

type BulkPurchase = {
  id: string
  genre: string
  purchase_date: string
  total_amount: number
  total_quantity: number
}

type BulkSale = {
  id: string
  bulk_purchase_id: string
  sale_date: string
  quantity: number
}

export default function SummaryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [manualSales, setManualSales] = useState<ManualSale[]>([])
  const [bulkPurchases, setBulkPurchases] = useState<BulkPurchase[]>([])
  const [bulkSales, setBulkSales] = useState<BulkSale[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [monthlyGoal, setMonthlyGoal] = useState<MonthlyGoal | null>(null)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [goalForm, setGoalForm] = useState<MonthlyGoal>({
    year: 0,
    month: 0,
    sales_goal: 0,
    profit_goal: 0,
    sold_count_goal: 0,
    purchase_count_goal: 0,
    listed_count_goal: 0,
    purchase_total_goal: 0,
    profit_rate_goal: 0,
    avg_sale_price_goal: 0,
    avg_profit_goal: 0,
    avg_purchase_price_goal: 0,
    stock_count_turnover_goal: 0,
    cost_turnover_goal: 0,
    sales_turnover_goal: 0,
    overall_profitability_goal: 0,
    gmroi_goal: 0,
  })

  // 目標値を取得
  const fetchGoal = useCallback(async (year: string, month: string) => {
    if (!year || month === 'all') {
      setMonthlyGoal(null)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('monthly_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', parseInt(year))
      .eq('month', parseInt(month))
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching goal:', error)
    }
    setMonthlyGoal(data || null)
    if (data) {
      setGoalForm(data)
    } else {
      setGoalForm({
        year: parseInt(year),
        month: parseInt(month),
        sales_goal: 0,
        profit_goal: 0,
        sold_count_goal: 0,
        purchase_count_goal: 0,
        listed_count_goal: 0,
        purchase_total_goal: 0,
        profit_rate_goal: 0,
        avg_sale_price_goal: 0,
        avg_profit_goal: 0,
        avg_purchase_price_goal: 0,
        stock_count_turnover_goal: 0,
        cost_turnover_goal: 0,
        sales_turnover_goal: 0,
        overall_profitability_goal: 0,
        gmroi_goal: 0,
      })
    }
  }, [])

  // 目標値を保存
  const saveGoal = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const goalData = {
      user_id: user.id,
      year: parseInt(selectedYear),
      month: parseInt(selectedMonth),
      sales_goal: goalForm.sales_goal,
      profit_goal: goalForm.profit_goal,
      sold_count_goal: goalForm.sold_count_goal,
      purchase_count_goal: goalForm.purchase_count_goal,
      listed_count_goal: goalForm.listed_count_goal,
      purchase_total_goal: goalForm.purchase_total_goal,
      profit_rate_goal: goalForm.profit_rate_goal,
      avg_sale_price_goal: goalForm.avg_sale_price_goal,
      avg_profit_goal: goalForm.avg_profit_goal,
      avg_purchase_price_goal: goalForm.avg_purchase_price_goal,
      stock_count_turnover_goal: goalForm.stock_count_turnover_goal,
      cost_turnover_goal: goalForm.cost_turnover_goal,
      sales_turnover_goal: goalForm.sales_turnover_goal,
      overall_profitability_goal: goalForm.overall_profitability_goal,
      gmroi_goal: goalForm.gmroi_goal,
    }

    const { data, error } = await supabase
      .from('monthly_goals')
      .upsert(goalData, { onConflict: 'user_id,year,month' })
      .select()
      .single()

    if (error) {
      console.error('Error saving goal:', error)
      alert('目標の保存に失敗しました')
    } else {
      setMonthlyGoal(data)
      setIsEditingGoal(false)
    }
  }

  // 年月が変更されたら目標を取得
  useEffect(() => {
    if (selectedYear && selectedMonth && selectedMonth !== 'all') {
      fetchGoal(selectedYear, selectedMonth)
    } else {
      setMonthlyGoal(null)
    }
  }, [selectedYear, selectedMonth, fetchGoal])

  useEffect(() => {
    const fetchData = async () => {
      // inventoryを全件取得
      let allInventory: InventoryItem[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error fetching inventory:', error)
          break
        }

        if (data && data.length > 0) {
          allInventory = [...allInventory, ...data]
          from += pageSize
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }

      // manual_salesを全件取得
      let allManualSales: ManualSale[] = []
      from = 0
      hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_sales')
          .select('id, product_name, purchase_total, sale_price, commission, shipping_cost, profit, purchase_date, listing_date, sale_date')
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error fetching manual_sales:', error)
          break
        }

        if (data && data.length > 0) {
          allManualSales = [...allManualSales, ...data]
          from += pageSize
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }

      // bulk_purchasesを取得
      const { data: bulkPurchaseData, error: bulkPurchaseError } = await supabase
        .from('bulk_purchases')
        .select('id, genre, purchase_date, total_amount, total_quantity')

      if (bulkPurchaseError) {
        console.error('Error fetching bulk_purchases:', bulkPurchaseError)
      }

      // bulk_salesを取得
      const { data: bulkSaleData, error: bulkSaleError } = await supabase
        .from('bulk_sales')
        .select('id, bulk_purchase_id, sale_date, quantity')

      if (bulkSaleError) {
        console.error('Error fetching bulk_sales:', bulkSaleError)
      }

      setInventory(allInventory)
      setManualSales(allManualSales)
      setBulkPurchases(bulkPurchaseData || [])
      setBulkSales(bulkSaleData || [])
      setLoading(false)
    }

    fetchData()

    // 現在の年月をデフォルトで設定
    const now = new Date()
    setSelectedYear(now.getFullYear().toString())
    setSelectedMonth((now.getMonth() + 1).toString().padStart(2, '0'))
  }, [])

  // 日付から年を抽出（YYYY-MM-DDまたはYYYY/MM/DD形式対応）
  const extractYear = (dateStr: string | null): string | null => {
    if (!dateStr) return null
    // 先頭4文字が年
    const year = dateStr.substring(0, 4)
    // 4桁の数字で、妥当な年（2000年以降）のみ
    if (/^\d{4}$/.test(year) && parseInt(year) >= 2000) {
      return year
    }
    return null
  }

  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    // 現在の年は必ず含める
    years.add(new Date().getFullYear().toString())
    inventory.forEach(item => {
      const saleYear = extractYear(item.sale_date)
      if (saleYear) years.add(saleYear)
      const purchaseYear = extractYear(item.purchase_date)
      if (purchaseYear) years.add(purchaseYear)
    })
    // 手入力売上からも年を取得
    manualSales.forEach(item => {
      const saleYear = extractYear(item.sale_date)
      if (saleYear) years.add(saleYear)
    })
    return [...years].sort().reverse()
  }, [inventory, manualSales])

  // 月のリスト（年間オプション付き）
  const months = ['all', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

  // 有効な日付形式かどうかをチェック（YYYY-MM-DD または YYYY/MM/DD形式）
  const isValidDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false
    // 「返品」「不明」などの除外
    if (/返品|不明|キャンセル/.test(dateStr)) return false
    // YYYY-MM-DD または YYYY/MM/DD 形式かチェック
    return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)
  }

  // 日付を統一形式（YYYY-MM）に変換
  const normalizeYearMonth = (dateStr: string): string => {
    // YYYY/MM/DD → YYYY-MM、YYYY-MM-DD → YYYY-MM
    return dateStr.substring(0, 7).replace('/', '-')
  }

  // 日付を統一形式（YYYY-MM-DD）に変換
  const normalizeDate = (dateStr: string): string => {
    // YYYY/MM/DD → YYYY-MM-DD
    return dateStr.substring(0, 10).replace(/\//g, '-')
  }

  // 月末在庫を計算するためのヘルパー関数（単品のみ）
  const getEndOfMonthSingleStock = useCallback((year: string, month: string) => {
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`

    return inventory.filter(item => {
      const purchaseDate = item.purchase_date
      const saleDate = item.sale_date
      if (!isValidDate(purchaseDate)) return false
      const normalizedPurchase = normalizeDate(purchaseDate!)
      if (normalizedPurchase > endDate) return false
      if (item.sale_destination === '返品') return false
      if (!saleDate) return true
      if (isValidDate(saleDate)) {
        const normalizedSale = normalizeDate(saleDate!)
        return normalizedSale > endDate
      }
      return false
    })
  }, [inventory])

  // まとめ仕入れの月末在庫を計算（数量と金額を返す）
  const getBulkEndOfMonthStock = useCallback((year: string, month: string) => {
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`

    let totalCount = 0
    let totalValue = 0

    bulkPurchases.forEach(bp => {
      if (!bp.purchase_date || normalizeDate(bp.purchase_date) > endDate) return
      const soldQuantity = bulkSales
        .filter(sale =>
          sale.bulk_purchase_id === bp.id &&
          sale.sale_date &&
          normalizeDate(sale.sale_date) <= endDate
        )
        .reduce((sum, sale) => sum + sale.quantity, 0)
      const remainingQuantity = bp.total_quantity - soldQuantity
      if (remainingQuantity > 0) {
        totalCount += remainingQuantity
        const unitCost = bp.total_quantity > 0 ? bp.total_amount / bp.total_quantity : 0
        totalValue += unitCost * remainingQuantity
      }
    })

    return { count: totalCount, value: Math.round(totalValue) }
  }, [bulkPurchases, bulkSales])

  // 月末在庫（単品＋まとめ）
  const getEndOfMonthStock = useCallback((year: string, month: string) => {
    const singleStock = getEndOfMonthSingleStock(year, month)
    const bulkStock = getBulkEndOfMonthStock(year, month)
    return {
      count: singleStock.length + bulkStock.count,
      value: singleStock.reduce((sum, item) => sum + (item.purchase_total || 0), 0) + bulkStock.value
    }
  }, [getEndOfMonthSingleStock, getBulkEndOfMonthStock])

  // 前月末在庫を取得する関数
  const getPrevMonthEndStock = useCallback((year: string, month: string) => {
    const monthNum = parseInt(month)
    if (monthNum === 1) {
      return getEndOfMonthStock((parseInt(year) - 1).toString(), '12')
    } else {
      return getEndOfMonthStock(year, (monthNum - 1).toString().padStart(2, '0'))
    }
  }, [getEndOfMonthStock])

  // 指定年月の集計を計算するヘルパー関数
  const calculateSummaryForMonth = useCallback((year: string, month: string) => {
    const isYearly = month === 'all'
    const yearMonth = `${year}-${month}`

    // 売却日が選択年月のアイテム（売上日に日付が入っているもの、返品を除く）
    const soldItems = inventory.filter(item => {
      if (!isValidDate(item.sale_date)) return false
      if (item.sale_destination === '返品') return false
      const normalized = normalizeYearMonth(item.sale_date!)
      return isYearly
        ? normalized.startsWith(year)
        : normalized === yearMonth
    })

    // 手入力売上の売却日が選択年月のアイテム
    const manualSoldItems = manualSales.filter(item => {
      if (!isValidDate(item.sale_date)) return false
      const normalized = normalizeYearMonth(item.sale_date!)
      return isYearly
        ? normalized.startsWith(year)
        : normalized === yearMonth
    })

    // 仕入日が選択年月のアイテム
    const purchasedItems = inventory.filter(item => {
      if (!isValidDate(item.purchase_date)) return false
      const normalized = normalizeYearMonth(item.purchase_date!)
      return isYearly
        ? normalized.startsWith(year)
        : normalized === yearMonth
    })

    // 出品日が選択年月のアイテム
    const listedItems = inventory.filter(item => {
      if (!isValidDate(item.listing_date)) return false
      const normalized = normalizeYearMonth(item.listing_date!)
      return isYearly
        ? normalized.startsWith(year)
        : normalized === yearMonth
    })

    // 販売件数（単品 + 手入力）
    const soldCount = soldItems.length + manualSoldItems.length

    // 仕入件数
    const purchasedCount = purchasedItems.length

    // 出品件数
    const listedCount = listedItems.length

    // 売上（税込）- 売値の合計（単品 + 手入力）
    const totalSales = soldItems.reduce((sum, item) => sum + (item.sale_price || 0), 0)
      + manualSoldItems.reduce((sum, item) => sum + (item.sale_price || 0), 0)

    // 仕入（税込）- 売却商品の仕入総額（単品 + 手入力）
    const totalPurchase = soldItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)
      + manualSoldItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

    // 販売利益
    const invProfit = soldItems.reduce((sum, item) => {
      const salePrice = item.sale_price || 0
      const commission = item.commission || 0
      const shipping = item.shipping_cost || 0
      const otherCost = item.other_cost || 0
      const purchaseTotal = item.purchase_total || 0
      return sum + (salePrice - commission - shipping - otherCost - purchaseTotal)
    }, 0)
    const manualProfit = manualSoldItems.reduce((sum, item) => sum + (item.profit || 0), 0)
    const totalProfit = invProfit + manualProfit

    // 販売利益率
    const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0

    // 販売単価（売上 / 販売件数）
    const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0

    // 利益単価（利益 / 販売件数）
    const avgProfit = soldCount > 0 ? Math.round(totalProfit / soldCount) : 0

    // 仕入単価（仕入総額 / 販売件数）
    const avgPurchasePrice = soldCount > 0 ? Math.round(totalPurchase / soldCount) : 0

    // 売上原価（売却商品の仕入総額）
    const costOfGoodsSold = totalPurchase

    // 回転率計算用の在庫データ
    const prevMonthEndStock = getPrevMonthEndStock(year, month)
    const currentMonthEndStock = getEndOfMonthStock(year, month)
    const avgStockCount = (prevMonthEndStock.count + currentMonthEndStock.count) / 2
    const avgStockValue = (prevMonthEndStock.value + currentMonthEndStock.value) / 2

    // 在庫数回転率（販売件数 / 平均在庫数）を%表示（小数点1位まで）
    const stockCountTurnover = avgStockCount > 0 ? Math.round((soldCount / avgStockCount) * 1000) / 10 : 0
    // 売上高回転率（売上 / 平均在庫高）を%表示（小数点1位まで）
    const salesTurnover = avgStockValue > 0 ? Math.round((totalSales / avgStockValue) * 1000) / 10 : 0
    // 売上原価回転率（売上原価 / 平均在庫高）を%表示（小数点1位まで）
    const costTurnover = avgStockValue > 0 ? Math.round((costOfGoodsSold / avgStockValue) * 1000) / 10 : 0
    // 総合収益性（利益 / 平均在庫高）を%表示（小数点1位まで）
    const overallProfitability = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 1000) / 10 : 0
    // GMROI（粗利益 / 平均在庫高）を小数点2位まで
    const gmroi = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 100) / 100 : 0

    return {
      soldCount,
      purchasedCount,
      listedCount,
      totalSales,
      totalPurchase,
      totalProfit,
      profitRate,
      avgSalePrice,
      avgProfit,
      avgPurchasePrice,
      stockCountTurnover,
      salesTurnover,
      costTurnover,
      overallProfitability,
      gmroi,
    }
  }, [inventory, manualSales, getEndOfMonthStock, getPrevMonthEndStock])

  // 前月の年月を取得
  const getPreviousMonth = (year: string, month: string): { year: string, month: string } => {
    const monthNum = parseInt(month)
    if (monthNum === 1) {
      return { year: (parseInt(year) - 1).toString(), month: '12' }
    } else {
      return { year, month: (monthNum - 1).toString().padStart(2, '0') }
    }
  }

  // 選択された年月でフィルタリングした集計
  const summary = useMemo(() => {
    if (!selectedYear || !selectedMonth) return null

    const isYearly = selectedMonth === 'all'
    const yearMonth = `${selectedYear}-${selectedMonth}`

    // 売却日が選択年月のアイテム（売上日に日付が入っているもの、返品を除く）
    const soldItems = inventory.filter(item => {
      if (!isValidDate(item.sale_date)) return false
      if (item.sale_destination === '返品') return false
      const normalized = normalizeYearMonth(item.sale_date!)
      return isYearly
        ? normalized.startsWith(selectedYear)
        : normalized === yearMonth
    })

    // 手入力売上の売却日が選択年月のアイテム
    const manualSoldItems = manualSales.filter(item => {
      if (!isValidDate(item.sale_date)) return false
      const normalized = normalizeYearMonth(item.sale_date!)
      return isYearly
        ? normalized.startsWith(selectedYear)
        : normalized === yearMonth
    })

    // 仕入日が選択年月のアイテム
    const purchasedItems = inventory.filter(item => {
      if (!isValidDate(item.purchase_date)) return false
      const normalized = normalizeYearMonth(item.purchase_date!)
      return isYearly
        ? normalized.startsWith(selectedYear)
        : normalized === yearMonth
    })

    // 出品日が選択年月のアイテム
    const listedItems = inventory.filter(item => {
      if (!isValidDate(item.listing_date)) return false
      const normalized = normalizeYearMonth(item.listing_date!)
      return isYearly
        ? normalized.startsWith(selectedYear)
        : normalized === yearMonth
    })

    // 販売件数（単品 + 手入力）
    const soldCount = soldItems.length + manualSoldItems.length

    // 仕入件数
    const purchasedCount = purchasedItems.length

    // 出品件数
    const listedCount = listedItems.length

    // 売上（税込）- 売値の合計（単品 + 手入力）
    const totalSales = soldItems.reduce((sum, item) => sum + (item.sale_price || 0), 0)
      + manualSoldItems.reduce((sum, item) => sum + (item.sale_price || 0), 0)

    // 仕入（税込）- 売却商品の仕入総額（単品 + 手入力）
    const totalPurchase = soldItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)
      + manualSoldItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

    // 手数料の合計（単品 + 手入力）
    const totalCommission = soldItems.reduce((sum, item) => sum + (item.commission || 0), 0)
      + manualSoldItems.reduce((sum, item) => sum + (item.commission || 0), 0)

    // 送料の合計（単品 + 手入力）
    const totalShipping = soldItems.reduce((sum, item) => sum + (item.shipping_cost || 0), 0)
      + manualSoldItems.reduce((sum, item) => sum + (item.shipping_cost || 0), 0)

    // 販売利益
    // 単品: 売値 - 手数料 - 送料 - その他経費 - 仕入総額
    // 手入力: DBに保存された利益値を使用（other_cost等が反映済み）
    const invProfit = soldItems.reduce((sum, item) => {
      const salePrice = item.sale_price || 0
      const commission = item.commission || 0
      const shipping = item.shipping_cost || 0
      const otherCost = item.other_cost || 0
      const purchaseTotal = item.purchase_total || 0
      return sum + (salePrice - commission - shipping - otherCost - purchaseTotal)
    }, 0)
    const manualProfit = manualSoldItems.reduce((sum, item) => sum + (item.profit || 0), 0)
    const totalProfit = invProfit + manualProfit

    // 販売利益率
    const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0

    // 販売単価（売上 / 販売件数）
    const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0

    // 利益単価（利益 / 販売件数）
    const avgProfit = soldCount > 0 ? Math.round(totalProfit / soldCount) : 0

    // 仕入単価（仕入総額 / 販売件数）
    const avgPurchasePrice = soldCount > 0 ? Math.round(totalPurchase / soldCount) : 0

    // 売上原価（売却商品の仕入総額）
    const costOfGoodsSold = totalPurchase

    // 回転率計算用の在庫データ
    const prevMonthEndStock = getPrevMonthEndStock(selectedYear, selectedMonth)
    const currentMonthEndStock = getEndOfMonthStock(selectedYear, selectedMonth)
    const avgStockCount = (prevMonthEndStock.count + currentMonthEndStock.count) / 2
    const avgStockValue = (prevMonthEndStock.value + currentMonthEndStock.value) / 2

    // 在庫数回転率（販売件数 / 平均在庫数）を%表示（小数点1位まで）
    const stockCountTurnover = avgStockCount > 0 ? Math.round((soldCount / avgStockCount) * 1000) / 10 : 0
    // 売上高回転率（売上 / 平均在庫高）を%表示（小数点1位まで）
    const salesTurnover = avgStockValue > 0 ? Math.round((totalSales / avgStockValue) * 1000) / 10 : 0
    // 売上原価回転率（売上原価 / 平均在庫高）を%表示（小数点1位まで）
    const costTurnover = avgStockValue > 0 ? Math.round((costOfGoodsSold / avgStockValue) * 1000) / 10 : 0
    // 総合収益性（利益 / 平均在庫高）を%表示（小数点1位まで）
    const overallProfitability = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 1000) / 10 : 0
    // GMROI（粗利益 / 平均在庫高）を小数点2位まで
    const gmroi = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 100) / 100 : 0

    // 着地ペース計算（当月のみ）
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const isCurrentMonth = !isYearly && parseInt(selectedYear) === currentYear && parseInt(selectedMonth) === currentMonth

    let projectedSales = totalSales
    let projectedProfit = totalProfit
    let projectedSoldCount = soldCount
    let projectedPurchasedCount = purchasedCount
    let projectedListedCount = listedCount
    let progressRatio = 1 // 目標ペース計算用（経過日数 / 月の日数）

    if (isCurrentMonth) {
      const today = now.getDate()
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
      const ratio = daysInMonth / today
      progressRatio = today / daysInMonth

      projectedSales = Math.round(totalSales * ratio)
      projectedProfit = Math.round(totalProfit * ratio)
      projectedSoldCount = Math.round(soldCount * ratio)
      projectedPurchasedCount = Math.round(purchasedCount * ratio)
      projectedListedCount = Math.round(listedCount * ratio)
    }

    return {
      soldCount,
      purchasedCount,
      listedCount,
      totalSales,
      totalPurchase,
      totalProfit,
      profitRate,
      avgSalePrice,
      avgProfit,
      avgPurchasePrice,
      stockCountTurnover,
      salesTurnover,
      costTurnover,
      overallProfitability,
      gmroi,
      currentStockValue: currentMonthEndStock.value,
      isCurrentMonth,
      progressRatio,
      projectedSales,
      projectedProfit,
      projectedSoldCount,
      projectedPurchasedCount,
      projectedListedCount,
    }
  }, [inventory, manualSales, selectedYear, selectedMonth, getEndOfMonthStock, getPrevMonthEndStock])

  // 前月の集計データ（前月比較用）
  const previousMonthSummary = useMemo(() => {
    if (!selectedYear || !selectedMonth || selectedMonth === 'all') return null

    const { year: prevYear, month: prevMonth } = getPreviousMonth(selectedYear, selectedMonth)
    return calculateSummaryForMonth(prevYear, prevMonth)
  }, [selectedYear, selectedMonth, calculateSummaryForMonth])

  // 月別集計データ（表形式用）
  const monthlyData = useMemo(() => {
    if (!selectedYear) return []

    const monthList = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

    // 月末在庫を計算するためのヘルパー関数（単品のみ）
    const getEndOfMonthSingleStock = (year: string, month: string) => {
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`

      return inventory.filter(item => {
        // 仕入日が月末以前で、売却日がない or 売却日が月末より後
        const purchaseDate = item.purchase_date
        const saleDate = item.sale_date
        // 有効な仕入日がないか、月末より後の仕入れは除外
        if (!isValidDate(purchaseDate)) return false
        const normalizedPurchase = normalizeDate(purchaseDate!)
        if (normalizedPurchase > endDate) return false
        // 返品は在庫から除外
        if (item.sale_destination === '返品') return false
        // 売却日が空（未販売）ならカウント
        if (!saleDate) return true
        // 有効な日付形式の売却日がある場合
        if (isValidDate(saleDate)) {
          const normalizedSale = normalizeDate(saleDate!)
          // 月末より後に売却されたなら、その時点では在庫としてカウント
          return normalizedSale > endDate
        }
        // 売却日に「返品」などの非日付テキストが入っている場合は在庫から除外
        return false
      })
    }

    // まとめ仕入れの月末在庫を計算（数量と金額を返す）
    const getBulkEndOfMonthStock = (year: string, month: string) => {
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`

      let totalCount = 0
      let totalValue = 0

      bulkPurchases.forEach(bp => {
        // 仕入日が月末以前のもののみ
        if (!bp.purchase_date || normalizeDate(bp.purchase_date) > endDate) return

        // このまとめ仕入れの売上数量を計算（月末以前に売れた分）
        const soldQuantity = bulkSales
          .filter(sale =>
            sale.bulk_purchase_id === bp.id &&
            sale.sale_date &&
            normalizeDate(sale.sale_date) <= endDate
          )
          .reduce((sum, sale) => sum + sale.quantity, 0)

        // 残在庫数
        const remainingQuantity = bp.total_quantity - soldQuantity
        if (remainingQuantity > 0) {
          totalCount += remainingQuantity
          // 単価 × 残数量
          const unitCost = bp.total_quantity > 0 ? bp.total_amount / bp.total_quantity : 0
          totalValue += unitCost * remainingQuantity
        }
      })

      return { count: totalCount, value: Math.round(totalValue) }
    }

    // 月末在庫（単品＋まとめ）
    const getEndOfMonthStock = (year: string, month: string) => {
      const singleStock = getEndOfMonthSingleStock(year, month)
      const bulkStock = getBulkEndOfMonthStock(year, month)
      return {
        count: singleStock.length + bulkStock.count,
        value: singleStock.reduce((sum, item) => sum + (item.purchase_total || 0), 0) + bulkStock.value
      }
    }

    // 前月末在庫を取得する関数
    const getPrevMonthEndStock = (year: string, month: string) => {
      const monthNum = parseInt(month)
      if (monthNum === 1) {
        // 1月の場合は前年12月末
        return getEndOfMonthStock((parseInt(year) - 1).toString(), '12')
      } else {
        return getEndOfMonthStock(year, (monthNum - 1).toString().padStart(2, '0'))
      }
    }

    return monthList.map(month => {
      const yearMonth = `${selectedYear}-${month}`

      // 当月販売（売上日に日付が入っているもの、返品を除く）
      const soldItems = inventory.filter(item => {
        if (!isValidDate(item.sale_date)) return false
        if (item.sale_destination === '返品') return false
        return normalizeYearMonth(item.sale_date!) === yearMonth
      })

      // 手入力売上の当月販売
      const manualSoldItems = manualSales.filter(item => {
        if (!isValidDate(item.sale_date)) return false
        return normalizeYearMonth(item.sale_date!) === yearMonth
      })

      // 当月仕入（有効な日付形式のみ）
      const purchasedItems = inventory.filter(item => {
        if (!isValidDate(item.purchase_date)) return false
        return normalizeYearMonth(item.purchase_date!) === yearMonth
      })

      // 当月出品（有効な日付形式のみ）
      const listedItems = inventory.filter(item => {
        if (!isValidDate(item.listing_date)) return false
        return normalizeYearMonth(item.listing_date!) === yearMonth
      })

      // 前月末在庫・当月末在庫（単品＋まとめ）
      const prevMonthEndStock = getPrevMonthEndStock(selectedYear, month)
      const currentMonthEndStock = getEndOfMonthStock(selectedYear, month)

      const prevMonthEndStockCount = prevMonthEndStock.count
      const currentMonthEndStockCount = currentMonthEndStock.count

      // 月初在庫高（前月末在庫の仕入総額）
      const beginningStockValue = prevMonthEndStock.value

      // 当月末在庫残高
      const endingStockValue = currentMonthEndStock.value

      // 販売件数（単品 + 手入力）
      const soldCount = soldItems.length + manualSoldItems.length

      // 仕入数・仕入高
      const purchasedCount = purchasedItems.length
      const purchaseValue = purchasedItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

      // 平均仕入単価
      const avgPurchasePrice = purchasedCount > 0 ? Math.round(purchaseValue / purchasedCount) : 0

      // 出品数
      const listedCount = listedItems.length

      // 売上（単品 + 手入力）
      const totalSales = soldItems.reduce((sum, item) => sum + (item.sale_price || 0), 0)
        + manualSoldItems.reduce((sum, item) => sum + (item.sale_price || 0), 0)

      // 売上原価（売却商品の仕入総額）（単品 + 手入力）
      const costOfGoodsSold = soldItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)
        + manualSoldItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

      // 手数料・送料（単品 + 手入力）
      const totalCommission = soldItems.reduce((sum, item) => sum + (item.commission || 0), 0)
        + manualSoldItems.reduce((sum, item) => sum + (item.commission || 0), 0)
      const totalShipping = soldItems.reduce((sum, item) => sum + (item.shipping_cost || 0), 0)
        + manualSoldItems.reduce((sum, item) => sum + (item.shipping_cost || 0), 0)

      // 販売利益
      // 単品: 売値 - 手数料 - 送料 - その他経費 - 仕入総額
      // 手入力: DBに保存された利益値を使用
      const invProfit = soldItems.reduce((sum, item) => {
        const salePrice = item.sale_price || 0
        const commission = item.commission || 0
        const shipping = item.shipping_cost || 0
        const otherCost = item.other_cost || 0
        const purchaseTotal = item.purchase_total || 0
        return sum + (salePrice - commission - shipping - otherCost - purchaseTotal)
      }, 0)
      const manualProfit = manualSoldItems.reduce((sum, item) => sum + (item.profit || 0), 0)
      const totalProfit = invProfit + manualProfit

      // 販売利益率
      const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0

      // 平均在庫（月初と月末の平均）
      const avgStockValue = (beginningStockValue + endingStockValue) / 2

      // 在庫数回転率（販売件数 / 平均在庫数）を%表示（小数点1位まで）
      const avgStockCount = (prevMonthEndStockCount + currentMonthEndStockCount) / 2
      const stockCountTurnover = avgStockCount > 0 ? Math.round((soldCount / avgStockCount) * 1000) / 10 : 0

      // 売上高回転率（売上 / 平均在庫高）を%表示（小数点1位まで）
      const salesTurnover = avgStockValue > 0 ? Math.round((totalSales / avgStockValue) * 1000) / 10 : 0

      // 売上原価回転率（売上原価 / 平均在庫高）を%表示（小数点1位まで）
      const costTurnover = avgStockValue > 0 ? Math.round((costOfGoodsSold / avgStockValue) * 1000) / 10 : 0

      // 総合収益性（利益 / 平均在庫高）を%表示（小数点1位まで）
      const overallProfitability = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 1000) / 10 : 0

      return {
        month: parseInt(month),
        prevMonthEndStockCount,
        currentMonthEndStockCount,
        beginningStockValue,
        endingStockValue,
        stockCountTurnover,
        salesTurnover,
        costTurnover,
        overallProfitability,
        purchasedCount,
        purchaseValue,
        avgPurchasePrice,
        listedCount,
        soldCount,
        totalSales,
        costOfGoodsSold,
        totalProfit,
        profitRate,
      }
    })
  }, [inventory, manualSales, bulkPurchases, bulkSales, selectedYear])

  // 年間合計
  const yearlyTotal = useMemo(() => {
    if (!monthlyData.length) return null

    const soldCount = monthlyData.reduce((sum, m) => sum + m.soldCount, 0)
    const purchasedCount = monthlyData.reduce((sum, m) => sum + m.purchasedCount, 0)
    const listedCount = monthlyData.reduce((sum, m) => sum + m.listedCount, 0)
    const totalSales = monthlyData.reduce((sum, m) => sum + m.totalSales, 0)
    const purchaseValue = monthlyData.reduce((sum, m) => sum + m.purchaseValue, 0)
    const costOfGoodsSold = monthlyData.reduce((sum, m) => sum + m.costOfGoodsSold, 0)
    const totalProfit = monthlyData.reduce((sum, m) => sum + m.totalProfit, 0)
    const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0
    const avgPurchasePrice = purchasedCount > 0 ? Math.round(purchaseValue / purchasedCount) : 0

    // 年間の回転率は12月末と前年12月末の在庫で計算
    const dec = monthlyData[11]
    const jan = monthlyData[0]

    // 年初在庫（1月の前月末在庫）と年末在庫（12月末在庫）
    const beginningStockCount = jan?.prevMonthEndStockCount || 0
    const endingStockCount = dec?.currentMonthEndStockCount || 0
    const beginningStockValue = jan?.beginningStockValue || 0
    const endingStockValue = dec?.endingStockValue || 0

    const avgStockCount = (beginningStockCount + endingStockCount) / 2
    const avgStockValue = (beginningStockValue + endingStockValue) / 2

    const stockCountTurnover = avgStockCount > 0 ? Math.round((soldCount / avgStockCount) * 1000) / 10 : 0
    const salesTurnover = avgStockValue > 0 ? Math.round((totalSales / avgStockValue) * 1000) / 10 : 0
    const costTurnover = avgStockValue > 0 ? Math.round((costOfGoodsSold / avgStockValue) * 1000) / 10 : 0
    const overallProfitability = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 1000) / 10 : 0

    return {
      prevMonthEndStockCount: beginningStockCount,
      currentMonthEndStockCount: endingStockCount,
      beginningStockValue,
      endingStockValue,
      stockCountTurnover,
      salesTurnover,
      costTurnover,
      overallProfitability,
      purchasedCount,
      purchaseValue,
      avgPurchasePrice,
      listedCount,
      soldCount,
      totalSales,
      costOfGoodsSold,
      totalProfit,
      profitRate,
    }
  }, [monthlyData])

  // 前月比表示用のヘルパー関数
  const formatDiff = (current: number, previous: number | undefined, isPercentage: boolean = false, isCurrency: boolean = true) => {
    if (previous === undefined || previous === null) return null
    const diff = current - previous
    const percentChange = previous !== 0 ? Math.round((diff / previous) * 100) : (diff !== 0 ? 100 : 0)

    const diffSign = diff >= 0 ? '+' : ''
    const diffColor = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500'

    if (isPercentage) {
      // 小数点1位で丸める
      const roundedDiff = Math.round(diff * 10) / 10
      return (
        <span className={`${diffColor} text-xs`}>
          {roundedDiff >= 0 ? '+' : ''}{roundedDiff}pt
        </span>
      )
    }

    return (
      <span className={`${diffColor} text-xs`}>
        {isCurrency ? `${diff >= 0 ? '+' : '-'}¥${Math.abs(diff).toLocaleString()}` : `${diffSign}${diff}`}
        <span className="ml-1 text-gray-400">({diffSign}{percentChange}%)</span>
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">集計・分析</h1>

        {/* 年月選択 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">年:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">月:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                {months.map(month => (
                  <option key={month} value={month}>
                    {month === 'all' ? '年間' : `${parseInt(month)}月`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 集計結果 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            読み込み中...
          </div>
        ) : summary ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                {selectedYear}年{selectedMonth === 'all' ? '間' : `${parseInt(selectedMonth)}月`}の集計
              </h2>
              {selectedMonth !== 'all' && (
                <button
                  onClick={() => setIsEditingGoal(!isEditingGoal)}
                  className="text-sm text-slate-300 hover:text-white transition-colors"
                >
                  {isEditingGoal ? 'キャンセル' : '目標を設定'}
                </button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">項目</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">実績</th>
                  {selectedMonth !== 'all' && (
                    <th className="px-6 py-3 text-right text-xs font-semibold text-purple-600">前月比</th>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <th className="px-6 py-3 text-right text-xs font-semibold text-orange-600">目標ペース</th>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <th className="px-6 py-3 text-right text-xs font-semibold text-blue-600">着地ペース</th>
                  )}
                  {selectedMonth !== 'all' && (
                    <th className="px-6 py-3 text-right text-xs font-semibold text-green-600">
                      目標
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">売上（税込）</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.totalSales.toLocaleString()}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.totalSales, previousMonthSummary?.totalSales)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.sales_goal ? (summary.totalSales >= Math.round(monthlyGoal.sales_goal * summary.progressRatio) ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.sales_goal ? `¥${Math.round(monthlyGoal.sales_goal * summary.progressRatio).toLocaleString()}` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">¥{summary.projectedSales.toLocaleString()}</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.sales_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, sales_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.sales_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.sales_goal ? `¥${monthlyGoal.sales_goal.toLocaleString()}` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">販売利益（税込）</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.totalProfit.toLocaleString()}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.totalProfit, previousMonthSummary?.totalProfit)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.profit_goal ? (summary.totalProfit >= Math.round(monthlyGoal.profit_goal * summary.progressRatio) ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.profit_goal ? `¥${Math.round(monthlyGoal.profit_goal * summary.progressRatio).toLocaleString()}` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">¥{summary.projectedProfit.toLocaleString()}</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.profit_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, profit_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.profit_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.profit_goal ? `¥${monthlyGoal.profit_goal.toLocaleString()}` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">仕入（税込）</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.totalPurchase.toLocaleString()}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.totalPurchase, previousMonthSummary?.totalPurchase)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.purchase_total_goal ? (summary.totalPurchase >= Math.round(monthlyGoal.purchase_total_goal * summary.progressRatio) ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.purchase_total_goal ? `¥${Math.round(monthlyGoal.purchase_total_goal * summary.progressRatio).toLocaleString()}` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">¥{summary.totalPurchase.toLocaleString()}</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.purchase_total_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, purchase_total_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.purchase_total_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.purchase_total_goal ? `¥${monthlyGoal.purchase_total_goal.toLocaleString()}` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">販売利益率</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.profitRate}%</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.profitRate, previousMonthSummary?.profitRate, true)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.profit_rate_goal ? (summary.profitRate >= monthlyGoal.profit_rate_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.profit_rate_goal ? `${monthlyGoal.profit_rate_goal}%` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.profitRate}%</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.profit_rate_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, profit_rate_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.profit_rate_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.profit_rate_goal ? `${monthlyGoal.profit_rate_goal}%` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">販売単価</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.avgSalePrice.toLocaleString()}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.avgSalePrice, previousMonthSummary?.avgSalePrice)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.avg_sale_price_goal ? (summary.avgSalePrice >= monthlyGoal.avg_sale_price_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.avg_sale_price_goal ? `¥${monthlyGoal.avg_sale_price_goal.toLocaleString()}` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">¥{summary.avgSalePrice.toLocaleString()}</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.avg_sale_price_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, avg_sale_price_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.avg_sale_price_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.avg_sale_price_goal ? `¥${monthlyGoal.avg_sale_price_goal.toLocaleString()}` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">利益単価</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.avgProfit.toLocaleString()}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.avgProfit, previousMonthSummary?.avgProfit)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.avg_profit_goal ? (summary.avgProfit >= monthlyGoal.avg_profit_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.avg_profit_goal ? `¥${monthlyGoal.avg_profit_goal.toLocaleString()}` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">¥{summary.avgProfit.toLocaleString()}</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.avg_profit_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, avg_profit_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.avg_profit_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.avg_profit_goal ? `¥${monthlyGoal.avg_profit_goal.toLocaleString()}` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">仕入単価</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.avgPurchasePrice.toLocaleString()}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.avgPurchasePrice, previousMonthSummary?.avgPurchasePrice)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.avg_purchase_price_goal ? (summary.avgPurchasePrice >= monthlyGoal.avg_purchase_price_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.avg_purchase_price_goal ? `¥${monthlyGoal.avg_purchase_price_goal.toLocaleString()}` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">¥{summary.avgPurchasePrice.toLocaleString()}</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.avg_purchase_price_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, avg_purchase_price_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.avg_purchase_price_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.avg_purchase_price_goal ? `¥${monthlyGoal.avg_purchase_price_goal.toLocaleString()}` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">仕入件数</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.purchasedCount}件</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.purchasedCount, previousMonthSummary?.purchasedCount, false, false)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.purchase_count_goal ? (summary.purchasedCount >= Math.round(monthlyGoal.purchase_count_goal * summary.progressRatio) ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.purchase_count_goal ? `${Math.round(monthlyGoal.purchase_count_goal * summary.progressRatio)}件` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.projectedPurchasedCount}件</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.purchase_count_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, purchase_count_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.purchase_count_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.purchase_count_goal ? `${monthlyGoal.purchase_count_goal}件` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">出品件数</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.listedCount}件</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.listedCount, previousMonthSummary?.listedCount, false, false)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.listed_count_goal ? (summary.listedCount >= Math.round(monthlyGoal.listed_count_goal * summary.progressRatio) ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.listed_count_goal ? `${Math.round(monthlyGoal.listed_count_goal * summary.progressRatio)}件` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.projectedListedCount}件</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.listed_count_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, listed_count_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.listed_count_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.listed_count_goal ? `${monthlyGoal.listed_count_goal}件` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">販売件数</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.soldCount}件</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.soldCount, previousMonthSummary?.soldCount, false, false)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.sold_count_goal ? (summary.soldCount >= Math.round(monthlyGoal.sold_count_goal * summary.progressRatio) ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.sold_count_goal ? `${Math.round(monthlyGoal.sold_count_goal * summary.progressRatio)}件` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.projectedSoldCount}件</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          value={goalForm.sold_count_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, sold_count_goal: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.sold_count_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.sold_count_goal ? `${monthlyGoal.sold_count_goal}件` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">在庫数回転率</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.stockCountTurnover}%</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.stockCountTurnover, previousMonthSummary?.stockCountTurnover, true)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.stock_count_turnover_goal ? (summary.stockCountTurnover >= monthlyGoal.stock_count_turnover_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.stock_count_turnover_goal ? `${monthlyGoal.stock_count_turnover_goal}%` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.stockCountTurnover}%</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          step="0.1"
                          value={goalForm.stock_count_turnover_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, stock_count_turnover_goal: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.stock_count_turnover_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.stock_count_turnover_goal ? `${monthlyGoal.stock_count_turnover_goal}%` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">売上原価回転率</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.costTurnover}%</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.costTurnover, previousMonthSummary?.costTurnover, true)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.cost_turnover_goal ? (summary.costTurnover >= monthlyGoal.cost_turnover_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.cost_turnover_goal ? `${monthlyGoal.cost_turnover_goal}%` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.costTurnover}%</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          step="0.1"
                          value={goalForm.cost_turnover_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, cost_turnover_goal: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.cost_turnover_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.cost_turnover_goal ? `${monthlyGoal.cost_turnover_goal}%` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">売上高回転率</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.salesTurnover}%</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.salesTurnover, previousMonthSummary?.salesTurnover, true)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.sales_turnover_goal ? (summary.salesTurnover >= monthlyGoal.sales_turnover_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.sales_turnover_goal ? `${monthlyGoal.sales_turnover_goal}%` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.salesTurnover}%</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          step="0.1"
                          value={goalForm.sales_turnover_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, sales_turnover_goal: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.sales_turnover_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.sales_turnover_goal ? `${monthlyGoal.sales_turnover_goal}%` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">総合収益性</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.overallProfitability}%</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.overallProfitability, previousMonthSummary?.overallProfitability, true)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.overall_profitability_goal ? (summary.overallProfitability >= monthlyGoal.overall_profitability_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.overall_profitability_goal ? `${monthlyGoal.overall_profitability_goal}%` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.overallProfitability}%</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          step="0.1"
                          value={goalForm.overall_profitability_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, overall_profitability_goal: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.overall_profitability_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.overall_profitability_goal ? `${monthlyGoal.overall_profitability_goal}%` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">GMROI</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.gmroi.toFixed(2)}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right tabular-nums">
                      {formatDiff(summary.gmroi, previousMonthSummary?.gmroi, false, false)}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className={`px-6 py-3.5 text-right tabular-nums ${monthlyGoal?.gmroi_goal ? (summary.gmroi >= monthlyGoal.gmroi_goal ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                      {monthlyGoal?.gmroi_goal ? `${monthlyGoal.gmroi_goal}` : '-'}
                    </td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-blue-600 tabular-nums">{summary.gmroi.toFixed(2)}</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right">
                      {isEditingGoal ? (
                        <input
                          type="number"
                          step="0.1"
                          value={goalForm.gmroi_goal || ''}
                          onChange={(e) => setGoalForm({ ...goalForm, gmroi_goal: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 text-right border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${monthlyGoal?.gmroi_goal ? 'text-green-600' : 'text-gray-400'}`}>
                          {monthlyGoal?.gmroi_goal ? `${monthlyGoal.gmroi_goal}` : '-'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors bg-blue-50">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">現時点の在庫額</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums font-semibold">¥{summary.currentStockValue.toLocaleString()}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right text-gray-400">-</td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-gray-400">-</td>
                  )}
                  {selectedMonth !== 'all' && summary.isCurrentMonth && (
                    <td className="px-6 py-3.5 text-right text-gray-400">-</td>
                  )}
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-3.5 text-right text-gray-400">-</td>
                  )}
                </tr>
              </tbody>
            </table>
            {isEditingGoal && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={saveGoal}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  目標を保存
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            年月を選択してください
          </div>
        )}

        {/* 月別一覧表 */}
        {!loading && selectedYear && (
          <div className="bg-white rounded-xl border border-gray-200 mt-6 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800">
              <h2 className="text-base font-semibold text-white">{selectedYear}年 月別レポート</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  {/* セクションラベル行 */}
                  <tr className="bg-slate-700">
                    <th className="px-4 py-2 w-16"></th>
                    <th colSpan={4} className="px-4 py-2 text-center text-[11px] font-semibold text-indigo-300 tracking-wide border-l border-slate-500">成果</th>
                    <th colSpan={2} className="px-4 py-2 text-center text-[11px] font-semibold text-teal-300 tracking-wide border-l border-slate-500">活動</th>
                    <th colSpan={3} className="px-4 py-2 text-center text-[11px] font-semibold text-orange-300 tracking-wide border-l border-slate-500">仕入</th>
                    <th colSpan={4} className="px-4 py-2 text-center text-[11px] font-semibold text-purple-300 tracking-wide border-l border-slate-500">在庫</th>
                    <th colSpan={3} className="px-4 py-2 text-center text-[11px] font-semibold text-slate-400 tracking-wide border-l border-slate-500">回転率</th>
                  </tr>
                  {/* 項目名行 */}
                  <tr className="bg-slate-600">
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white w-16">月</th>
                    {/* 成果 */}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white border-l border-slate-500">売上</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">利益</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">利益率</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">収益性</th>
                    {/* 活動の結果 */}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white border-l border-slate-500">出品</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">販売</th>
                    {/* コスト */}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white border-l border-slate-500">件数</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">金額</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">単価</th>
                    {/* 在庫状態 */}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white border-l border-slate-500">期首数</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">期首高</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">期末数</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">期末高</th>
                    {/* 効率性 */}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white border-l border-slate-500">数量</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">売上</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white">原価</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthlyData.map((data) => (
                    <tr key={data.month} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3.5 text-gray-900 font-semibold w-16 text-center">{data.month}月</td>
                      {/* 成果 */}
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">¥{data.totalSales.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">¥{data.totalProfit.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.profitRate}%</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.overallProfitability}%</td>
                      {/* 活動の結果 */}
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.listedCount}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.soldCount}</td>
                      {/* コスト */}
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.purchasedCount}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">¥{data.purchaseValue.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">¥{data.avgPurchasePrice.toLocaleString()}</td>
                      {/* 在庫状態 */}
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.prevMonthEndStockCount}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">¥{data.beginningStockValue.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.currentMonthEndStockCount}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">¥{data.endingStockValue.toLocaleString()}</td>
                      {/* 効率性 */}
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.stockCountTurnover}%</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.salesTurnover}%</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.costTurnover}%</td>
                    </tr>
                  ))}
                </tbody>
                {/* 年間合計 */}
                {yearlyTotal && (
                  <tfoot>
                    <tr className="bg-slate-800 text-white">
                      <td className="px-4 py-4 font-bold w-16 text-center">合計</td>
                      {/* 成果 */}
                      <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">¥{yearlyTotal.totalSales.toLocaleString()}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">¥{yearlyTotal.totalProfit.toLocaleString()}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.profitRate}%</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.overallProfitability}%</td>
                      {/* 活動の結果 */}
                      <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{yearlyTotal.listedCount}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.soldCount}</td>
                      {/* コスト */}
                      <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{yearlyTotal.purchasedCount}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">¥{yearlyTotal.purchaseValue.toLocaleString()}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">¥{yearlyTotal.avgPurchasePrice.toLocaleString()}</td>
                      {/* 在庫状態 */}
                      <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{yearlyTotal.prevMonthEndStockCount}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">¥{yearlyTotal.beginningStockValue.toLocaleString()}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.currentMonthEndStockCount}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">¥{yearlyTotal.endingStockValue.toLocaleString()}</td>
                      {/* 効率性 */}
                      <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{yearlyTotal.stockCountTurnover}%</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.salesTurnover}%</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.costTurnover}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
