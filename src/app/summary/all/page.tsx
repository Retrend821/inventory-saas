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

export default function AllSalesPage() {
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

  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'single' | 'bulk' | 'manual'>('all')
  const [salesTypeFilter, setSalesTypeFilter] = useState<'all' | 'toC' | 'toB'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [historySortBy, setHistorySortBy] = useState<'date' | 'sales' | 'profit' | 'profitRate'>('date')
  const [historyPage, setHistoryPage] = useState(1)
  const historyPageSize = 100

  // 列の設定
  const defaultColumns = [
    { key: 'inventory_number', label: '管理番号', width: 'w-16' },
    { key: 'image', label: '画像', width: 'w-14' },
    { key: 'category', label: 'ジャンル', width: 'w-20' },
    { key: 'brand_name', label: 'ブランド', width: 'w-24' },
    { key: 'product_name', label: '商品名', width: 'w-36' },
    { key: 'purchase_source', label: '仕入先', width: 'w-24' },
    { key: 'sale_destination', label: '販売先', width: 'w-24' },
    { key: 'sale_price', label: '売値', width: 'w-20' },
    { key: 'commission', label: '手数料', width: 'w-20' },
    { key: 'shipping_cost', label: '送料', width: 'w-16' },
    { key: 'other_cost', label: 'その他', width: 'w-16' },
    { key: 'purchase_price', label: '正味仕入値', width: 'w-24' },
    { key: 'purchase_total', label: '仕入総額', width: 'w-24' },
    { key: 'deposit_amount', label: '入金額', width: 'w-20' },
    { key: 'profit', label: '利益', width: 'w-20' },
    { key: 'profit_rate', label: '利益率', width: 'w-16' },
    { key: 'purchase_date', label: '仕入日', width: 'w-24' },
    { key: 'listing_date', label: '出品日', width: 'w-24' },
    { key: 'sale_date', label: '売却日', width: 'w-24' },
    { key: 'turnover_days', label: '回転日数', width: 'w-20' },
    { key: 'memo', label: 'メモ', width: 'w-32' },
  ]
  const [columns] = useState(defaultColumns)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const visibleColumns = columns.filter(col => !hiddenColumns.has(col.key))

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

  // フィルター・ソート変更時にページをリセット
  useEffect(() => {
    setHistoryPage(1)
  }, [selectedYear, selectedMonth, filterType, salesTypeFilter, searchQuery, historySortBy])

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

    // 単品仕入れの販売データ（販売先が入っていて売却日がある場合のみ、返品を除く）
    inventory.forEach(item => {
      if (item.sale_destination && item.sale_destination !== '返品' && item.sale_date) {
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

    // 手入力売上データ
    manualSales.forEach(item => {
      if (item.sale_date) {
        const salePrice = item.sale_price || 0
        const purchaseCost = item.purchase_total || 0
        const commission = item.commission || 0
        const shippingCost = item.shipping_cost || 0
        const otherCost = item.other_cost || 0
        const profit = item.profit ?? (salePrice - purchaseCost - commission - shippingCost - otherCost)
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
      <div className="max-w-full mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">売上明細</h1>

        {/* 年月選択・フィルター */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
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
                  <option key={year} value={year}>{year === 'all' ? '全て' : `${year}年`}</option>
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
        ) : (
          /* 販売データテーブル */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-600 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                {selectedYear === 'all' ? '全期間' : `${selectedYear}年${selectedMonth === 'all' ? '間' : `${parseInt(selectedMonth)}月`}`}の売上明細
                {salesTypeFilter !== 'all' && ` [${salesTypeFilter === 'toC' ? '小売' : '業販'}]`}
                （{filteredSales.reduce((sum, s) => sum + s.quantity, 0)}点）
                {filterType !== 'all' && ` - ${filterType === 'single' ? '単品' : filterType === 'bulk' ? 'まとめ' : '手入力'}`}
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setHistorySortBy('date')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    historySortBy === 'date'
                      ? 'bg-white text-slate-600'
                      : 'bg-slate-500 text-white hover:bg-slate-400'
                  }`}
                >
                  日付順
                </button>
                <button
                  onClick={() => setHistorySortBy('sales')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    historySortBy === 'sales'
                      ? 'bg-white text-slate-600'
                      : 'bg-slate-500 text-white hover:bg-slate-400'
                  }`}
                >
                  売上順
                </button>
                <button
                  onClick={() => setHistorySortBy('profit')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    historySortBy === 'profit'
                      ? 'bg-white text-slate-600'
                      : 'bg-slate-500 text-white hover:bg-slate-400'
                  }`}
                >
                  利益順
                </button>
                <button
                  onClick={() => setHistorySortBy('profitRate')}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    historySortBy === 'profitRate'
                      ? 'bg-white text-slate-600'
                      : 'bg-slate-500 text-white hover:bg-slate-400'
                  }`}
                >
                  利益率順
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50">
                    {visibleColumns.map(col => (
                      <th
                        key={col.key}
                        className={`px-2 py-3 text-xs font-semibold text-gray-600 bg-gray-50 whitespace-nowrap ${
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
                  {[...filteredSales]
                    .sort((a, b) => {
                      if (historySortBy === 'sales') return (b.sale_price || 0) - (a.sale_price || 0)
                      if (historySortBy === 'profit') return (b.profit || 0) - (a.profit || 0)
                      if (historySortBy === 'profitRate') return (b.profit_rate || 0) - (a.profit_rate || 0)
                      // date (default)
                      if (!a.sale_date && !b.sale_date) return 0
                      if (!a.sale_date) return 1
                      if (!b.sale_date) return -1
                      return b.sale_date.localeCompare(a.sale_date)
                    })
                    .slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize)
                    .map((sale) => (
                    <tr key={`${sale.type}-${sale.id}`} className="hover:bg-gray-50/50 transition-colors">
                      {visibleColumns.map(col => {
                        switch (col.key) {
                          case 'inventory_number':
                            return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs truncate max-w-[60px]" title={sale.inventory_number || '-'}>{sale.inventory_number || '-'}</td>
                          case 'image':
                            const imageUrl = sale.image_url
                              ? sale.image_url.startsWith('/api/') || sale.image_url.startsWith('data:')
                                ? sale.image_url
                                : `/api/image-proxy?url=${encodeURIComponent(sale.image_url)}`
                              : null
                            return (
                              <td key={col.key} className="px-2 py-2">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={sale.product_name}
                                    className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setEnlargedImage(imageUrl)}
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
                            return (
                              <td key={col.key} className={`px-2 py-2 text-right tabular-nums text-xs ${isExternalShipping(sale.shipping_cost) ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                                {formatCurrency(sale.shipping_cost)}
                              </td>
                            )
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
            {/* ページネーション */}
            {filteredSales.length > historyPageSize && (
              <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {filteredSales.length}件中 {(historyPage - 1) * historyPageSize + 1}〜{Math.min(historyPage * historyPageSize, filteredSales.length)}件を表示
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryPage(1)}
                    disabled={historyPage === 1}
                    className="px-3 py-1 text-sm rounded border bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    最初
                  </button>
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="px-3 py-1 text-sm rounded border bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    前へ
                  </button>
                  <span className="text-sm text-gray-600">
                    {historyPage} / {Math.ceil(filteredSales.length / historyPageSize)}
                  </span>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(Math.ceil(filteredSales.length / historyPageSize), p + 1))}
                    disabled={historyPage >= Math.ceil(filteredSales.length / historyPageSize)}
                    className="px-3 py-1 text-sm rounded border bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    次へ
                  </button>
                  <button
                    onClick={() => setHistoryPage(Math.ceil(filteredSales.length / historyPageSize))}
                    disabled={historyPage >= Math.ceil(filteredSales.length / historyPageSize)}
                    className="px-3 py-1 text-sm rounded border bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    最後
                  </button>
                </div>
              </div>
            )}
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
