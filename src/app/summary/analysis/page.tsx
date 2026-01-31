'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts'

// フリマ送料表の金額一覧（全プラットフォーム共通）
const STANDARD_SHIPPING_COSTS = new Set([
  // らくらくメルカリ便
  210, 450, 520, 750, 850, 1050, 1200, 1450, 1700,
  // ゆうゆうメルカリ便
  160, 180, 215, 220, 230, 455, 520, 870, 1070, 1900,
  // エコメルカリ便
  730,
  // かんたんラクマパック（ヤマト）
  200, 430, 500, 650, 1400, 1500, 2800, 3350,
  // かんたんラクマパック（日本郵便）
  150, 175, 380, 445, 700, 800, 1150, 1350,
  // おてがる配送（ヤマト）
  // 200, 450, 520, 750, 850, 1050, 1200, 1450, 1700 (重複)
  // おてがる配送（日本郵便）
  205, 410,
  // 0円は送料無料なので標準扱い
  0,
])

// 送料が外部発送かどうかを判定
const isExternalShipping = (cost: number | null): boolean => {
  if (cost === null || cost === undefined) return false
  return !STANDARD_SHIPPING_COSTS.has(cost)
}

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

type Platform = {
  id: string
  name: string
  sales_type: 'toB' | 'toC'
}

type ManualSale = {
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
  purchase_total: number | null
  profit: number | null
  profit_rate: number | null
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  memo: string | null
  inventory_number: string | null
  sale_type: string | null
}

