'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Papa from 'papaparse'
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
  cost_recovered: boolean | null
}

// sales_summary テーブルの型（編集用）
type SalesSummaryRecord = {
  id: string
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
  created_at: string
  updated_at: string
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
  const [salesSummary, setSalesSummary] = useState<SalesSummaryRecord[]>([])
  const [loading, setLoading] = useState(true)

  // 編集機能用state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'single' | 'bulk' | 'manual'>('all')
  const [salesTypeFilter, setSalesTypeFilter] = useState<'all' | 'toC' | 'toB'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [historySortBy, setHistorySortBy] = useState<'date' | 'sales' | 'profit' | 'profitRate'>('date')
  const [historyPage, setHistoryPage] = useState(1)
  const historyPageSize = 100

  // 列フィルター用state
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null)

  // セル選択機能用state
  const [selectedCells, setSelectedCells] = useState<Set<string>>(() => {
    // localStorageから復元
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sales-summary-selected-cells')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return new Set(parsed)
        } catch {
          return new Set()
        }
      }
    }
    return new Set()
  })
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: string } | null>(null)

  // セル選択状態をlocalStorageに保存
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sales-summary-selected-cells', JSON.stringify([...selectedCells]))
    }
  }, [selectedCells])

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

      // sales_summary テーブルからデータ取得（ページネーション対応）
      let allSalesSummary: SalesSummaryRecord[] = []
      from = 0
      hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('sales_summary')
          .select('*')
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error fetching sales_summary:', error)
          break
        }

        if (data && data.length > 0) {
          allSalesSummary = [...allSalesSummary, ...data]
          from += pageSize
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }

      // 既存の sales_summary のキーをセットに格納（重複チェック用）
      const existingKeys = new Set(allSalesSummary.map(s => `${s.source_type}:${s.source_id}`))

      // bulkPurchase のマップを作成
      const bpMap = new Map<string, BulkPurchase>()
      bulkPurchaseData?.forEach(bp => bpMap.set(bp.id, bp))

      // bulk_sales のキーを記録（manual_sales との重複排除用）
      const bulkSalesKeys = new Set<string>()
      bulkSaleData?.forEach(sale => {
        if (sale.product_name && sale.sale_date) {
          const key = `${sale.product_name.trim().toLowerCase()}|${sale.sale_date}`
          bulkSalesKeys.add(key)
        }
      })

      // 不足分を追加するためのデータを収集
      const newRecords: Omit<SalesSummaryRecord, 'id' | 'created_at' | 'updated_at'>[] = []

      // 回転日数計算関数
      const calcTurnover = (purchaseDate: string | null, saleDate: string | null) => {
        if (!purchaseDate || !saleDate) return null
        const purchase = new Date(purchaseDate)
        const sale = new Date(saleDate)
        const diffTime = sale.getTime() - purchase.getTime()
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }

      // 1. inventory（単品）の不足分を追加
      allInventory.forEach(item => {
        if (item.status === '売却済み' && item.sale_destination && item.sale_destination !== '返品' && item.sale_date) {
          const key = `single:${item.id}`
          if (!existingKeys.has(key)) {
            const salePrice = item.sale_price || 0
            const purchaseCost = item.purchase_total || 0
            const purchasePrice = item.purchase_price || 0
            const commission = item.commission || 0
            const shippingCost = item.shipping_cost || 0
            const otherCost = item.other_cost || 0
            const depositAmount = item.deposit_amount || 0
            const profit = depositAmount - purchaseCost - otherCost
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
              purchase_price: purchasePrice,
              purchase_cost: purchaseCost,
              deposit_amount: item.deposit_amount,
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

      // 2. bulk_sales（まとめ売り）の不足分を追加
      bulkSaleData?.forEach(sale => {
        const key = `bulk:${sale.id}`
        if (!existingKeys.has(key)) {
          const bulkPurchase = bpMap.get(sale.bulk_purchase_id)
          if (bulkPurchase) {
            const hasProductDetails = sale.product_name || sale.brand_name || sale.category
            const unitCost = bulkPurchase.total_quantity > 0
              ? Math.round(bulkPurchase.total_amount / bulkPurchase.total_quantity)
              : 0
            const purchasePrice = sale.purchase_price ?? unitCost * sale.quantity
            const otherCost = sale.other_cost ?? 0
            const depositAmount = sale.deposit_amount || 0
            const profit = depositAmount - purchasePrice - otherCost
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
              purchase_price: purchasePrice,
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
      allManualSales.forEach(item => {
        if (item.sale_date && !item.cost_recovered) {
          // bulk_sales との重複チェック
          if (item.product_name && item.sale_date) {
            const dupKey = `${item.product_name.trim().toLowerCase()}|${item.sale_date}`
            if (bulkSalesKeys.has(dupKey)) return
          }

          const key = `manual:${item.id}`
          if (!existingKeys.has(key)) {
            const salePrice = item.sale_price || 0
            const purchaseCost = item.purchase_total || 0
            const commission = item.commission || 0
            const shippingCost = item.shipping_cost || 0
            const otherCost = item.other_cost || 0
            const profit = item.profit ?? (salePrice - purchaseCost - commission - shippingCost - otherCost)
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
              purchase_price: purchaseCost,
              purchase_cost: purchaseCost,
              deposit_amount: salePrice - commission - shippingCost - otherCost,
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
            allSalesSummary = [...allSalesSummary, ...insertedData]
          }
        }
      }

      setSalesSummary(allSalesSummary)
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
  }, [selectedYear, selectedMonth, filterType, salesTypeFilter, searchQuery, historySortBy, columnFilters])

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

  // 統一された売上データを生成（sales_summary から）
  const unifiedSales = useMemo(() => {
    return salesSummary.map(record => ({
      id: record.id,
      type: record.source_type,
      inventory_number: record.inventory_number,
      product_name: record.product_name,
      brand_name: record.brand_name,
      category: record.category,
      image_url: record.image_url,
      purchase_source: record.purchase_source,
      sale_destination: record.sale_destination,
      sale_price: record.sale_price,
      commission: record.commission,
      shipping_cost: record.shipping_cost,
      other_cost: record.other_cost,
      purchase_price: record.purchase_price,
      purchase_cost: record.purchase_cost,
      deposit_amount: record.deposit_amount,
      profit: record.profit,
      profit_rate: record.profit_rate,
      purchase_date: record.purchase_date,
      listing_date: record.listing_date,
      sale_date: record.sale_date,
      turnover_days: record.turnover_days,
      memo: record.memo,
      quantity: record.quantity,
    }))
  }, [salesSummary])

  // 編集可能な列の定義
  const editableColumns = ['product_name', 'brand_name', 'category', 'purchase_source', 'sale_destination',
    'sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price', 'deposit_amount',
    'purchase_date', 'listing_date', 'sale_date', 'memo']

  // セル編集開始
  const handleCellEdit = useCallback((saleId: string, field: string, currentValue: string | number | null) => {
    setEditingCell({ id: saleId, field })
    setEditValue(currentValue?.toString() || '')
  }, [])

  // セル編集保存
  const handleCellSave = useCallback(async () => {
    if (!editingCell) return

    const { id, field } = editingCell
    const record = salesSummary.find(s => s.id === id)
    if (!record) {
      setEditingCell(null)
      setEditValue('')
      return
    }

    // 値の変換
    let newValue: string | number | null = editValue.trim()

    // 数値フィールドの処理
    const numericFields = ['sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price', 'deposit_amount']
    if (numericFields.includes(field)) {
      if (newValue === '') {
        newValue = 0
      } else {
        const parsed = parseFloat(newValue)
        if (isNaN(parsed)) {
          setEditingCell(null)
          setEditValue('')
          return
        }
        newValue = parsed
      }
    }

    // 日付フィールドの処理
    const dateFields = ['purchase_date', 'listing_date', 'sale_date']
    if (dateFields.includes(field)) {
      if (newValue === '') {
        newValue = null
      }
    }

    // 文字列フィールドで空の場合
    if (typeof newValue === 'string' && newValue === '' && !dateFields.includes(field)) {
      newValue = null
    }

    // 更新データ（編集したフィールドのみ更新、自動再計算はしない）
    const updateData: Record<string, unknown> = { [field]: newValue }

    // 回転日数の再計算（日付変更時）
    if (dateFields.includes(field)) {
      const purchaseDate = field === 'purchase_date' ? (newValue as string) : record.purchase_date
      const saleDate = field === 'sale_date' ? (newValue as string) : record.sale_date
      updateData.turnover_days = calculateTurnoverDays(purchaseDate, saleDate)
    }

    // DBに保存
    const { error } = await supabase
      .from('sales_summary')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating sales_summary:', error)
    } else {
      // ローカルstateを更新
      setSalesSummary(prev => prev.map(s => {
        if (s.id === id) {
          return { ...s, ...updateData } as SalesSummaryRecord
        }
        return s
      }))
    }

    setEditingCell(null)
    setEditValue('')
  }, [editingCell, editValue, salesSummary, calculateTurnoverDays])

  // 編集キャンセル
  const handleCellCancel = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
  }, [])

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

  // ソート可能な列
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // フィルター可能な列とそのユニーク値を抽出
  const filterableColumns = ['inventory_number', 'category', 'brand_name', 'purchase_source', 'sale_destination', 'shipping_cost', 'profit', 'profit_rate']
  const columnUniqueValues = useMemo(() => {
    const values: Record<string, string[]> = {}
    filterableColumns.forEach(col => {
      if (col === 'shipping_cost') {
        // 送料は外部発送/標準送料の2択
        values[col] = ['外部発送', '標準送料']
      } else if (col === 'profit' || col === 'profit_rate') {
        // 利益・利益率は黒字/赤字の2択
        values[col] = ['黒字', '赤字']
      } else if (col === 'inventory_number') {
        // 管理番号は数値ソートで上位100件のみ表示（多すぎるため）
        const uniqueSet = new Set<string>()
        unifiedSales.forEach(sale => {
          if (sale.inventory_number) {
            uniqueSet.add(sale.inventory_number)
          }
        })
        values[col] = Array.from(uniqueSet)
          .sort((a, b) => {
            const numA = parseInt(a) || 0
            const numB = parseInt(b) || 0
            return numB - numA
          })
          .slice(0, 100)
      } else {
        const uniqueSet = new Set<string>()
        unifiedSales.forEach(sale => {
          const value = sale[col as keyof UnifiedSale]
          if (value && typeof value === 'string') {
            uniqueSet.add(value)
          }
        })
        values[col] = Array.from(uniqueSet).sort((a, b) => a.localeCompare(b, 'ja'))
      }
    })
    return values
  }, [unifiedSales])

  // ヘルパー関数: 日付が有効かチェック
  const isValidDate = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false
    if (typeof dateStr !== 'string') return false
    if (/返品|不明|キャンセル/.test(dateStr)) return false
    return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)
  }

  // フィルタリングされた売上データ
  const filteredSales = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []

    const isAllYears = selectedYear === 'all'
    const isYearly = selectedMonth === 'all'
    const yearMonth = `${selectedYear}-${selectedMonth}`

    // ヘルパー関数（useMemo内で定義）
    const checkValidDate = (dateStr: string | null | undefined): boolean => {
      if (!dateStr) return false
      if (typeof dateStr !== 'string') return false
      if (/返品|不明|キャンセル/.test(dateStr)) return false
      return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)
    }

    return unifiedSales
      .filter(sale => {
        // 年月フィルター
        let dateMatch = true
        if (!isAllYears) {
          // 年や月で絞り込む場合、売却日が不明なものは除外
          if (!checkValidDate(sale.sale_date)) {
            dateMatch = false
          } else {
            dateMatch = isYearly
              ? sale.sale_date!.startsWith(selectedYear)
              : sale.sale_date!.startsWith(yearMonth)
          }
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

        // 列フィルター
        let columnFilterMatch = true
        for (const [key, value] of Object.entries(columnFilters)) {
          if (value && value !== '') {
            if (key === 'shipping_cost') {
              // 送料は外部発送/標準送料で判定
              const isExternal = isExternalShipping(sale.shipping_cost)
              if (value === '外部発送' && !isExternal) {
                columnFilterMatch = false
                break
              }
              if (value === '標準送料' && isExternal) {
                columnFilterMatch = false
                break
              }
            } else if (key === 'profit') {
              // 利益は黒字/赤字で判定
              if (value === '黒字' && sale.profit < 0) {
                columnFilterMatch = false
                break
              }
              if (value === '赤字' && sale.profit >= 0) {
                columnFilterMatch = false
                break
              }
            } else if (key === 'profit_rate') {
              // 利益率は黒字/赤字で判定
              if (value === '黒字' && sale.profit_rate < 0) {
                columnFilterMatch = false
                break
              }
              if (value === '赤字' && sale.profit_rate >= 0) {
                columnFilterMatch = false
                break
              }
            } else {
              const saleValue = sale[key as keyof UnifiedSale]
              if (saleValue !== value) {
                columnFilterMatch = false
                break
              }
            }
          }
        }

        return dateMatch && typeMatch && salesTypeMatch && searchMatch && columnFilterMatch
      })
      .sort((a, b) => {
        // sale_dateがnullの場合は最後にソート
        if (!a.sale_date && !b.sale_date) return 0
        if (!a.sale_date) return 1
        if (!b.sale_date) return -1
        return b.sale_date.localeCompare(a.sale_date)
      })
  }, [unifiedSales, selectedYear, selectedMonth, filterType, salesTypeFilter, retailPlatforms, wholesalePlatforms, searchQuery, columnFilters])

  // ソート済みの販売データ
  const sortedSales = useMemo(() => {
    return [...filteredSales].sort((a, b) => {
      // 列ヘッダーによるソートが優先
      if (sortColumn) {
        const dir = sortDirection === 'asc' ? 1 : -1
        if (sortColumn === 'inventory_number') {
          const numA = parseInt(a.inventory_number || '0') || 0
          const numB = parseInt(b.inventory_number || '0') || 0
          return (numA - numB) * dir
        }
        if (sortColumn === 'sale_price') return ((a.sale_price || 0) - (b.sale_price || 0)) * dir
        if (sortColumn === 'profit') return ((a.profit || 0) - (b.profit || 0)) * dir
        if (sortColumn === 'profit_rate') return ((a.profit_rate || 0) - (b.profit_rate || 0)) * dir
        if (sortColumn === 'sale_date') {
          if (!a.sale_date && !b.sale_date) return 0
          if (!a.sale_date) return 1
          if (!b.sale_date) return -1
          return a.sale_date.localeCompare(b.sale_date) * dir
        }
        // 文字列列
        const valA = String(a[sortColumn as keyof UnifiedSale] || '')
        const valB = String(b[sortColumn as keyof UnifiedSale] || '')
        return valA.localeCompare(valB, 'ja') * dir
      }
      // 従来のボタンソート
      if (historySortBy === 'sales') return (b.sale_price || 0) - (a.sale_price || 0)
      if (historySortBy === 'profit') return (b.profit || 0) - (a.profit || 0)
      if (historySortBy === 'profitRate') return (b.profit_rate || 0) - (a.profit_rate || 0)
      // date (default)
      if (!a.sale_date && !b.sale_date) return 0
      if (!a.sale_date) return 1
      if (!b.sale_date) return -1
      return b.sale_date.localeCompare(a.sale_date)
    })
  }, [filteredSales, historySortBy, sortColumn, sortDirection])

  // 数値列のキー
  const numericColumns = ['sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price', 'purchase_total', 'deposit_amount', 'profit', 'turnover_days']

  // 選択されたセルの集計
  const selectionStats = useMemo(() => {
    if (selectedCells.size === 0) return null

    let sum = 0
    let count = 0
    let numericCount = 0

    selectedCells.forEach(cellKey => {
      const [rowIdxStr, colKey] = cellKey.split(':')
      const rowIdx = parseInt(rowIdxStr)
      const sale = sortedSales[rowIdx]
      if (!sale) return

      count++

      if (numericColumns.includes(colKey)) {
        const value = sale[colKey as keyof UnifiedSale]
        if (typeof value === 'number') {
          sum += value
          numericCount++
        }
      }
    })

    return {
      count,
      sum: numericCount > 0 ? sum : null,
      average: numericCount > 0 ? Math.round(sum / numericCount) : null
    }
  }, [selectedCells, sortedSales])

  // セル選択のハンドラー
  const handleCellMouseDown = (rowIdx: number, colKey: string, e: React.MouseEvent) => {
    // 右クリックの場合は無視
    if (e.button !== 0) return

    const cellKey = `${rowIdx}:${colKey}`

    if (e.shiftKey && selectionStart) {
      // Shift+クリックで範囲選択
      const newSelection = new Set<string>()
      const startRow = Math.min(selectionStart.row, rowIdx)
      const endRow = Math.max(selectionStart.row, rowIdx)
      const colKeys = visibleColumns.map(c => c.key)
      const startColIdx = colKeys.indexOf(selectionStart.col)
      const endColIdx = colKeys.indexOf(colKey)
      const minColIdx = Math.min(startColIdx, endColIdx)
      const maxColIdx = Math.max(startColIdx, endColIdx)

      for (let r = startRow; r <= endRow; r++) {
        for (let c = minColIdx; c <= maxColIdx; c++) {
          newSelection.add(`${r}:${colKeys[c]}`)
        }
      }
      setSelectedCells(newSelection)
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+クリックで追加/解除
      const newSelection = new Set(selectedCells)
      if (newSelection.has(cellKey)) {
        newSelection.delete(cellKey)
      } else {
        newSelection.add(cellKey)
      }
      setSelectedCells(newSelection)
      setSelectionStart({ row: rowIdx, col: colKey })
    } else {
      // 通常クリックで単一選択開始
      setSelectedCells(new Set([cellKey]))
      setSelectionStart({ row: rowIdx, col: colKey })
      setIsSelecting(true)
    }
  }

  const handleCellMouseEnter = (rowIdx: number, colKey: string) => {
    if (!isSelecting || !selectionStart) return

    const newSelection = new Set<string>()
    const startRow = Math.min(selectionStart.row, rowIdx)
    const endRow = Math.max(selectionStart.row, rowIdx)
    const colKeys = visibleColumns.map(c => c.key)
    const startColIdx = colKeys.indexOf(selectionStart.col)
    const endColIdx = colKeys.indexOf(colKey)
    const minColIdx = Math.min(startColIdx, endColIdx)
    const maxColIdx = Math.max(startColIdx, endColIdx)

    for (let r = startRow; r <= endRow; r++) {
      for (let c = minColIdx; c <= maxColIdx; c++) {
        newSelection.add(`${r}:${colKeys[c]}`)
      }
    }
    setSelectedCells(newSelection)
  }

  const handleMouseUp = () => {
    setIsSelecting(false)
  }

  // 編集可能セルのレンダリング
  const renderEditableCell = useCallback((
    sale: UnifiedSale,
    field: string,
    value: string | number | null,
    displayValue: React.ReactNode,
    className: string,
    rowIdx: number,
    cellClass: string
  ) => {
    const isEditing = editingCell?.id === sale.id && editingCell?.field === field
    const isEditable = editableColumns.includes(field)

    if (isEditing) {
      const isNumeric = ['sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price', 'deposit_amount'].includes(field)
      const isDate = ['purchase_date', 'listing_date', 'sale_date'].includes(field)

      return (
        <td key={field} className={`px-1 py-1 ${className}`}>
          <input
            type={isDate ? 'date' : isNumeric ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCellSave()
              if (e.key === 'Escape') handleCellCancel()
            }}
            autoFocus
            className={`w-full px-1 py-0.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${isNumeric ? 'text-right' : ''}`}
          />
        </td>
      )
    }

    return (
      <td
        key={field}
        className={`${className} ${cellClass} ${isEditable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
        onMouseDown={(e) => handleCellMouseDown(rowIdx, field, e)}
        onMouseEnter={() => handleCellMouseEnter(rowIdx, field)}
        onDoubleClick={() => isEditable && handleCellEdit(sale.id, field, value)}
        title={isEditable ? 'ダブルクリックで編集' : undefined}
      >
        {displayValue}
      </td>
    )
  }, [editingCell, editValue, editableColumns, handleCellEdit, handleCellSave, handleCellCancel, handleCellMouseDown, handleCellMouseEnter])

  // CSVエクスポート関数
  const exportToCSV = useCallback(() => {
    if (sortedSales.length === 0) {
      alert('エクスポートするデータがありません')
      return
    }

    // CSVヘッダー（visibleColumnsを使用、imageは画像URLとして出力）
    const csvColumns = visibleColumns.map(col =>
      col.key === 'image' ? { ...col, key: 'image_url', label: '画像URL' } : col
    )
    const headers = csvColumns.map(col => col.label)

    // CSVデータ行
    const rows = sortedSales.map(sale => {
      return csvColumns.map(col => {
        let value: string | number | null | undefined

        // purchase_total（仕入総額）は purchase_cost を使用
        if (col.key === 'purchase_total') {
          value = sale.purchase_cost
        } else {
          const key = col.key as keyof UnifiedSale
          value = sale[key]
        }

        // 値のフォーマット
        if (value === null || value === undefined) {
          return ''
        }
        if (typeof value === 'number') {
          return value.toString()
        }
        // 文字列にカンマや改行、ダブルクォートが含まれる場合はエスケープ
        const strValue = String(value)
        if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
          return `"${strValue.replace(/"/g, '""')}"`
        }
        return strValue
      })
    })

    // BOM付きUTF-8でCSV生成（Excel対応）
    const bom = '\uFEFF'
    const csvContent = bom + [headers.join(','), ...rows.map(row => row.join(','))].join('\n')

    // ダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // ファイル名に検索条件を含める
    const datePart = selectedYear === 'all' ? '全期間' : selectedMonth === 'all' ? `${selectedYear}年` : `${selectedYear}年${selectedMonth}月`
    const filterPart = filterType !== 'all' ? `_${filterType === 'single' ? '単品' : filterType === 'bulk' ? 'まとめ' : '手入力'}` : ''
    const salesTypePart = salesTypeFilter !== 'all' ? `_${salesTypeFilter === 'toC' ? '小売' : '業販'}` : ''
    const timestamp = new Date().toISOString().slice(0, 10)
    link.download = `売上明細_${datePart}${filterPart}${salesTypePart}_${timestamp}.csv`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [sortedSales, visibleColumns, selectedYear, selectedMonth, filterType, salesTypeFilter])

  // バックアップ機能（全データをJSONでエクスポート）
  const exportBackup = useCallback(async () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        inventory,
        bulkPurchases,
        bulkSales,
        manualSales,
        salesSummary
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `バックアップ_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      alert('バックアップを保存しました')
    } catch (error) {
      console.error('Backup error:', error)
      alert('バックアップの保存に失敗しました')
    }
  }, [inventory, bulkPurchases, bulkSales, manualSales, salesSummary])

  // CSVインポート（商品名を上書き更新）
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{ id: string; inventory_number: string; old_name: string; new_name: string }[]>([])
  const [showImportModal, setShowImportModal] = useState(false)

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      // BOMを除去
      const cleanText = text.replace(/^\uFEFF/, '')

      // PapaParseでCSVをパース
      const parsed = Papa.parse(cleanText, {
        header: true,
        skipEmptyLines: true,
      })

      const rows = parsed.data as Record<string, string>[]
      if (rows.length === 0) {
        alert('CSVファイルにデータがありません')
        return
      }

      const headers = Object.keys(rows[0] || {})
      const hasInventoryNumber = headers.includes('管理番号')
      const hasProductName = headers.includes('商品名')

      if (!hasInventoryNumber || !hasProductName) {
        alert('CSVに「管理番号」と「商品名」列が必要です')
        return
      }

      // 差分をプレビュー
      const changes: { id: string; inventory_number: string; old_name: string; new_name: string }[] = []

      // デバッグ: manualSalesの件数と最初の数件のinventory_numberを表示
      console.log('manualSales件数:', manualSales.length)
      console.log('manualSales inventory_number一覧（最初の20件）:', manualSales.slice(0, 20).map(s => s.inventory_number))
      console.log('CSV管理番号一覧（最初の10件）:', rows.slice(0, 10).map(r => r['管理番号']))

      for (const row of rows) {
        const invNum = row['管理番号']?.trim()
        const newName = row['商品名']?.trim()

        if (!invNum || !newName) continue

        // 売上明細（manual_sales）から対応するアイテムを検索
        const item = manualSales.find(sale => sale.inventory_number === invNum)
        if (item && item.product_name !== newName) {
          changes.push({
            id: item.id,
            inventory_number: invNum,
            old_name: item.product_name || '',
            new_name: newName
          })
        }
      }

      if (changes.length === 0) {
        // デバッグ: 一致しない理由を表示
        const sampleInvNums = rows.slice(0, 3).map(r => r['管理番号']?.trim())
        const matchingSales = manualSales.filter(s => sampleInvNums.includes(s.inventory_number || ''))
        console.log('サンプル管理番号:', sampleInvNums)
        console.log('一致するmanualSales:', matchingSales.length)
        alert('変更が見つかりませんでした（商品名が同じ、または管理番号が一致しない）\nブラウザのコンソールでデバッグ情報を確認してください')
        return
      }

      setImportPreview(changes)
      setShowImportModal(true)
    }
    reader.readAsText(file)
    // inputをリセット
    e.target.value = ''
  }, [manualSales])

  const executeImport = useCallback(async () => {
    if (importPreview.length === 0) return

    try {
      // manual_salesテーブルを更新
      for (const change of importPreview) {
        const { error } = await supabase
          .from('manual_sales')
          .update({ product_name: change.new_name })
          .eq('id', change.id)

        if (error) throw error
      }

      // sales_summaryも更新（manual_salesはsource_type='manual'）
      for (const change of importPreview) {
        await supabase
          .from('sales_summary')
          .update({ product_name: change.new_name })
          .eq('source_type', 'manual')
          .eq('inventory_number', change.inventory_number)
      }

      alert(`${importPreview.length}件の商品名を更新しました`)
      setShowImportModal(false)
      setImportPreview([])

      // データを再取得
      window.location.reload()
    } catch (error) {
      console.error('Import error:', error)
      alert('インポートに失敗しました: ' + (error as Error).message)
    }
  }, [importPreview])

  // ヘルパー関数
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
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={exportToCSV}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                title="検索結果をCSVファイルとしてダウンロード"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                CSVエクスポート
              </button>
              <button
                onClick={exportBackup}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                title="全データをJSONでバックアップ"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                バックアップ
              </button>
              <label
                className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="編集したCSVをインポートして商品名を更新"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSVインポート
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
              <div className="relative">
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
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            読み込み中...
          </div>
        ) : (
          /* 販売データテーブル */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-white">
                  {selectedYear === 'all' ? '全年' : `${selectedYear}年${selectedMonth === 'all' ? '（全月）' : `${parseInt(selectedMonth)}月`}`}の売上明細
                  {salesTypeFilter !== 'all' && ` [${salesTypeFilter === 'toC' ? '小売' : '業販'}]`}
                  （{filteredSales.reduce((sum, s) => sum + s.quantity, 0)}点）
                  {filterType !== 'all' && ` - ${filterType === 'single' ? '単品' : filterType === 'bulk' ? 'まとめ' : '手入力'}`}
                </h2>
                {/* 有効なフィルターのバッジ表示 */}
                {Object.entries(columnFilters).filter(([_, v]) => v && v !== '').length > 0 && (
                  <div className="flex items-center gap-1">
                    {Object.entries(columnFilters)
                      .filter(([_, v]) => v && v !== '')
                      .map(([key, value]) => {
                        const colLabel = defaultColumns.find(c => c.key === key)?.label || key
                        return (
                          <span
                            key={key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                          >
                            {colLabel}: {value}
                            <button
                              onClick={() => setColumnFilters(prev => ({ ...prev, [key]: '' }))}
                              className="hover:text-blue-900"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        )
                      })}
                    <button
                      onClick={() => setColumnFilters({})}
                      className="text-xs text-white hover:text-gray-200 underline ml-1"
                    >
                      全解除
                    </button>
                  </div>
                )}
              </div>
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
            <div
              className="overflow-x-auto max-h-[70vh] overflow-y-auto select-none"
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50">
                    {visibleColumns.map(col => {
                      const isFilterable = filterableColumns.includes(col.key)
                      const isSortable = ['inventory_number', 'sale_price', 'profit', 'profit_rate', 'sale_date', 'purchase_date', 'turnover_days'].includes(col.key)
                      const hasFilter = columnFilters[col.key] && columnFilters[col.key] !== ''
                      const isCurrentSort = sortColumn === col.key

                      const handleSort = () => {
                        if (isCurrentSort) {
                          if (sortDirection === 'desc') {
                            setSortDirection('asc')
                          } else {
                            setSortColumn(null)
                            setSortDirection('desc')
                          }
                        } else {
                          setSortColumn(col.key)
                          setSortDirection('desc')
                        }
                      }

                      return (
                        <th
                          key={col.key}
                          className={`px-2 py-3 text-xs font-semibold text-gray-600 bg-gray-50 whitespace-nowrap relative ${
                            ['sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price', 'purchase_total', 'deposit_amount', 'profit', 'profit_rate', 'turnover_days'].includes(col.key)
                              ? 'text-right'
                              : ['purchase_date', 'listing_date', 'sale_date'].includes(col.key)
                              ? 'text-center'
                              : 'text-left'
                          }`}
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>{col.label}</span>
                            {/* ソートアイコン */}
                            {isSortable && (
                              <button
                                onClick={handleSort}
                                className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${isCurrentSort ? 'text-blue-600' : 'text-gray-400'}`}
                                title={isCurrentSort ? (sortDirection === 'desc' ? '降順' : '昇順') : 'ソート'}
                              >
                                {isCurrentSort ? (
                                  sortDirection === 'desc' ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  )
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </button>
                            )}
                            {/* フィルターアイコン */}
                            {isFilterable && (
                              <>
                                <button
                                  onClick={() => setOpenFilterColumn(openFilterColumn === col.key ? null : col.key)}
                                  className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${hasFilter ? 'text-blue-600' : 'text-gray-400'}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                  </svg>
                                </button>
                                {openFilterColumn === col.key && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setOpenFilterColumn(null)}
                                    />
                                    <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px] max-h-[300px] overflow-y-auto">
                                      <div
                                        onClick={() => {
                                          setColumnFilters(prev => ({ ...prev, [col.key]: '' }))
                                          setOpenFilterColumn(null)
                                        }}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${!columnFilters[col.key] ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                                      >
                                        すべて
                                      </div>
                                      {columnUniqueValues[col.key]?.map(value => (
                                        <div
                                          key={value}
                                          onClick={() => {
                                            setColumnFilters(prev => ({ ...prev, [col.key]: value }))
                                            setOpenFilterColumn(null)
                                          }}
                                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${columnFilters[col.key] === value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                                        >
                                          {value}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedSales
                    .slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize)
                    .map((sale, displayIdx) => {
                      const rowIdx = (historyPage - 1) * historyPageSize + displayIdx
                      return (
                    <tr key={`${sale.type}-${sale.id}`} className="hover:bg-gray-50/50 transition-colors">
                      {visibleColumns.map(col => {
                        const cellKey = `${rowIdx}:${col.key}`
                        const isSelected = selectedCells.has(cellKey)
                        const cellClass = isSelected ? 'bg-blue-100' : ''
                        switch (col.key) {
                          case 'inventory_number':
                            return <td key={col.key} className={`px-2 py-2 text-gray-700 text-xs truncate max-w-[60px] cursor-cell ${cellClass}`} title={sale.inventory_number || '-'} onMouseDown={(e) => handleCellMouseDown(rowIdx, col.key, e)} onMouseEnter={() => handleCellMouseEnter(rowIdx, col.key)}>{sale.inventory_number || '-'}</td>
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
                            return renderEditableCell(sale, 'category', sale.category, sale.category || '-', 'px-2 py-2 text-gray-700 text-xs', rowIdx, cellClass)
                          case 'brand_name':
                            return renderEditableCell(sale, 'brand_name', sale.brand_name, sale.brand_name || '-', 'px-2 py-2 text-gray-700 text-xs', rowIdx, cellClass)
                          case 'product_name':
                            return renderEditableCell(sale, 'product_name', sale.product_name, <div className="text-gray-900 text-xs font-medium truncate max-w-[150px]">{sale.product_name}</div>, 'px-2 py-2', rowIdx, cellClass)
                          case 'purchase_source':
                            return renderEditableCell(sale, 'purchase_source', sale.purchase_source, sale.purchase_source || '-', 'px-2 py-2 text-gray-700 text-xs', rowIdx, cellClass)
                          case 'sale_destination':
                            return renderEditableCell(sale, 'sale_destination', sale.sale_destination, sale.sale_destination || '-', 'px-2 py-2 text-gray-700 text-xs', rowIdx, cellClass)
                          case 'sale_price':
                            return renderEditableCell(sale, 'sale_price', sale.sale_price, formatCurrency(sale.sale_price), 'px-2 py-2 text-right text-gray-700 tabular-nums text-xs', rowIdx, cellClass)
                          case 'commission':
                            return renderEditableCell(sale, 'commission', sale.commission, formatCurrency(sale.commission), 'px-2 py-2 text-right text-gray-700 tabular-nums text-xs', rowIdx, cellClass)
                          case 'shipping_cost':
                            return renderEditableCell(sale, 'shipping_cost', sale.shipping_cost, formatCurrency(sale.shipping_cost), `px-2 py-2 text-right tabular-nums text-xs ${isExternalShipping(sale.shipping_cost) ? 'text-blue-600 font-semibold' : 'text-gray-700'}`, rowIdx, cellClass)
                          case 'other_cost':
                            return renderEditableCell(sale, 'other_cost', sale.other_cost, formatCurrency(sale.other_cost), 'px-2 py-2 text-right text-gray-700 tabular-nums text-xs', rowIdx, cellClass)
                          case 'purchase_price':
                            return renderEditableCell(sale, 'purchase_price', sale.purchase_price, formatCurrency(sale.purchase_price), 'px-2 py-2 text-right text-gray-700 tabular-nums text-xs', rowIdx, cellClass)
                          case 'purchase_total':
                            return <td key={col.key} className={`px-2 py-2 text-right text-gray-700 tabular-nums text-xs cursor-cell ${cellClass}`} onMouseDown={(e) => handleCellMouseDown(rowIdx, col.key, e)} onMouseEnter={() => handleCellMouseEnter(rowIdx, col.key)}>{formatCurrency(sale.purchase_cost)}</td>
                          case 'deposit_amount':
                            return renderEditableCell(sale, 'deposit_amount', sale.deposit_amount, formatCurrency(sale.deposit_amount), 'px-2 py-2 text-right text-gray-700 tabular-nums text-xs', rowIdx, cellClass)
                          case 'profit':
                            return (
                              <td key={col.key} className={`px-2 py-2 text-right tabular-nums text-xs font-medium cursor-cell ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'} ${cellClass}`} onMouseDown={(e) => handleCellMouseDown(rowIdx, col.key, e)} onMouseEnter={() => handleCellMouseEnter(rowIdx, col.key)}>
                                {formatCurrency(sale.profit)}
                              </td>
                            )
                          case 'profit_rate':
                            return (
                              <td key={col.key} className={`px-2 py-2 text-right tabular-nums text-xs cursor-cell ${sale.profit_rate >= 0 ? 'text-green-600' : 'text-red-600'} ${cellClass}`} onMouseDown={(e) => handleCellMouseDown(rowIdx, col.key, e)} onMouseEnter={() => handleCellMouseEnter(rowIdx, col.key)}>
                                {sale.profit_rate}%
                              </td>
                            )
                          case 'purchase_date':
                            return renderEditableCell(sale, 'purchase_date', sale.purchase_date, formatDate(sale.purchase_date), 'px-2 py-2 text-center text-gray-700 text-xs', rowIdx, cellClass)
                          case 'listing_date':
                            return renderEditableCell(sale, 'listing_date', sale.listing_date, formatDate(sale.listing_date), 'px-2 py-2 text-center text-gray-700 text-xs', rowIdx, cellClass)
                          case 'sale_date':
                            return renderEditableCell(sale, 'sale_date', sale.sale_date, formatDate(sale.sale_date), 'px-2 py-2 text-center text-gray-700 text-xs', rowIdx, cellClass)
                          case 'turnover_days':
                            return <td key={col.key} className={`px-2 py-2 text-right text-gray-700 tabular-nums text-xs cursor-cell ${cellClass}`} onMouseDown={(e) => handleCellMouseDown(rowIdx, col.key, e)} onMouseEnter={() => handleCellMouseEnter(rowIdx, col.key)}>{sale.turnover_days !== null ? `${sale.turnover_days}日` : '-'}</td>
                          case 'memo':
                            return renderEditableCell(sale, 'memo', sale.memo, sale.memo || '-', 'px-2 py-2 text-gray-700 text-xs truncate max-w-[100px]', rowIdx, cellClass)
                          default:
                            return null
                        }
                      })}
                    </tr>
                      )
                    })}
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
            {/* 選択範囲の集計ステータスバー */}
            {selectionStats && (
              <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 flex items-center gap-6 text-sm">
                <span className="text-blue-700 font-medium">選択: {selectionStats.count}セル</span>
                {selectionStats.sum !== null && (
                  <>
                    <span className="text-blue-700">
                      合計: <span className="font-semibold">¥{selectionStats.sum.toLocaleString()}</span>
                    </span>
                    <span className="text-blue-700">
                      平均: <span className="font-semibold">¥{selectionStats.average?.toLocaleString()}</span>
                    </span>
                  </>
                )}
                <button
                  onClick={() => setSelectedCells(new Set())}
                  className="ml-auto text-blue-600 hover:text-blue-800 text-xs"
                >
                  選択解除
                </button>
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

        {/* CSVインポートプレビューモーダル */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  インポートプレビュー（{importPreview.length}件の変更）
                </h3>
                <button
                  onClick={() => { setShowImportModal(false); setImportPreview([]); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="text-sm text-gray-600 mb-4">
                  以下の商品名が変更されます。確認後「実行」をクリックしてください。
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">管理番号</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">変更前</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-700">→</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">変更後</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importPreview.map((change, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900 font-mono">{change.inventory_number}</td>
                        <td className="px-3 py-2 text-red-600 line-through">{change.old_name}</td>
                        <td className="px-3 py-2 text-center text-gray-400">→</td>
                        <td className="px-3 py-2 text-green-600 font-medium">{change.new_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
                <button
                  onClick={() => { setShowImportModal(false); setImportPreview([]); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={executeImport}
                  className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  {importPreview.length}件を更新
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
