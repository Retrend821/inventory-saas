'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function SummaryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  useEffect(() => {
    const fetchInventory = async () => {
      // 全件取得するために、ページネーションで取得
      let allData: InventoryItem[] = []
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
          allData = [...allData, ...data]
          from += pageSize
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }

      setInventory(allData)
      setLoading(false)
    }

    fetchInventory()

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
    return [...years].sort().reverse()
  }, [inventory])

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

  // 選択された年月でフィルタリングした集計
  const summary = useMemo(() => {
    if (!selectedYear || !selectedMonth) return null

    const isYearly = selectedMonth === 'all'
    const yearMonth = `${selectedYear}-${selectedMonth}`

    // 売却日が選択年月のアイテム（売上日に日付が入っているもの）
    const soldItems = inventory.filter(item => {
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

    // 販売件数
    const soldCount = soldItems.length

    // 仕入件数
    const purchasedCount = purchasedItems.length

    // 出品件数
    const listedCount = listedItems.length

    // 売上（税込）- 売値の合計
    const totalSales = soldItems.reduce((sum, item) => sum + (item.sale_price || 0), 0)

    // 仕入（税込）- 売却商品の仕入総額（取得金額込み）
    const totalPurchase = soldItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

    // 手数料の合計
    const totalCommission = soldItems.reduce((sum, item) => sum + (item.commission || 0), 0)

    // 送料の合計
    const totalShipping = soldItems.reduce((sum, item) => sum + (item.shipping_cost || 0), 0)

    // 販売利益（売値 - 手数料 - 送料 - 仕入総額）税込
    const totalProfit = totalSales - totalCommission - totalShipping - totalPurchase

    // 販売利益率
    const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0

    // 販売単価（売上 / 販売件数）
    const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0

    // 利益単価（利益 / 販売件数）
    const avgProfit = soldCount > 0 ? Math.round(totalProfit / soldCount) : 0

    // 仕入単価（仕入総額 / 販売件数）
    const avgPurchasePrice = soldCount > 0 ? Math.round(totalPurchase / soldCount) : 0

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
    }
  }, [inventory, selectedYear, selectedMonth])

  // 月別集計データ（表形式用）
  const monthlyData = useMemo(() => {
    if (!selectedYear) return []

    const monthList = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

    // 月末在庫を計算するためのヘルパー関数
    const getEndOfMonthStock = (year: string, month: string) => {
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
        // 有効な売却日があり、月末以前に売却されていれば除外
        if (isValidDate(saleDate)) {
          const normalizedSale = normalizeDate(saleDate!)
          if (normalizedSale <= endDate) return false
        }
        return true
      })
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

      // 当月販売（売上日に日付が入っているもの）
      const soldItems = inventory.filter(item => {
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

      // 前月末在庫・当月末在庫
      const prevMonthEndStockItems = getPrevMonthEndStock(selectedYear, month)
      const currentMonthEndStockItems = getEndOfMonthStock(selectedYear, month)

      const prevMonthEndStockCount = prevMonthEndStockItems.length
      const currentMonthEndStockCount = currentMonthEndStockItems.length

      // 月初在庫高（前月末在庫の仕入総額）
      const beginningStockValue = prevMonthEndStockItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

      // 当月末在庫残高
      const endingStockValue = currentMonthEndStockItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

      // 販売件数
      const soldCount = soldItems.length

      // 仕入数・仕入高
      const purchasedCount = purchasedItems.length
      const purchaseValue = purchasedItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

      // 平均仕入単価
      const avgPurchasePrice = purchasedCount > 0 ? Math.round(purchaseValue / purchasedCount) : 0

      // 出品数
      const listedCount = listedItems.length

      // 売上
      const totalSales = soldItems.reduce((sum, item) => sum + (item.sale_price || 0), 0)

      // 売上原価（売却商品の仕入総額）
      const costOfGoodsSold = soldItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

      // 手数料・送料
      const totalCommission = soldItems.reduce((sum, item) => sum + (item.commission || 0), 0)
      const totalShipping = soldItems.reduce((sum, item) => sum + (item.shipping_cost || 0), 0)

      // 販売利益
      const totalProfit = totalSales - totalCommission - totalShipping - costOfGoodsSold

      // 販売利益率
      const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0

      // 平均在庫（月初と月末の平均）
      const avgStockValue = (beginningStockValue + endingStockValue) / 2

      // 在庫数回転率（販売件数 / 平均在庫数）
      const avgStockCount = (prevMonthEndStockCount + currentMonthEndStockCount) / 2
      const stockCountTurnover = avgStockCount > 0 ? Math.round((soldCount / avgStockCount) * 100) / 100 : 0

      // 売上高回転率（売上 / 平均在庫高）
      const salesTurnover = avgStockValue > 0 ? Math.round((totalSales / avgStockValue) * 100) / 100 : 0

      // 売上原価回転率（売上原価 / 平均在庫高）
      const costTurnover = avgStockValue > 0 ? Math.round((costOfGoodsSold / avgStockValue) * 100) / 100 : 0

      // 総合収益性（利益 / 平均在庫高）
      const overallProfitability = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 100) / 100 : 0

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
  }, [inventory, selectedYear])

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

    const stockCountTurnover = avgStockCount > 0 ? Math.round((soldCount / avgStockCount) * 100) / 100 : 0
    const salesTurnover = avgStockValue > 0 ? Math.round((totalSales / avgStockValue) * 100) / 100 : 0
    const costTurnover = avgStockValue > 0 ? Math.round((costOfGoodsSold / avgStockValue) * 100) / 100 : 0
    const overallProfitability = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 100) / 100 : 0

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
            <div className="px-6 py-4 bg-slate-800">
              <h2 className="text-base font-semibold text-white">
                {selectedYear}年{selectedMonth === 'all' ? '間' : `${parseInt(selectedMonth)}月`}の集計
              </h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">売上（税込）</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.totalSales.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">仕入（税込）</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.totalPurchase.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">販売利益（税込）</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.totalProfit.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">販売利益率</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.profitRate}%</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">販売単価</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.avgSalePrice.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">利益単価</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.avgProfit.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">仕入単価</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">¥{summary.avgPurchasePrice.toLocaleString()}</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">仕入件数</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.purchasedCount}件</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">出品件数</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.listedCount}件</td>
                </tr>
                <tr className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-600 font-medium">販売件数</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.soldCount}件</td>
                </tr>
              </tbody>
            </table>
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
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.overallProfitability}</td>
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
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.stockCountTurnover}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.salesTurnover}</td>
                      <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.costTurnover}</td>
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
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.overallProfitability}</td>
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
                      <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{yearlyTotal.stockCountTurnover}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.salesTurnover}</td>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.costTurnover}</td>
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