// 統一された売上データ型
type UnifiedSale = {
  id: string
  type: 'single' | 'bulk' | 'manual'
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

export default function SalesAnalysisPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [bulkPurchases, setBulkPurchases] = useState<BulkPurchase[]>([])
  const [bulkSales, setBulkSales] = useState<BulkSale[]>([])
  const [manualSales, setManualSales] = useState<ManualSale[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  // URLからタブ状態を取得
  const validTabs = ['summary', 'graph', 'ranking'] as const
  const tabFromUrl = searchParams.get('tab')
  const initialTab = validTabs.includes(tabFromUrl as typeof validTabs[number])
    ? (tabFromUrl as 'summary' | 'graph' | 'ranking')
    : 'summary'
  const [activeTab, setActiveTab] = useState<'summary' | 'graph' | 'ranking'>(initialTab)

  // タブ変更時にURLを更新
  const handleTabChange = useCallback((tab: 'summary' | 'graph' | 'ranking') => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])
  const [filterType, setFilterType] = useState<'all' | 'single' | 'bulk' | 'manual'>('all')
  const [salesTypeFilter, setSalesTypeFilter] = useState<'all' | 'toC' | 'toB'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [brandSortBy, setBrandSortBy] = useState<'sales' | 'profit' | 'profitPerUnit' | 'profitRate'>('sales')
  const [itemSortBy, setItemSortBy] = useState<'sales' | 'profit' | 'profitPerUnit' | 'profitRate'>('profit')
  const [destinationSortBy, setDestinationSortBy] = useState<'sales' | 'profit' | 'profitPerUnit' | 'profitRate'>('sales')
  const [categorySortBy, setCategorySortBy] = useState<'sales' | 'profit' | 'profitPerUnit' | 'profitRate'>('sales')
  const [sourceSortBy, setSourceSortBy] = useState<'sales' | 'profit' | 'profitPerUnit' | 'profitRate'>('profit')

  useEffect(() => {
    const fetchData = async () => {
      // 在庫データ取得（ページネーションで全件取得）
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
      setInventory(allInventory)

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

      // プラットフォームデータ取得
      const { data: platformData, error: platformError } = await supabase
        .from('platforms')
        .select('*')

      if (platformError) {
        console.error('Error fetching platforms:', platformError)
      } else {
        setPlatforms(platformData || [])
      }

      // 手入力売上データ取得（ページネーションで全件取得）
      let allManualSales: ManualSale[] = []
      from = 0
      hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_sales')
          .select('*')
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
      setManualSales(allManualSales)

      setLoading(false)
    }

    fetchData()

    // デフォルトで全期間を設定
    setSelectedYear('all')
    setSelectedMonth('all')
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

    // 単品仕入れの販売データ（売却済みで販売先が入っている場合のみ、返品を除く）
    inventory.forEach(item => {
      if (item.status === '売却済み' && item.sale_destination && item.sale_destination !== '返品' && item.sale_date) {
        const salePrice = item.sale_price || 0
        const purchasePrice = item.purchase_price || 0
        const commission = item.commission || 0
        const shippingCost = item.shipping_cost || 0
        const otherCost = item.other_cost || 0
        const depositAmount = item.deposit_amount || 0
        // 仕入総額がある場合はそれを使用（すでにother_costを含む）、なければ原価+その他費用
        const purchaseCost = item.purchase_total ?? (purchasePrice + otherCost)
        // 仕入総額を使うので、other_costは別途引かない
        const profit = depositAmount - purchaseCost
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
        const depositAmount = sale.deposit_amount || 0
        const profit = depositAmount - purchasePrice - otherCost
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

    // 手入力売上データ
    manualSales.forEach(item => {
      if (item.sale_date) {
        const salePrice = item.sale_price || 0
        const commission = item.commission || 0
        const shippingCost = item.shipping_cost || 0
        const otherCost = item.other_cost || 0
        // manual_salesでは仕入総額（purchase_total）を使用（すでにother_costを含む）
        const purchaseCost = item.purchase_total || 0
        // 仕入総額を使うので、other_costは別途引かない
        const profit = item.profit ?? (salePrice - purchaseCost - commission - shippingCost)
        const profitRate = item.profit_rate ?? (salePrice > 0 ? Math.round((profit / salePrice) * 100) : 0)

        sales.push({
          id: `manual-${item.id}`,
          type: 'manual',
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
          purchase_date: item.purchase_date,
          listing_date: item.listing_date,
          sale_date: item.sale_date,
          turnover_days: calculateTurnoverDays(item.purchase_date, item.sale_date),
          memo: item.memo,
          quantity: 1,
        })
      }
    })

    return sales
  }, [inventory, bulkSales, bulkPurchaseMap, manualSales])

  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    years.add(new Date().getFullYear().toString())
    unifiedSales.forEach(sale => {
      if (sale.sale_date) {
        const year = sale.sale_date.substring(0, 4)
        // 4桁の数字のみ有効な年として追加
        if (/^\d{4}$/.test(year)) {
          years.add(year)
        }
      }
    })
    return ['all', ...[...years].sort().reverse()]
  }, [unifiedSales])

  // 月のリスト
  const months = ['all', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

  // 小売・業販のプラットフォーム名セット
  const retailPlatforms = useMemo(() => {
    return new Set(platforms.filter(p => p.sales_type === 'toC').map(p => p.name))
  }, [platforms])

  const wholesalePlatforms = useMemo(() => {
    return new Set(platforms.filter(p => p.sales_type === 'toB').map(p => p.name))
  }, [platforms])

  // フィルタリングされた売上データ
  const filteredSales = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []

    const isAllYears = selectedYear === 'all'
    const isYearly = selectedMonth === 'all'
    const yearMonth = `${selectedYear}-${selectedMonth}`

    return unifiedSales
      .filter(sale => {
        // 年月フィルター（sale_dateがnullの場合は日付なしとして全期間に含める）
        let dateMatch = true
        if (!isAllYears && sale.sale_date) {
          dateMatch = isYearly
            ? sale.sale_date.startsWith(selectedYear)
            : sale.sale_date.startsWith(yearMonth)
        }

        // 種別フィルター
        const typeMatch = filterType === 'all' || sale.type === filterType

        // 小売/業販フィルター
        let salesTypeMatch = true
        if (salesTypeFilter === 'toC') {
          salesTypeMatch = retailPlatforms.has(sale.sale_destination || '')
        } else if (salesTypeFilter === 'toB') {
          salesTypeMatch = wholesalePlatforms.has(sale.sale_destination || '')
        }

        // テキスト検索フィルター
        let searchMatch = true
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          searchMatch = !!(
            (sale.inventory_number && String(sale.inventory_number).toLowerCase().includes(query)) ||
            (sale.product_name && String(sale.product_name).toLowerCase().includes(query)) ||
            (sale.brand_name && String(sale.brand_name).toLowerCase().includes(query)) ||
            (sale.category && String(sale.category).toLowerCase().includes(query)) ||
            (sale.purchase_source && String(sale.purchase_source).toLowerCase().includes(query)) ||
            (sale.sale_destination && String(sale.sale_destination).toLowerCase().includes(query)) ||
            (sale.memo && String(sale.memo).toLowerCase().includes(query))
          )
        }

        return dateMatch && typeMatch && salesTypeMatch && searchMatch
      })
      .sort((a, b) => {
        // sale_dateがnullの場合は最後にソート
        if (!a.sale_date && !b.sale_date) return 0
        if (!a.sale_date) return 1
        if (!b.sale_date) return -1
        return b.sale_date.localeCompare(a.sale_date)
      })
  }, [unifiedSales, selectedYear, selectedMonth, filterType, salesTypeFilter, retailPlatforms, wholesalePlatforms, searchQuery])

  // ヘルパー関数
  const isValidDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false
    if (/返品|不明|キャンセル/.test(dateStr)) return false
    return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)
  }

  const normalizeYearMonth = (dateStr: string): string => {
    return dateStr.substring(0, 7).replace('/', '-')
  }

  const normalizeDate = (dateStr: string): string => {
    return dateStr.substring(0, 10).replace(/\//g, '-')
  }

  // 集計データ
  const summary = useMemo(() => {
    if (!selectedYear || !selectedMonth) return null

    const isYearly = selectedMonth === 'all'
    const yearMonth = `${selectedYear}-${selectedMonth}`

    const soldCount = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0)
    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.sale_price, 0)
    const totalPurchase = filteredSales.reduce((sum, sale) => sum + sale.purchase_cost, 0)
    const totalCommission = filteredSales.reduce((sum, sale) => sum + sale.commission, 0)
    const totalShipping = filteredSales.reduce((sum, sale) => sum + sale.shipping_cost, 0)
    const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit, 0)
    const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0
    const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0
    const avgProfit = soldCount > 0 ? Math.round(totalProfit / soldCount) : 0
    const avgPurchasePrice = soldCount > 0 ? Math.round(totalPurchase / soldCount) : 0

    // 仕入件数（当月仕入れた件数）
    const purchasedItems = inventory.filter(item => {
      if (!isValidDate(item.purchase_date)) return false
      const normalized = normalizeYearMonth(item.purchase_date!)
      return isYearly
        ? normalized.startsWith(selectedYear)
        : normalized === yearMonth
    })
    const purchasedCount = purchasedItems.length

    // 出品件数（当月出品した件数）
    const listedItems = inventory.filter(item => {
      if (!isValidDate(item.listing_date)) return false
      const normalized = normalizeYearMonth(item.listing_date!)
      return isYearly
        ? normalized.startsWith(selectedYear)
        : normalized === yearMonth
    })
    const listedCount = listedItems.length

    // 単品とまとめと手入力の内訳
    const singleSales = filteredSales.filter(s => s.type === 'single')
    const bulkSalesFiltered = filteredSales.filter(s => s.type === 'bulk')
    const manualSalesFiltered = filteredSales.filter(s => s.type === 'manual')

    const singleCount = singleSales.length
    const singleTotal = singleSales.reduce((sum, s) => sum + s.sale_price, 0)
    const singleProfit = singleSales.reduce((sum, s) => sum + s.profit, 0)

    const bulkCount = bulkSalesFiltered.reduce((sum, s) => sum + s.quantity, 0)
    const bulkTotal = bulkSalesFiltered.reduce((sum, s) => sum + s.sale_price, 0)
    const bulkProfit = bulkSalesFiltered.reduce((sum, s) => sum + s.profit, 0)

    const manualCount = manualSalesFiltered.length
    const manualTotal = manualSalesFiltered.reduce((sum, s) => sum + s.sale_price, 0)
    const manualProfit = manualSalesFiltered.reduce((sum, s) => sum + s.profit, 0)

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
      avgPurchasePrice,
      purchasedCount,
      listedCount,
      singleCount,
      singleTotal,
      singleProfit,
      bulkCount,
      bulkTotal,
      bulkProfit,
      manualCount,
      manualTotal,
      manualProfit,
    }
  }, [filteredSales, selectedYear, selectedMonth, inventory])

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

    // 月末在庫を計算するためのヘルパー関数（単品のみ）
    const getEndOfMonthSingleStock = (year: string, month: string) => {
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`

      return inventory.filter(item => {
        const purchaseDate = item.purchase_date
        const saleDate = item.sale_date
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
        singleItems: singleStock,
        count: singleStock.length + bulkStock.count,
        value: singleStock.reduce((sum, item) => sum + (item.purchase_total || 0), 0) + bulkStock.value
      }
    }

    const getPrevMonthEndStock = (year: string, month: string) => {
      const monthNum = parseInt(month)
      if (monthNum === 1) {
        return getEndOfMonthStock((parseInt(year) - 1).toString(), '12')
      } else {
        return getEndOfMonthStock(year, (monthNum - 1).toString().padStart(2, '0'))
      }
    }

    return monthList.map(month => {
      const yearMonth = `${selectedYear}-${month}`

      // unifiedSalesからの売上データ（まとめ仕入れ含む）
      const monthSales = unifiedSales.filter(sale => {
        const dateMatch = sale.sale_date ? sale.sale_date.startsWith(yearMonth) : false
        const typeMatch = filterType === 'all' || sale.type === filterType
        // 小売/業販フィルター
        let salesTypeMatch = true
        if (salesTypeFilter === 'toC') {
          salesTypeMatch = retailPlatforms.has(sale.sale_destination || '')
        } else if (salesTypeFilter === 'toB') {
          salesTypeMatch = wholesalePlatforms.has(sale.sale_destination || '')
        }
        return dateMatch && typeMatch && salesTypeMatch
      })

      const soldCount = monthSales.reduce((sum, s) => sum + s.quantity, 0)
      const totalSales = monthSales.reduce((sum, s) => sum + s.sale_price, 0)
      const costOfGoodsSold = monthSales.reduce((sum, s) => sum + s.purchase_cost, 0)
      const totalCommission = monthSales.reduce((sum, s) => sum + s.commission, 0)
      const totalShipping = monthSales.reduce((sum, s) => sum + s.shipping_cost, 0)
      const totalProfit = monthSales.reduce((sum, s) => sum + s.profit, 0)
      const profitRate = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0
      const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0

      // 単品仕入のみの集計（出品・仕入・在庫用）
      const purchasedItems = inventory.filter(item => {
        if (!isValidDate(item.purchase_date)) return false
        return normalizeYearMonth(item.purchase_date!) === yearMonth
      })

      const listedItems = inventory.filter(item => {
        if (!isValidDate(item.listing_date)) return false
        return normalizeYearMonth(item.listing_date!) === yearMonth
      })

      const prevMonthEndStock = getPrevMonthEndStock(selectedYear, month)
      const currentMonthEndStock = getEndOfMonthStock(selectedYear, month)

      const prevMonthEndStockCount = prevMonthEndStock.count
      const currentMonthEndStockCount = currentMonthEndStock.count
      const beginningStockValue = prevMonthEndStock.value
      const endingStockValue = currentMonthEndStock.value

      const purchasedCount = purchasedItems.length
      const purchaseValue = purchasedItems.reduce((sum, item) => sum + (item.purchase_total || 0), 0)
      const avgPurchasePrice = purchasedCount > 0 ? Math.round(purchaseValue / purchasedCount) : 0
      const listedCount = listedItems.length

      const avgStockValue = (beginningStockValue + endingStockValue) / 2
      const avgStockCount = (prevMonthEndStockCount + currentMonthEndStockCount) / 2
      const stockCountTurnover = avgStockCount > 0 ? Math.round((soldCount / avgStockCount) * 100) / 100 : 0
      const salesTurnover = avgStockValue > 0 ? Math.round((totalSales / avgStockValue) * 100) / 100 : 0
      const costTurnover = avgStockValue > 0 ? Math.round((costOfGoodsSold / avgStockValue) * 100) / 100 : 0
      const overallProfitability = avgStockValue > 0 ? Math.round((totalProfit / avgStockValue) * 100) / 100 : 0

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
        // 単品仕入のみの項目
        purchasedCount,
        purchaseValue,
        avgPurchasePrice,
        listedCount,
        prevMonthEndStockCount,
        currentMonthEndStockCount,
        beginningStockValue,
        endingStockValue,
        stockCountTurnover,
        salesTurnover,
        costTurnover,
        overallProfitability,
      }
    })
  }, [unifiedSales, inventory, bulkPurchases, bulkSales, selectedYear, filterType, salesTypeFilter, retailPlatforms, wholesalePlatforms])

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

    const purchasedCount = monthlyData.reduce((sum, m) => sum + m.purchasedCount, 0)
    const purchaseValue = monthlyData.reduce((sum, m) => sum + m.purchaseValue, 0)
    const avgPurchasePrice = purchasedCount > 0 ? Math.round(purchaseValue / purchasedCount) : 0
    const listedCount = monthlyData.reduce((sum, m) => sum + m.listedCount, 0)

    const dec = monthlyData[11]
    const jan = monthlyData[0]
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
      soldCount,
      totalSales,
      costOfGoodsSold,
      totalCommission,
      totalShipping,
      totalProfit,
      profitRate,
      avgSalePrice,
      purchasedCount,
      purchaseValue,
      avgPurchasePrice,
      listedCount,
      prevMonthEndStockCount: beginningStockCount,
      currentMonthEndStockCount: endingStockCount,
      beginningStockValue,
      endingStockValue,
      stockCountTurnover,
      salesTurnover,
      costTurnover,
      overallProfitability,
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
      <div className="max-w-full mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">売上分析</h1>

        {/* タブ */}
        <div className="flex gap-1 mb-4 sm:mb-6 overflow-x-auto mobile-hide-scrollbar">
          <button
            onClick={() => handleTabChange('summary')}
            className={`px-4 sm:px-6 py-2 rounded-t-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap touch-target ${
              activeTab === 'summary'
                ? 'bg-slate-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            集計
          </button>
          <button
            onClick={() => handleTabChange('graph')}
            className={`px-4 sm:px-6 py-2 rounded-t-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap touch-target ${
              activeTab === 'graph'
                ? 'bg-slate-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            グラフ
          </button>
          <button
            onClick={() => handleTabChange('ranking')}
            className={`px-4 sm:px-6 py-2 rounded-t-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap touch-target ${
              activeTab === 'ranking'
                ? 'bg-slate-600 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            ランキング
          </button>
        </div>

        {/* 年月選択・フィルター */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-4">
            {/* 検索入力欄 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="商品名・ブランド・販路で検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">年:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year === 'all' ? '全年' : `${year}年`}</option>
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
                    {month === 'all' ? '全月' : `${parseInt(month)}月`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">販売区分:</label>
              <select
                value={salesTypeFilter}
                onChange={(e) => setSalesTypeFilter(e.target.value as 'all' | 'toC' | 'toB')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">すべて</option>
                <option value="toC">小売</option>
                <option value="toB">業販</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">仕入種別:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'single' | 'bulk' | 'manual')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">すべて</option>
                <option value="single">単品仕入れ</option>
                <option value="bulk">まとめ仕入れ</option>
                <option value="manual">手入力売上</option>
              </select>
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
                      {selectedYear === 'all' ? '全年' : `${selectedYear}年`}{selectedMonth === 'all' ? '（全月）' : `${parseInt(selectedMonth)}月`}の売上
                      {salesTypeFilter !== 'all' && ` [${salesTypeFilter === 'toC' ? '小売' : '業販'}]`}
                      {filterType !== 'all' && ` (${filterType === 'single' ? '単品' : filterType === 'bulk' ? 'まとめ' : '手入力'})`}
                    </h2>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">売上（税込）</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.totalSales)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">仕入（税込）</td>
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
                        <td className="px-6 py-3.5 text-slate-800 font-bold">販売利益（税込）</td>
                        <td className="px-6 py-3.5 text-right text-slate-800 font-bold tabular-nums">{formatCurrency(summary.totalProfit)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">販売利益率</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.profitRate}%</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">販売単価</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.avgSalePrice)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">利益単価</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.avgProfit)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">仕入単価</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{formatCurrency(summary.avgPurchasePrice)}</td>
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

                {/* 単品・まとめ内訳 & 販路別 */}
                <div className="space-y-6">
                  {/* 単品・まとめ・手入力内訳 */}
                  {filterType === 'all' && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 bg-slate-600">
                        <h2 className="text-base font-semibold text-white">種別内訳</h2>
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
                          <tr className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-900 font-medium">手入力売上</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{summary.manualCount}点</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatCurrency(summary.manualTotal)}</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatCurrency(summary.manualProfit)}</td>
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

            {/* 月別レポート */}
            {selectedYear && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-800">
                  <h2 className="text-base font-semibold text-white">
                    {selectedYear === 'all' ? '全年' : `${selectedYear}年`} 月別レポート
                    {salesTypeFilter !== 'all' && ` [${salesTypeFilter === 'toC' ? '小売' : '業販'}]`}
                    {filterType !== 'all' && ` (${filterType === 'single' ? '単品' : filterType === 'bulk' ? 'まとめ' : '手入力'})`}
                  </h2>
                </div>
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="sticky top-0 z-10">
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
                        {/* 活動 */}
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white border-l border-slate-500">出品</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white">販売</th>
                        {/* 仕入 */}
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white border-l border-slate-500">件数</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white">金額</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white">単価</th>
                        {/* 在庫 */}
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white border-l border-slate-500">期首数</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white">期首高</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white">期末数</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white">期末高</th>
                        {/* 回転率 */}
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
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{formatCurrency(data.totalSales)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.totalProfit)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.profitRate}%</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.overallProfitability}</td>
                          {/* 活動 */}
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.listedCount}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.soldCount}</td>
                          {/* 仕入 */}
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.purchasedCount}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.purchaseValue)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.avgPurchasePrice)}</td>
                          {/* 在庫 */}
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.prevMonthEndStockCount}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.beginningStockValue)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.currentMonthEndStockCount}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.endingStockValue)}</td>
                          {/* 回転率 */}
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums border-l border-gray-200">{data.stockCountTurnover}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.salesTurnover}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.costTurnover}</td>
                        </tr>
                      ))}
                    </tbody>
                    {yearlyTotal && (
                      <tfoot>
                        <tr className="bg-slate-800 text-white">
                          <td className="px-4 py-4 font-bold w-16 text-center">合計</td>
                          {/* 成果 */}
                          <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{formatCurrency(yearlyTotal.totalSales)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalProfit)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.profitRate}%</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.overallProfitability}</td>
                          {/* 活動 */}
                          <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{yearlyTotal.listedCount}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.soldCount}</td>
                          {/* 仕入 */}
                          <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{yearlyTotal.purchasedCount}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.purchaseValue)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.avgPurchasePrice)}</td>
                          {/* 在庫 */}
                          <td className="px-4 py-4 text-center tabular-nums font-semibold border-l border-slate-600">{yearlyTotal.prevMonthEndStockCount}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.beginningStockValue)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.currentMonthEndStockCount}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.endingStockValue)}</td>
                          {/* 回転率 */}
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
          </>
        ) : activeTab === 'graph' ? (
          /* グラフタブ */
          <div className="space-y-6">
            {/* 月別売上・利益の棒グラフ */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-600">
                <h2 className="text-base font-semibold text-white">{selectedYear === 'all' ? '全年' : `${selectedYear}年`} 月別売上・利益</h2>
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
                  {(() => {
                    const salesData = [...platformSummary].filter(p => p.sales > 0).sort((a, b) => b.sales - a.sales)
                    const totalSales = salesData.reduce((sum, x) => sum + x.sales, 0)

                    return salesData.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0" style={{ width: '55%' }}>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={salesData}
                                dataKey="sales"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                              >
                                {salesData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][index % 8]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-2">
                          {salesData.slice(0, 5).map((p, index) => {
                            const percent = totalSales > 0 ? ((p.sales / totalSales) * 100).toFixed(1) : '0'
                            return (
                              <div key={p.name} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][index % 8] }}
                                />
                                <span className="text-gray-700 truncate flex-1">{p.name}</span>
                                <span className="text-gray-900 font-medium tabular-nums">¥{p.sales.toLocaleString()}</span>
                                <span className="text-gray-500 tabular-nums w-12 text-right">{percent}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-gray-500">
                        データがありません
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-600">
                  <h2 className="text-base font-semibold text-white">販路別利益シェア</h2>
                </div>
                <div className="p-6">
                  {(() => {
                    const profitData = [...platformSummary].filter(p => p.profit > 0).sort((a, b) => b.profit - a.profit)
                    const totalProfit = profitData.reduce((sum, x) => sum + x.profit, 0)

                    return profitData.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0" style={{ width: '55%' }}>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={profitData}
                                dataKey="profit"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                              >
                                {profitData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][index % 8]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-2">
                          {profitData.slice(0, 5).map((p, index) => {
                            const percent = totalProfit > 0 ? ((p.profit / totalProfit) * 100).toFixed(1) : '0'
                            return (
                              <div key={p.name} className="flex items-center gap-2 text-sm">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][index % 8] }}
                                />
                                <span className="text-gray-700 truncate flex-1">{p.name}</span>
                                <span className="text-gray-900 font-medium tabular-nums">¥{p.profit.toLocaleString()}</span>
                                <span className="text-gray-500 tabular-nums w-12 text-right">{percent}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-gray-500">
                        データがありません
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* 売上推移の折れ線グラフ */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-600">
                <h2 className="text-base font-semibold text-white">{selectedYear === 'all' ? '全年' : `${selectedYear}年`} 売上・利益推移</h2>
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
        ) : activeTab === 'ranking' ? (
          /* ランキングタブ */
          <div className="space-y-6">
            {/* 商品別ランキング */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-yellow-500 to-amber-500 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                  <span className="text-lg sm:text-xl">🏆</span> 商品別ランキング TOP10
                </h2>
                <div className="flex gap-1 overflow-x-auto mobile-hide-scrollbar">
                  <button
                    onClick={() => setItemSortBy('sales')}
                    className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                      itemSortBy === 'sales'
                        ? 'bg-white text-amber-600'
                        : 'bg-amber-400 text-white hover:bg-amber-300'
                    }`}
                  >
                    売上順
                  </button>
                  <button
                    onClick={() => setItemSortBy('profit')}
                    className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                      itemSortBy === 'profit'
                        ? 'bg-white text-amber-600'
                        : 'bg-amber-400 text-white hover:bg-amber-300'
                    }`}
                  >
                    利益順
                  </button>
                  <button
                    onClick={() => setItemSortBy('profitRate')}
                    className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                      itemSortBy === 'profitRate'
                        ? 'bg-white text-amber-600'
                        : 'bg-amber-400 text-white hover:bg-amber-300'
                    }`}
                  >
                    利益率順
                  </button>
                </div>
              </div>
              <div className="p-2 sm:p-4 overflow-x-auto mobile-hide-scrollbar">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-center text-xs font-semibold text-gray-600 w-8 sm:w-12">順位</th>
                      <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-left text-xs font-semibold text-gray-600">商品名</th>
                      <th className="hidden sm:table-cell px-3 py-2 text-left text-xs font-semibold text-gray-600 w-24">ブランド</th>
                      <th className="hidden md:table-cell px-3 py-2 text-left text-xs font-semibold text-gray-600 w-20">販売先</th>
                      <th className="hidden sm:table-cell px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">売値</th>
                      <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-xs font-semibold text-gray-600 w-16 sm:w-24">利益</th>
                      <th className="px-1.5 sm:px-3 py-1 sm:py-2 text-right text-xs font-semibold text-gray-600 w-12 sm:w-16">利益率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredSales]
                      .filter(s => s.profit !== null && s.brand_name?.trim())
                      .sort((a, b) => {
                        if (itemSortBy === 'sales') return (b.sale_price || 0) - (a.sale_price || 0)
                        if (itemSortBy === 'profit') return (b.profit || 0) - (a.profit || 0)
                        return (b.profit_rate || 0) - (a.profit_rate || 0)
                      })
                      .slice(0, 10)
                      .map((sale, idx) => (
                        <tr key={sale.id} className={`border-b hover:bg-gray-50 ${idx < 3 ? 'bg-yellow-50' : ''}`}>
                          <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-center font-bold text-xs sm:text-sm">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </td>
                          <td className="px-1.5 sm:px-3 py-1 sm:py-2 text-gray-900 truncate max-w-[120px] sm:max-w-xs text-xs sm:text-sm" title={sale.product_name}>{sale.product_name}</td>
                          <td className="hidden sm:table-cell px-3 py-2 text-gray-600 truncate">{sale.brand_name || '-'}</td>
                          <td className="hidden md:table-cell px-3 py-2 text-gray-600">{sale.sale_destination || '-'}</td>
                          <td className="hidden sm:table-cell px-3 py-2 text-right tabular-nums">¥{(sale.sale_price || 0).toLocaleString()}</td>
                          <td className={`px-1.5 sm:px-3 py-1 sm:py-2 text-right tabular-nums font-semibold text-xs sm:text-sm ${(sale.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{(sale.profit || 0).toLocaleString()}</td>
                          <td className={`px-1.5 sm:px-3 py-1 sm:py-2 text-right tabular-nums text-xs sm:text-sm ${(sale.profit_rate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{sale.profit_rate || 0}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ブランド別売上ランキング */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-500 to-pink-500 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                    <span className="text-lg sm:text-xl">👑</span> ブランド別ランキング
                  </h2>
                  <div className="flex gap-1 overflow-x-auto mobile-hide-scrollbar">
                    <button
                      onClick={() => setBrandSortBy('sales')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        brandSortBy === 'sales'
                          ? 'bg-white text-purple-600'
                          : 'bg-purple-400 text-white hover:bg-purple-300'
                      }`}
                    >
                      売上順
                    </button>
                    <button
                      onClick={() => setBrandSortBy('profit')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        brandSortBy === 'profit'
                          ? 'bg-white text-purple-600'
                          : 'bg-purple-400 text-white hover:bg-purple-300'
                      }`}
                    >
                      利益順
                    </button>
                    <button
                      onClick={() => setBrandSortBy('profitPerUnit')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        brandSortBy === 'profitPerUnit'
                          ? 'bg-white text-purple-600'
                          : 'bg-purple-400 text-white hover:bg-purple-300'
                      }`}
                    >
                      単価順
                    </button>
                    <button
                      onClick={() => setBrandSortBy('profitRate')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        brandSortBy === 'profitRate'
                          ? 'bg-white text-purple-600'
                          : 'bg-purple-400 text-white hover:bg-purple-300'
                      }`}
                    >
                      利益率順
                    </button>
                  </div>
                </div>
                <div className="p-2 sm:p-4 overflow-x-auto mobile-hide-scrollbar">
                  <table className="w-full text-xs sm:text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-12">順位</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">ブランド</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20 whitespace-nowrap">点数</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">売上</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">利益</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-16">利益率</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20">利益単価</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const brandStats = new Map<string, { count: number; sales: number; profit: number }>()
                        filteredSales.forEach(sale => {
                          const brandName = sale.brand_name?.trim()
                          if (!brandName || /未設定|未登録|なし|無し|ノーブランド/i.test(brandName)) return // 未設定は除外
                          if (/[,、\/×&＆]|(\s[xX]\s)/.test(brandName)) return // 複数ブランドは除外
                          const current = brandStats.get(brandName) || { count: 0, sales: 0, profit: 0 }
                          brandStats.set(brandName, {
                            count: current.count + sale.quantity,
                            sales: current.sales + (sale.sale_price || 0) * sale.quantity,
                            profit: current.profit + (sale.profit || 0) * sale.quantity,
                          })
                        })
                        return [...brandStats.entries()]
                          .sort((a, b) => {
                            if (brandSortBy === 'sales') return b[1].sales - a[1].sales
                            if (brandSortBy === 'profit') return b[1].profit - a[1].profit
                            if (brandSortBy === 'profitRate') {
                              const aRate = a[1].sales > 0 ? a[1].profit / a[1].sales : 0
                              const bRate = b[1].sales > 0 ? b[1].profit / b[1].sales : 0
                              return bRate - aRate
                            }
                            // profitPerUnit
                            const aPerUnit = a[1].count > 0 ? a[1].profit / a[1].count : 0
                            const bPerUnit = b[1].count > 0 ? b[1].profit / b[1].count : 0
                            return bPerUnit - aPerUnit
                          })
                          .slice(0, 10)
                          .map(([brand, stats], idx) => (
                            <tr key={brand} className={`border-b hover:bg-gray-50 ${idx < 3 ? 'bg-purple-50' : ''}`}>
                              <td className="px-3 py-2 text-center font-bold">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                              </td>
                              <td className="px-3 py-2 text-gray-900 truncate">{brand}</td>
                              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{stats.count}点</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-purple-600">¥{stats.sales.toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right tabular-nums ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.profit.toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right tabular-nums ${stats.sales > 0 && Math.round((stats.profit / stats.sales) * 100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.sales > 0 ? Math.round((stats.profit / stats.sales) * 100) : 0}%</td>
                              <td className={`px-3 py-2 text-right tabular-nums ${stats.count > 0 && Math.round(stats.profit / stats.count) >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.count > 0 ? Math.round(stats.profit / stats.count).toLocaleString() : 0}</td>
                            </tr>
                          ))
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 販路別売上ランキング */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-teal-500 to-cyan-500 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                    <span className="text-lg sm:text-xl">🏪</span> 販路別ランキング
                  </h2>
                  <div className="flex gap-1 overflow-x-auto mobile-hide-scrollbar">
                    <button
                      onClick={() => setDestinationSortBy('sales')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        destinationSortBy === 'sales'
                          ? 'bg-white text-teal-600'
                          : 'bg-teal-400 text-white hover:bg-teal-300'
                      }`}
                    >
                      売上順
                    </button>
                    <button
                      onClick={() => setDestinationSortBy('profit')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        destinationSortBy === 'profit'
                          ? 'bg-white text-teal-600'
                          : 'bg-teal-400 text-white hover:bg-teal-300'
                      }`}
                    >
                      利益順
                    </button>
                    <button
                      onClick={() => setDestinationSortBy('profitPerUnit')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        destinationSortBy === 'profitPerUnit'
                          ? 'bg-white text-teal-600'
                          : 'bg-teal-400 text-white hover:bg-teal-300'
                      }`}
                    >
                      単価順
                    </button>
                    <button
                      onClick={() => setDestinationSortBy('profitRate')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        destinationSortBy === 'profitRate'
                          ? 'bg-white text-teal-600'
                          : 'bg-teal-400 text-white hover:bg-teal-300'
                      }`}
                    >
                      利益率順
                    </button>
                  </div>
                </div>
                <div className="p-2 sm:p-4 overflow-x-auto mobile-hide-scrollbar">
                  <table className="w-full text-xs sm:text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-12">順位</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">販路</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20 whitespace-nowrap">点数</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">売上</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">利益</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-16">利益率</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20">利益単価</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const destStats = new Map<string, { count: number; sales: number; profit: number }>()
                        filteredSales.forEach(sale => {
                          const dest = sale.sale_destination || '(未設定)'
                          const current = destStats.get(dest) || { count: 0, sales: 0, profit: 0 }
                          destStats.set(dest, {
                            count: current.count + sale.quantity,
                            sales: current.sales + (sale.sale_price || 0) * sale.quantity,
                            profit: current.profit + (sale.profit || 0) * sale.quantity,
                          })
                        })
                        return [...destStats.entries()]
                          .sort((a, b) => {
                            if (destinationSortBy === 'sales') return b[1].sales - a[1].sales
                            if (destinationSortBy === 'profit') return b[1].profit - a[1].profit
                            if (destinationSortBy === 'profitRate') {
                              const aRate = a[1].sales > 0 ? a[1].profit / a[1].sales : 0
                              const bRate = b[1].sales > 0 ? b[1].profit / b[1].sales : 0
                              return bRate - aRate
                            }
                            const aPerUnit = a[1].count > 0 ? a[1].profit / a[1].count : 0
                            const bPerUnit = b[1].count > 0 ? b[1].profit / b[1].count : 0
                            return bPerUnit - aPerUnit
                          })
                          .slice(0, 10)
                          .map(([dest, stats], idx) => (
                            <tr key={dest} className={`border-b hover:bg-gray-50 ${idx < 3 ? 'bg-teal-50' : ''}`}>
                              <td className="px-3 py-2 text-center font-bold">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                              </td>
                              <td className="px-3 py-2 text-gray-900 truncate">{dest}</td>
                              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{stats.count}点</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-teal-600">¥{stats.sales.toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right tabular-nums ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.profit.toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right tabular-nums ${stats.sales > 0 && Math.round((stats.profit / stats.sales) * 100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.sales > 0 ? Math.round((stats.profit / stats.sales) * 100) : 0}%</td>
                              <td className={`px-3 py-2 text-right tabular-nums ${stats.count > 0 && Math.round(stats.profit / stats.count) >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.count > 0 ? Math.round(stats.profit / stats.count).toLocaleString() : 0}</td>
                            </tr>
                          ))
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* カテゴリ別・仕入先別ランキング（横並び） */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* カテゴリ別売上ランキング */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-red-500 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                  <span className="text-lg sm:text-xl">📦</span> カテゴリ別ランキング
                </h2>
                <div className="flex gap-1 overflow-x-auto mobile-hide-scrollbar">
                  <button
                    onClick={() => setCategorySortBy('sales')}
                    className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                      categorySortBy === 'sales'
                        ? 'bg-white text-orange-600'
                        : 'bg-orange-400 text-white hover:bg-orange-300'
                    }`}
                  >
                    売上順
                  </button>
                  <button
                    onClick={() => setCategorySortBy('profit')}
                    className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                      categorySortBy === 'profit'
                        ? 'bg-white text-orange-600'
                        : 'bg-orange-400 text-white hover:bg-orange-300'
                    }`}
                  >
                    利益順
                  </button>
                  <button
                    onClick={() => setCategorySortBy('profitPerUnit')}
                    className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                      categorySortBy === 'profitPerUnit'
                        ? 'bg-white text-orange-600'
                        : 'bg-orange-400 text-white hover:bg-orange-300'
                    }`}
                  >
                    単価順
                  </button>
                  <button
                    onClick={() => setCategorySortBy('profitRate')}
                    className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                      categorySortBy === 'profitRate'
                        ? 'bg-white text-orange-600'
                        : 'bg-orange-400 text-white hover:bg-orange-300'
                    }`}
                  >
                    利益率順
                  </button>
                </div>
              </div>
              <div className="p-2 sm:p-4 overflow-x-auto mobile-hide-scrollbar">
                <table className="w-full text-xs sm:text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-12">順位</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">カテゴリ</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20 whitespace-nowrap">点数</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">売上</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">利益</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-16">利益率</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20">利益単価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const catStats = new Map<string, { count: number; sales: number; profit: number }>()
                      filteredSales.forEach(sale => {
                        const cat = sale.category || '(未設定)'
                        const current = catStats.get(cat) || { count: 0, sales: 0, profit: 0 }
                        catStats.set(cat, {
                          count: current.count + sale.quantity,
                          sales: current.sales + (sale.sale_price || 0) * sale.quantity,
                          profit: current.profit + (sale.profit || 0) * sale.quantity,
                        })
                      })
                      return [...catStats.entries()]
                        .sort((a, b) => {
                          if (categorySortBy === 'sales') return b[1].sales - a[1].sales
                          if (categorySortBy === 'profit') return b[1].profit - a[1].profit
                          if (categorySortBy === 'profitRate') {
                            const aRate = a[1].sales > 0 ? a[1].profit / a[1].sales : 0
                            const bRate = b[1].sales > 0 ? b[1].profit / b[1].sales : 0
                            return bRate - aRate
                          }
                          const aPerUnit = a[1].count > 0 ? a[1].profit / a[1].count : 0
                          const bPerUnit = b[1].count > 0 ? b[1].profit / b[1].count : 0
                          return bPerUnit - aPerUnit
                        })
                        .slice(0, 10)
                        .map(([cat, stats], idx) => (
                          <tr key={cat} className={`border-b hover:bg-gray-50 ${idx < 3 ? 'bg-orange-50' : ''}`}>
                            <td className="px-3 py-2 text-center font-bold">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                            </td>
                            <td className="px-3 py-2 text-gray-900 truncate">{cat}</td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{stats.count}点</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-orange-600">¥{stats.sales.toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.profit.toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${stats.sales > 0 && Math.round((stats.profit / stats.sales) * 100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.sales > 0 ? Math.round((stats.profit / stats.sales) * 100) : 0}%</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${stats.count > 0 && Math.round(stats.profit / stats.count) >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.count > 0 ? Math.round(stats.profit / stats.count).toLocaleString() : 0}</td>
                          </tr>
                        ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

              {/* 仕入先別売上ランキング */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-green-500 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <h2 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                    <span className="text-lg sm:text-xl">🏭</span> 仕入先別ランキング
                  </h2>
                  <div className="flex gap-1 overflow-x-auto mobile-hide-scrollbar">
                    <button
                      onClick={() => setSourceSortBy('sales')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        sourceSortBy === 'sales'
                          ? 'bg-white text-emerald-600'
                          : 'bg-emerald-400 text-white hover:bg-emerald-300'
                      }`}
                    >
                      売上順
                    </button>
                    <button
                      onClick={() => setSourceSortBy('profit')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        sourceSortBy === 'profit'
                          ? 'bg-white text-emerald-600'
                          : 'bg-emerald-400 text-white hover:bg-emerald-300'
                      }`}
                    >
                      利益順
                    </button>
                    <button
                      onClick={() => setSourceSortBy('profitPerUnit')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        sourceSortBy === 'profitPerUnit'
                          ? 'bg-white text-emerald-600'
                          : 'bg-emerald-400 text-white hover:bg-emerald-300'
                      }`}
                    >
                      単価順
                    </button>
                    <button
                      onClick={() => setSourceSortBy('profitRate')}
                      className={`px-2 sm:px-3 py-1 text-xs rounded font-medium transition-colors whitespace-nowrap ${
                        sourceSortBy === 'profitRate'
                          ? 'bg-white text-emerald-600'
                          : 'bg-emerald-400 text-white hover:bg-emerald-300'
                      }`}
                    >
                      利益率順
                    </button>
                  </div>
                </div>
              <div className="p-2 sm:p-4 overflow-x-auto mobile-hide-scrollbar">
                <table className="w-full text-xs sm:text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-12">順位</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">仕入先</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20 whitespace-nowrap">点数</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">売上</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">利益</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-16">利益率</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20">利益単価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const sourceStats = new Map<string, { count: number; sales: number; profit: number }>()
                      filteredSales.forEach(sale => {
                        // 仕入先が未設定の場合はスキップ
                        if (!sale.purchase_source) return
                        const source = sale.purchase_source
                        const current = sourceStats.get(source) || { count: 0, sales: 0, profit: 0 }
                        sourceStats.set(source, {
                          count: current.count + sale.quantity,
                          sales: current.sales + (sale.sale_price || 0) * sale.quantity,
                          profit: current.profit + (sale.profit || 0) * sale.quantity,
                        })
                      })
                      return [...sourceStats.entries()]
                        .sort((a, b) => {
                          if (sourceSortBy === 'sales') return b[1].sales - a[1].sales
                          if (sourceSortBy === 'profit') return b[1].profit - a[1].profit
                          if (sourceSortBy === 'profitRate') {
                            const aRate = a[1].sales > 0 ? a[1].profit / a[1].sales : 0
                            const bRate = b[1].sales > 0 ? b[1].profit / b[1].sales : 0
                            return bRate - aRate
                          }
                          const aPerUnit = a[1].count > 0 ? a[1].profit / a[1].count : 0
                          const bPerUnit = b[1].count > 0 ? b[1].profit / b[1].count : 0
                          return bPerUnit - aPerUnit
                        })
                        .slice(0, 10)
                        .map(([source, stats], idx) => (
                          <tr key={source} className={`border-b hover:bg-gray-50 ${idx < 3 ? 'bg-emerald-50' : ''}`}>
                            <td className="px-3 py-2 text-center font-bold">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                            </td>
                            <td className="px-3 py-2 text-gray-900 truncate">{source}</td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{stats.count}点</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-600">¥{stats.sales.toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.profit.toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${stats.sales > 0 && Math.round((stats.profit / stats.sales) * 100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.sales > 0 ? Math.round((stats.profit / stats.sales) * 100) : 0}%</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${stats.count > 0 && Math.round(stats.profit / stats.count) >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.count > 0 ? Math.round(stats.profit / stats.count).toLocaleString() : 0}</td>
                          </tr>
                        ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
