'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type InventoryItem = {
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
  deposit_amount: number | null
  status: string
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  sale_destination: string | null
  purchase_source: string | null
  memo: string | null
}

type BulkPurchase = {
  id: string
  genre: string
  purchase_date: string
  purchase_source: string | null
  total_amount: number
  total_quantity: number
  memo: string | null
}

type BulkSale = {
  id: string
  bulk_purchase_id: string
  sale_date: string
  sale_destination: string | null
  quantity: number
  sale_amount: number
  commission: number
  shipping_cost: number
  memo: string | null
  // 商品詳細（単品と同じ形式）
  product_name: string | null
  brand_name: string | null
  category: string | null
  image_url: string | null
  purchase_price: number | null
  other_cost: number | null
  deposit_amount: number | null
  listing_date: string | null
}

// 統一された売上データ型
type UnifiedSale = {
  id: string
  type: 'single' | 'bulk'
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

export default function AllSalesPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [bulkPurchases, setBulkPurchases] = useState<BulkPurchase[]>([])
  const [bulkSales, setBulkSales] = useState<BulkSale[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'graph'>('history')
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'single' | 'bulk'>('all')

  // 列の設定
  const defaultColumns = [
    { key: 'inventory_number', label: '管理番号', width: 'w-20' },
    { key: 'image', label: '画像', width: 'w-14' },
    { key: 'category', label: 'ジャンル', width: 'w-20' },
    { key: 'brand_name', label: 'ブランド', width: 'w-24' },
    { key: 'product_name', label: '商品名', width: 'w-36' },
    { key: 'purchase_source', label: '仕入先', width: 'w-20' },
    { key: 'sale_destination', label: '販売先', width: 'w-20' },
    { key: 'sale_price', label: '売値', width: 'w-20' },
    { key: 'commission', label: '手数料', width: 'w-16' },
    { key: 'shipping_cost', label: '送料', width: 'w-16' },
    { key: 'other_cost', label: 'その他', width: 'w-16' },
    { key: 'purchase_price', label: '正味仕入値', width: 'w-20' },
    { key: 'purchase_total', label: '仕入総額', width: 'w-20' },
    { key: 'deposit_amount', label: '入金額', width: 'w-20' },
    { key: 'profit', label: '利益', width: 'w-20' },
    { key: 'profit_rate', label: '利益率', width: 'w-16' },
    { key: 'purchase_date', label: '仕入日', width: 'w-20' },
    { key: 'listing_date', label: '出品日', width: 'w-20' },
    { key: 'sale_date', label: '売却日', width: 'w-20' },
    { key: 'turnover_days', label: '回転日数', width: 'w-16' },
    { key: 'memo', label: 'メモ', width: 'w-32' },
  ]
  const [columns] = useState(defaultColumns)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const visibleColumns = columns.filter(col => !hiddenColumns.has(col.key))

  useEffect(() => {
    const fetchData = async () => {
      // 在庫データ取得
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('*')

      if (inventoryError) {
        console.error('Error fetching inventory:', inventoryError)
      } else {
        setInventory(inventoryData || [])
      }

      // まとめ仕入れデータ取得
      const { data: bulkPurchaseData, error: bulkPurchaseError } = await supabase
        .from('bulk_purchases')
        .select('*')

      if (bulkPurchaseError) {
        console.error('Error fetching bulk purchases:', bulkPurchaseError)
      } else {
        setBulkPurchases(bulkPurchaseData || [])
      }

      // まとめ売上データ取得
      const { data: bulkSaleData, error: bulkSaleError } = await supabase
        .from('bulk_sales')
        .select('*')

      if (bulkSaleError) {
        console.error('Error fetching bulk sales:', bulkSaleError)
      } else {
        setBulkSales(bulkSaleData || [])
      }

      setLoading(false)
    }

    fetchData()

    // 現在の年月をデフォルトで設定
    const now = new Date()
    setSelectedYear(now.getFullYear().toString())
    setSelectedMonth((now.getMonth() + 1).toString().padStart(2, '0'))
  }, [])

  // まとめ仕入れのID→データのマップ
  const bulkPurchaseMap = useMemo(() => {
    const map = new Map<string, BulkPurchase>()
    bulkPurchases.forEach(bp => map.set(bp.id, bp))
    return map
  }, [bulkPurchases])

  // 回転日数計算
  const calculateTurnoverDays = (purchaseDate: string | null, saleDate: string | null) => {
    if (!purchaseDate || !saleDate) return null
    const purchase = new Date(purchaseDate)
    const sale = new Date(saleDate)
    const diffTime = sale.getTime() - purchase.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // 統一された売上データを生成
  const unifiedSales = useMemo(() => {
    const sales: UnifiedSale[] = []

    // 単品仕入れの販売データ（販売先が入っていれば売上認定）
    inventory.forEach(item => {
      if (item.sale_destination) {
        const salePrice = item.sale_price || 0
        const purchaseCost = item.purchase_total || 0
        const purchasePrice = item.purchase_price || 0
        const commission = item.commission || 0
        const shippingCost = item.shipping_cost || 0
        const otherCost = item.other_cost || 0
        const profit = salePrice - purchaseCost - commission - shippingCost
        const profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100) : 0

        sales.push({
          id: item.id,
          type: 'single',
          inventory_number: item.inventory_number,
          product_name: item.product_name,
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
          purchase_date: item.purchase_date,
          listing_date: item.listing_date,
          sale_date: item.sale_date,
          turnover_days: calculateTurnoverDays(item.purchase_date, item.sale_date),
          memo: item.memo,
          quantity: 1,
        })
      }
    })

    // まとめ仕入れの販売データ
    bulkSales.forEach(sale => {
      const bulkPurchase = bulkPurchaseMap.get(sale.bulk_purchase_id)
      if (bulkPurchase) {
        // 商品詳細が登録されていればそちらを優先、なければまとめ仕入れのデータを使用
        const hasProductDetails = sale.product_name || sale.brand_name || sale.category

        const unitCost = bulkPurchase.total_quantity > 0
          ? Math.round(bulkPurchase.total_amount / bulkPurchase.total_quantity)
          : 0
        const purchasePrice = sale.purchase_price ?? unitCost * sale.quantity
        const otherCost = sale.other_cost ?? 0
        const profit = sale.sale_amount - purchasePrice - otherCost - sale.commission - sale.shipping_cost
        const profitRate = sale.sale_amount > 0 ? Math.round((profit / sale.sale_amount) * 100) : 0

        sales.push({
          id: sale.id,
          type: 'bulk',
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
          purchase_date: bulkPurchase.purchase_date,
          listing_date: sale.listing_date,
          sale_date: sale.sale_date,
          turnover_days: calculateTurnoverDays(bulkPurchase.purchase_date, sale.sale_date),
          memo: sale.memo,
          quantity: sale.quantity,
        })
      }
    })

    return sales
  }, [inventory, bulkSales, bulkPurchaseMap])

  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    years.add(new Date().getFullYear().toString())
    unifiedSales.forEach(sale => {
      if (sale.sale_date) {
        const year = sale.sale_date.substring(0, 4)
        years.add(year)
      }
    })
    return [...years].sort().reverse()
  }, [unifiedSales])

  // 月のリスト
  const months = ['all', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

  // フィルタリングされた売上データ
  const filteredSales = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []

    const isYearly = selectedMonth === 'all'
    const yearMonth = `${selectedYear}-${selectedMonth}`

    return unifiedSales
      .filter(sale => {
        // 年月フィルター（sale_dateがnullの場合は日付なしとして全期間に含める）
        let dateMatch = true
        if (sale.sale_date) {
          dateMatch = isYearly
            ? sale.sale_date.startsWith(selectedYear)
            : sale.sale_date.startsWith(yearMonth)
        }

        // 種別フィルター
        const typeMatch = filterType === 'all' || sale.type === filterType

        return dateMatch && typeMatch
      })
      .sort((a, b) => {
        // sale_dateがnullの場合は最後にソート
        if (!a.sale_date && !b.sale_date) return 0
        if (!a.sale_date) return 1
        if (!b.sale_date) return -1
        return b.sale_date.localeCompare(a.sale_date)
      })
  }, [unifiedSales, selectedYear, selectedMonth, filterType])

  // 集計データ
  const summary = useMemo(() => {
    if (!selectedYear || !selectedMonth) return null

    const soldCount = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0)
    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.sale_price, 0)
    const totalPurchase = filteredSales.reduce((sum, sale) => sum + sale.purchase_cost, 0)
    const totalCommission = filteredSales.reduce((sum, sale) => sum + sale.commission, 0)
    const totalShipping = filteredSales.reduce((sum, sale) => sum + sale.shipping_cost, 0)
    const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit, 0)
    const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0
    const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0
    const avgProfit = soldCount > 0 ? Math.round(totalProfit / soldCount) : 0

    // 単品とまとめの内訳
    const singleSales = filteredSales.filter(s => s.type === 'single')
    const bulkSalesFiltered = filteredSales.filter(s => s.type === 'bulk')

    const singleCount = singleSales.length
    const singleTotal = singleSales.reduce((sum, s) => sum + s.sale_price, 0)
    const singleProfit = singleSales.reduce((sum, s) => sum + s.profit, 0)

    const bulkCount = bulkSalesFiltered.reduce((sum, s) => sum + s.quantity, 0)
    const bulkTotal = bulkSalesFiltered.reduce((sum, s) => sum + s.sale_price, 0)
    const bulkProfit = bulkSalesFiltered.reduce((sum, s) => sum + s.profit, 0)

    return {
      soldCount,
      totalSales,
      totalPurchase,
      totalCommission,
      totalShipping,
      totalProfit,
      profitRate,
      avgSalePrice,
      avgProfit,
      singleCount,
      singleTotal,
      singleProfit,
      bulkCount,
      bulkTotal,
      bulkProfit,
    }
  }, [filteredSales, selectedYear, selectedMonth])

  // 販路別集計
  const platformSummary = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []

    const platformStats = new Map<string, {
      count: number
      sales: number
      purchase: number
      commission: number
      shipping: number
      profit: number
    }>()

    filteredSales.forEach(sale => {
      const platform = sale.sale_destination || '不明'
      const current = platformStats.get(platform) || {
        count: 0,
        sales: 0,
        purchase: 0,
        commission: 0,
        shipping: 0,
        profit: 0
      }

      platformStats.set(platform, {
        count: current.count + sale.quantity,
        sales: current.sales + sale.sale_price,
        purchase: current.purchase + sale.purchase_cost,
        commission: current.commission + sale.commission,
        shipping: current.shipping + sale.shipping_cost,
        profit: current.profit + sale.profit
      })
    })

    return Array.from(platformStats.entries())
      .map(([name, stats]) => ({
        name,
        ...stats,
        profitRate: stats.sales > 0 ? Math.round((stats.profit / stats.sales) * 100) : 0
      }))
      .sort((a, b) => b.sales - a.sales)
  }, [filteredSales, selectedYear, selectedMonth])

  // 月別集計データ
  const monthlyData = useMemo(() => {
    if (!selectedYear) return []

    const monthList = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

    return monthList.map(month => {
      const yearMonth = `${selectedYear}-${month}`

      const monthSales = unifiedSales.filter(sale => {
        const dateMatch = sale.sale_date ? sale.sale_date.startsWith(yearMonth) : false
        const typeMatch = filterType === 'all' || sale.type === filterType
        return dateMatch && typeMatch
      })

      const soldCount = monthSales.reduce((sum, s) => sum + s.quantity, 0)
      const totalSales = monthSales.reduce((sum, s) => sum + s.sale_price, 0)
      const costOfGoodsSold = monthSales.reduce((sum, s) => sum + s.purchase_cost, 0)
      const totalCommission = monthSales.reduce((sum, s) => sum + s.commission, 0)
      const totalShipping = monthSales.reduce((sum, s) => sum + s.shipping_cost, 0)
      const totalProfit = monthSales.reduce((sum, s) => sum + s.profit, 0)
      const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0
      const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0

      return {
        month: parseInt(month),
        soldCount,
        totalSales,
        costOfGoodsSold,
        totalCommission,
        totalShipping,
        totalProfit,
        profitRate,
        avgSalePrice,
      }
    })
  }, [unifiedSales, selectedYear, filterType])

  // 年間合計
  const yearlyTotal = useMemo(() => {
    if (!monthlyData.length) return null

    const soldCount = monthlyData.reduce((sum, m) => sum + m.soldCount, 0)
    const totalSales = monthlyData.reduce((sum, m) => sum + m.totalSales, 0)
    const costOfGoodsSold = monthlyData.reduce((sum, m) => sum + m.costOfGoodsSold, 0)
    const totalCommission = monthlyData.reduce((sum, m) => sum + m.totalCommission, 0)
    const totalShipping = monthlyData.reduce((sum, m) => sum + m.totalShipping, 0)
    const totalProfit = monthlyData.reduce((sum, m) => sum + m.totalProfit, 0)
    const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0
    const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0

    return {
      soldCount,
      totalSales,
      costOfGoodsSold,
      totalCommission,
      totalShipping,
      totalProfit,
      profitRate,
      avgSalePrice,
    }
  }, [monthlyData])

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    return `¥${amount.toLocaleString()}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">全販売実績</h1>

        {/* タブ */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-slate-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            販売履歴
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-6 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'summary'
                ? 'bg-slate-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            集計
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-6 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === 'graph'
                ? 'bg-slate-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            グラフ
          </button>
        </div>

        {/* 年月選択・フィルター */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">種別:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'single' | 'bulk')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">すべて</option>
                <option value="single">単品仕入れ</option>
                <option value="bulk">まとめ仕入れ</option>
              </select>
            </div>
            <div className="ml-auto relative">
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                列の編集
              </button>
              {showColumnSettings && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowColumnSettings(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[200px] max-h-[400px] overflow-y-auto">
                    <div className="text-xs font-medium text-gray-500 mb-2">表示する列</div>
                    {columns.map(col => (
                      <label key={col.key} className="flex items-center gap-2 py-1 hover:bg-gray-50 px-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!hiddenColumns.has(col.key)}
                          onChange={() => {
                            const newHidden = new Set(hiddenColumns)
                            if (newHidden.has(col.key)) {
                              newHidden.delete(col.key)
                            } else {
                              newHidden.add(col.key)
                            }
                            setHiddenColumns(newHidden)
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            読み込み中...
          </div>
        ) : activeTab === 'summary' ? (
          /* 集計タブ */
          <>
            {summary ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* サマリー */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-slate-600">
                    <h2 className="text-base font-semibold text-white">
                      {selectedYear}年{selectedMonth === 'all' ? '間' : `${parseInt(selectedMonth)}月`}の売上
                      {filterType !== 'all' && ` (${filterType === 'single' ? '単品' : 'まとめ'})`}
                    </h2>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">販売数量</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.soldCount}点</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">売上（税込）</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.totalSales)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">仕入原価</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.totalPurchase)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">手数料</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.totalCommission)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">送料</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.totalShipping)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors bg-slate-100">
                        <td className="px-6 py-3.5 text-slate-800 font-bold">販売利益</td>
                        <td className="px-6 py-3.5 text-right text-slate-800 font-bold tabular-nums">{formatCurrency(summary.totalProfit)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">利益率</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.profitRate}%</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">平均販売単価</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.avgSalePrice)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">平均利益単価</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.avgProfit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 単品・まとめ内訳 & 販路別 */}
                <div className="space-y-6">
                  {/* 単品・まとめ内訳 */}
                  {filterType === 'all' && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 bg-slate-600">
                        <h2 className="text-base font-semibold text-white">単品・まとめ内訳</h2>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">種別</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">数量</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">売上</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">利益</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-900 font-medium">単品仕入れ</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{summary.singleCount}点</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatCurrency(summary.singleTotal)}</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatCurrency(summary.singleProfit)}</td>
                          </tr>
                          <tr className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-900 font-medium">まとめ仕入れ</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{summary.bulkCount}点</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatCurrency(summary.bulkTotal)}</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatCurrency(summary.bulkProfit)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 販路別集計 */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 bg-slate-600">
                      <h2 className="text-base font-semibold text-white">販路別内訳</h2>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">販路</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">数量</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">売上</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">利益</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">利益率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {platformSummary.map((p) => (
                          <tr key={p.name} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-900 font-medium">{p.name}</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{p.count}</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatCurrency(p.sales)}</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatCurrency(p.profit)}</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{p.profitRate}%</td>
                          </tr>
                        ))}
                        {platformSummary.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              データがありません
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                年月を選択してください
              </div>
            )}

            {/* 月別一覧表 */}
            {selectedYear && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-600">
                  <h2 className="text-base font-semibold text-white">
                    {selectedYear}年 月別売上実績
                    {filterType !== 'all' && ` (${filterType === 'single' ? '単品' : 'まとめ'})`}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600"></th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">数量</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">売上</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">原価</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">手数料</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">送料</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">利益</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">利益率</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">平均単価</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthlyData.map((data) => (
                        <tr key={data.month} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3.5 text-gray-900 font-semibold">{data.month}月</td>
                          <td className="px-4 py-3.5 text-right text-gray-700 tabular-nums">{data.soldCount}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(data.totalSales)}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(data.costOfGoodsSold)}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(data.totalCommission)}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(data.totalShipping)}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(data.totalProfit)}</td>
                          <td className="px-4 py-3.5 text-right text-gray-700 tabular-nums">{data.profitRate}%</td>
                          <td className="px-4 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(data.avgSalePrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {yearlyTotal && (
                      <tfoot>
                        <tr className="bg-slate-700 text-white">
                          <td className="px-4 py-4 font-bold">合計</td>
                          <td className="px-4 py-4 text-right tabular-nums font-semibold">{yearlyTotal.soldCount}</td>
                          <td className="px-4 py-4 text-right tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalSales)}</td>
                          <td className="px-4 py-4 text-right tabular-nums font-semibold">{formatCurrency(yearlyTotal.costOfGoodsSold)}</td>
                          <td className="px-4 py-4 text-right tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalCommission)}</td>
                          <td className="px-4 py-4 text-right tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalShipping)}</td>
                          <td className="px-4 py-4 text-right tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalProfit)}</td>
                          <td className="px-4 py-4 text-right tabular-nums font-semibold">{yearlyTotal.profitRate}%</td>
                          <td className="px-4 py-4 text-right tabular-nums font-semibold">{formatCurrency(yearlyTotal.avgSalePrice)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'graph' ? (
          /* グラフタブ */
          <div className="space-y-6">
            {/* 月別売上・利益の棒グラフ */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-600">
                <h2 className="text-base font-semibold text-white">{selectedYear}年 月別売上・利益</h2>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickFormatter={(value) => `${value}月`} />
                    <YAxis tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`} />
                    <Tooltip
                      formatter={(value: number) => `¥${value.toLocaleString()}`}
                      labelFormatter={(label) => `${label}月`}
                    />
                    <Legend />
                    <Bar dataKey="totalSales" name="売上" fill="#3b82f6" />
                    <Bar dataKey="totalProfit" name="利益" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 販路別円グラフ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-600">
                  <h2 className="text-base font-semibold text-white">販路別売上シェア</h2>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={platformSummary}
                        dataKey="sales"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {platformSummary.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][index % 8]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-600">
                  <h2 className="text-base font-semibold text-white">販路別利益シェア</h2>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={platformSummary.filter(p => p.profit > 0)}
                        dataKey="profit"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {platformSummary.filter(p => p.profit > 0).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][index % 8]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 売上推移の折れ線グラフ */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-600">
                <h2 className="text-base font-semibold text-white">{selectedYear}年 売上・利益推移</h2>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickFormatter={(value) => `${value}月`} />
                    <YAxis tickFormatter={(value) => `¥${(value / 10000).toFixed(0)}万`} />
                    <Tooltip
                      formatter={(value: number) => `¥${value.toLocaleString()}`}
                      labelFormatter={(label) => `${label}月`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="totalSales" name="売上" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                    <Line type="monotone" dataKey="totalProfit" name="利益" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                    <Line type="monotone" dataKey="costOfGoodsSold" name="原価" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          /* 販売履歴タブ */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-600">
              <h2 className="text-base font-semibold text-white">
                {selectedYear}年{selectedMonth === 'all' ? '間' : `${parseInt(selectedMonth)}月`}の販売履歴
                （{filteredSales.reduce((sum, s) => sum + s.quantity, 0)}点）
                {filterType !== 'all' && ` - ${filterType === 'single' ? '単品' : 'まとめ'}`}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {visibleColumns.map(col => (
                      <th
                        key={col.key}
                        className={`px-2 py-3 text-xs font-semibold text-gray-600 ${
                          ['sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price', 'purchase_total', 'deposit_amount', 'profit', 'profit_rate', 'turnover_days'].includes(col.key)
                            ? 'text-right'
                            : ['purchase_date', 'listing_date', 'sale_date'].includes(col.key)
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSales.map((sale) => (
                    <tr key={`${sale.type}-${sale.id}`} className="hover:bg-gray-50/50 transition-colors">
                      {visibleColumns.map(col => {
                        switch (col.key) {
                          case 'inventory_number':
                            return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{sale.inventory_number || '-'}</td>
                          case 'image':
                            return (
                              <td key={col.key} className="px-2 py-2">
                                {sale.image_url ? (
                                  <img
                                    src={sale.image_url}
                                    alt={sale.product_name}
                                    className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setEnlargedImage(sale.image_url)}
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                                    No
                                  </div>
                                )}
                              </td>
                            )
                          case 'category':
                            return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{sale.category || '-'}</td>
                          case 'brand_name':
                            return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{sale.brand_name || '-'}</td>
                          case 'product_name':
                            return (
                              <td key={col.key} className="px-2 py-2">
                                <div className="text-gray-900 text-xs font-medium truncate max-w-[150px]">{sale.product_name}</div>
                              </td>
                            )
                          case 'purchase_source':
                            return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{sale.purchase_source || '-'}</td>
                          case 'sale_destination':
                            return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{sale.sale_destination || '-'}</td>
                          case 'sale_price':
                            return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(sale.sale_price)}</td>
                          case 'commission':
                            return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(sale.commission)}</td>
                          case 'shipping_cost':
                            return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(sale.shipping_cost)}</td>
                          case 'other_cost':
                            return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(sale.other_cost)}</td>
                          case 'purchase_price':
                            return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(sale.purchase_price)}</td>
                          case 'purchase_total':
                            return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(sale.purchase_cost)}</td>
                          case 'deposit_amount':
                            return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(sale.deposit_amount)}</td>
                          case 'profit':
                            return (
                              <td key={col.key} className={`px-2 py-2 text-right tabular-nums text-xs font-medium ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(sale.profit)}
                              </td>
                            )
                          case 'profit_rate':
                            return (
                              <td key={col.key} className={`px-2 py-2 text-right tabular-nums text-xs ${sale.profit_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {sale.profit_rate}%
                              </td>
                            )
                          case 'purchase_date':
                            return <td key={col.key} className="px-2 py-2 text-center text-gray-700 text-xs">{formatDate(sale.purchase_date)}</td>
                          case 'listing_date':
                            return <td key={col.key} className="px-2 py-2 text-center text-gray-700 text-xs">{formatDate(sale.listing_date)}</td>
                          case 'sale_date':
                            return <td key={col.key} className="px-2 py-2 text-center text-gray-700 text-xs">{formatDate(sale.sale_date)}</td>
                          case 'turnover_days':
                            return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{sale.turnover_days !== null ? `${sale.turnover_days}日` : '-'}</td>
                          case 'memo':
                            return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs truncate max-w-[100px]">{sale.memo || '-'}</td>
                          default:
                            return null
                        }
                      })}
                    </tr>
                  ))}
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                        該当するデータがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 画像拡大モーダル */}
        {enlargedImage && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]"
            onClick={() => setEnlargedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={enlargedImage}
                alt="拡大画像"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={() => setEnlargedImage(null)}
                className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-2 text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
