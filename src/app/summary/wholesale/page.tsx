'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts'

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

type Platform = {
  id: string
  name: string
  sales_type: 'toB' | 'toC'
}

export default function WholesaleSalesPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'graph'>('history')
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<string>('sale_date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [imageEditModal, setImageEditModal] = useState<{ id: string; currentUrl: string | null } | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [isDraggingImage, setIsDraggingImage] = useState(false)

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
      // 在庫データ取得（全件取得するためにページネーション）
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

      // 販路マスタ取得
      const { data: platformData, error: platformError } = await supabase
        .from('platforms')
        .select('id, name, sales_type')

      if (platformError) {
        console.error('Error fetching platforms:', platformError)
      } else {
        setPlatforms(platformData || [])
      }

      setLoading(false)
    }

    fetchData()

    // 現在の年月をデフォルトで設定
    const now = new Date()
    setSelectedYear(now.getFullYear().toString())
    setSelectedMonth((now.getMonth() + 1).toString().padStart(2, '0'))
  }, [])

  // 有効な日付形式かどうかをチェック（YYYY-MM-DD または YYYY/MM/DD形式）
  const isValidDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false
    if (/返品|不明|キャンセル/.test(dateStr)) return false
    return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)
  }

  // 日付を統一形式（YYYY-MM）に変換
  const normalizeYearMonth = (dateStr: string): string => {
    return dateStr.substring(0, 7).replace('/', '-')
  }

  // 年を抽出（バリデーション付き）
  const extractYear = (dateStr: string | null): string | null => {
    if (!dateStr) return null
    const year = dateStr.substring(0, 4)
    if (/^\d{4}$/.test(year) && parseInt(year) >= 2000) {
      return year
    }
    return null
  }

  // 業販（toB）の販路名リスト
  const wholesalePlatformNames = useMemo(() => {
    return platforms.filter(p => p.sales_type === 'toB').map(p => p.name)
  }, [platforms])

  // 業販販売のみのアイテム（sale_destinationがtoB販路のもの）
  const wholesaleInventory = useMemo(() => {
    return inventory.filter(item =>
      item.sale_destination && wholesalePlatformNames.includes(item.sale_destination)
    )
  }, [inventory, wholesalePlatformNames])


  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    // 現在の年を必ず含める
    years.add(new Date().getFullYear().toString())
    wholesaleInventory.forEach(item => {
      const year = extractYear(item.sale_date)
      if (year) years.add(year)
    })
    return ['all', ...[...years].sort().reverse()]
  }, [wholesaleInventory])

  // 月のリスト（年間オプション付き）
  const months = ['all', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

  // 選択された年月でフィルタリングした販売済みアイテム
  const filteredSoldItems = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []

    const isAllYears = selectedYear === 'all'
    const isYearly = selectedMonth === 'all'
    const yearMonth = `${selectedYear}-${selectedMonth}`

    return wholesaleInventory.filter(item => {
      // 販売先が入っていれば売上認定（sale_dateは必須ではない）
      if (!item.sale_destination) return false

      // 日付フィルター（sale_dateがある場合のみ適用、ない場合は全期間に含める）
      if (!isAllYears && isValidDate(item.sale_date)) {
        const normalized = normalizeYearMonth(item.sale_date!)
        return isYearly
          ? normalized.startsWith(selectedYear)
          : normalized === yearMonth
      }
      return isAllYears // 全期間選択時は全て含める、それ以外で日付がない場合は除外
    })
  }, [wholesaleInventory, selectedYear, selectedMonth])

  // ソート済みアイテム
  const sortedSoldItems = useMemo(() => {
    const items = [...filteredSoldItems]

    items.sort((a, b) => {
      let aVal: string | number | null = null
      let bVal: string | number | null = null

      switch (sortKey) {
        case 'inventory_number':
          aVal = a.inventory_number || ''
          bVal = b.inventory_number || ''
          break
        case 'category':
          aVal = a.category || ''
          bVal = b.category || ''
          break
        case 'brand_name':
          aVal = a.brand_name || ''
          bVal = b.brand_name || ''
          break
        case 'product_name':
          aVal = a.product_name || ''
          bVal = b.product_name || ''
          break
        case 'purchase_source':
          aVal = a.purchase_source || ''
          bVal = b.purchase_source || ''
          break
        case 'sale_destination':
          aVal = a.sale_destination || ''
          bVal = b.sale_destination || ''
          break
        case 'sale_price':
          aVal = a.sale_price || 0
          bVal = b.sale_price || 0
          break
        case 'commission':
          aVal = a.commission || 0
          bVal = b.commission || 0
          break
        case 'shipping_cost':
          aVal = a.shipping_cost || 0
          bVal = b.shipping_cost || 0
          break
        case 'other_cost':
          aVal = a.other_cost || 0
          bVal = b.other_cost || 0
          break
        case 'purchase_price':
          aVal = a.purchase_price || 0
          bVal = b.purchase_price || 0
          break
        case 'purchase_total':
          aVal = a.purchase_total || 0
          bVal = b.purchase_total || 0
          break
        case 'deposit_amount':
          aVal = a.deposit_amount || 0
          bVal = b.deposit_amount || 0
          break
        case 'profit':
          aVal = (a.sale_price || 0) - (a.commission || 0) - (a.shipping_cost || 0) - (a.purchase_total || 0)
          bVal = (b.sale_price || 0) - (b.commission || 0) - (b.shipping_cost || 0) - (b.purchase_total || 0)
          break
        case 'profit_rate':
          const aSales = a.sale_price || 0
          const bSales = b.sale_price || 0
          const aProfit = aSales - (a.commission || 0) - (a.shipping_cost || 0) - (a.purchase_total || 0)
          const bProfit = bSales - (b.commission || 0) - (b.shipping_cost || 0) - (b.purchase_total || 0)
          aVal = aSales > 0 ? (aProfit / aSales) * 100 : 0
          bVal = bSales > 0 ? (bProfit / bSales) * 100 : 0
          break
        case 'purchase_date':
          aVal = a.purchase_date || ''
          bVal = b.purchase_date || ''
          break
        case 'listing_date':
          aVal = a.listing_date || ''
          bVal = b.listing_date || ''
          break
        case 'sale_date':
          aVal = a.sale_date || ''
          bVal = b.sale_date || ''
          break
        case 'turnover_days':
          if (a.purchase_date && a.sale_date) {
            aVal = Math.ceil((new Date(a.sale_date).getTime() - new Date(a.purchase_date).getTime()) / (1000 * 60 * 60 * 24))
          } else {
            aVal = sortDirection === 'asc' ? 999999 : -1
          }
          if (b.purchase_date && b.sale_date) {
            bVal = Math.ceil((new Date(b.sale_date).getTime() - new Date(b.purchase_date).getTime()) / (1000 * 60 * 60 * 24))
          } else {
            bVal = sortDirection === 'asc' ? 999999 : -1
          }
          break
        default:
          aVal = a.sale_date || ''
          bVal = b.sale_date || ''
      }

      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return items
  }, [filteredSoldItems, sortKey, sortDirection])

  // ソートハンドラー
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  // 選択された年月でフィルタリングした集計
  const summary = useMemo(() => {
    if (!selectedYear || !selectedMonth) return null

    const soldItems = filteredSoldItems

    // 販売件数
    const soldCount = soldItems.length

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
      totalSales,
      totalPurchase,
      totalCommission,
      totalShipping,
      totalProfit,
      profitRate,
      avgSalePrice,
      avgProfit,
      avgPurchasePrice,
    }
  }, [filteredSoldItems, selectedYear, selectedMonth])

  // 販路別集計
  const platformSummary = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []

    const soldItems = filteredSoldItems

    // 販路ごとに集計
    const platformStats = new Map<string, {
      count: number
      sales: number
      purchase: number
      commission: number
      shipping: number
      profit: number
    }>()

    soldItems.forEach(item => {
      const platform = item.sale_destination || '不明'
      const current = platformStats.get(platform) || {
        count: 0,
        sales: 0,
        purchase: 0,
        commission: 0,
        shipping: 0,
        profit: 0
      }

      const sales = item.sale_price || 0
      const purchase = item.purchase_total || 0
      const commission = item.commission || 0
      const shipping = item.shipping_cost || 0
      const profit = sales - commission - shipping - purchase

      platformStats.set(platform, {
        count: current.count + 1,
        sales: current.sales + sales,
        purchase: current.purchase + purchase,
        commission: current.commission + commission,
        shipping: current.shipping + shipping,
        profit: current.profit + profit
      })
    })

    return Array.from(platformStats.entries())
      .map(([name, stats]) => ({
        name,
        ...stats,
        profitRate: stats.sales > 0 ? Math.round((stats.profit / stats.sales) * 100) : 0
      }))
      .sort((a, b) => b.sales - a.sales)
  }, [filteredSoldItems, selectedYear, selectedMonth])

  // 月別集計データ
  const monthlyData = useMemo(() => {
    if (!selectedYear || selectedYear === 'all') return []

    const monthList = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

    return monthList.map(month => {
      const yearMonth = `${selectedYear}-${month}`

      // 当月販売（業販のみ）- 販売先と売却日が設定されていれば販売済み
      const soldItems = wholesaleInventory.filter(item => {
        if (!item.sale_destination) return false
        if (!isValidDate(item.sale_date)) return false
        return normalizeYearMonth(item.sale_date!) === yearMonth
      })

      // 販売件数
      const soldCount = soldItems.length

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

      // 平均売価
      const avgSalePrice = soldCount > 0 ? Math.round(totalSales / soldCount) : 0

      // 平均利益
      const avgProfit = soldCount > 0 ? Math.round(totalProfit / soldCount) : 0

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
        avgProfit,
      }
    })
  }, [wholesaleInventory, selectedYear])

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
    const avgProfit = soldCount > 0 ? Math.round(totalProfit / soldCount) : 0

    return {
      soldCount,
      totalSales,
      costOfGoodsSold,
      totalCommission,
      totalShipping,
      totalProfit,
      profitRate,
      avgSalePrice,
      avgProfit,
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

  // 利益計算
  const calculateProfit = (item: InventoryItem) => {
    const sales = item.sale_price || 0
    const purchase = item.purchase_total || 0
    const commission = item.commission || 0
    const shipping = item.shipping_cost || 0
    return sales - commission - shipping - purchase
  }

  // 利益率計算
  const calculateProfitRate = (item: InventoryItem) => {
    const sales = item.sale_price || 0
    const profit = calculateProfit(item)
    return sales > 0 ? Math.round((profit / sales) * 100) : 0
  }

  // 回転日数計算
  const calculateTurnoverDays = (item: InventoryItem) => {
    if (!item.purchase_date || !item.sale_date) return null
    const purchase = new Date(item.purchase_date)
    const sale = new Date(item.sale_date)
    const diffTime = sale.getTime() - purchase.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // 画像URL保存（URLから画像を取得してGoogleドライブにアップロード）
  const handleSaveImageUrl = async (id: string, url: string) => {
    if (!url.trim()) return
    try {
      // URLから画像を取得
      const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url.trim())}`)
      if (!response.ok) {
        throw new Error('画像の取得に失敗しました')
      }
      const blob = await response.blob()

      // Googleドライブにアップロード
      const formData = new FormData()
      const extension = blob.type.split('/')[1] || 'jpg'
      formData.append('file', blob, `inventory_${id}_${Date.now()}.${extension}`)
      formData.append('fileName', `inventory_${id}_${Date.now()}.${extension}`)

      const uploadResponse = await fetch('/api/google-drive/upload-file', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        if (uploadResponse.status === 401) {
          alert('Googleドライブにログインしてください。設定画面からGoogleアカウントを連携できます。')
          return
        }
        throw new Error(errorData.error || 'アップロードに失敗しました')
      }

      const { url: driveUrl } = await uploadResponse.json()

      const { error } = await supabase
        .from('inventory')
        .update({ image_url: driveUrl })
        .eq('id', id)
      if (error) throw error

      setInventory(prev => prev.map(item =>
        item.id === id ? { ...item, image_url: driveUrl } : item
      ))
      setImageEditModal(null)
      setImageUrlInput('')
    } catch (error) {
      console.error('Error saving image URL:', error)
      alert('画像の保存に失敗しました')
    }
  }

  // 画像ファイルをGoogleドライブにアップロード
  const handleImageDrop = async (id: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください')
      return
    }
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', `inventory_${id}_${Date.now()}.${file.type.split('/')[1] || 'jpg'}`)

      const response = await fetch('/api/google-drive/upload-file', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 401) {
          alert('Googleドライブにログインしてください。設定画面からGoogleアカウントを連携できます。')
          return
        }
        throw new Error(errorData.error || 'アップロードに失敗しました')
      }

      const { url } = await response.json()

      const { error } = await supabase
        .from('inventory')
        .update({ image_url: url })
        .eq('id', id)
      if (error) throw error

      setInventory(prev => prev.map(item =>
        item.id === id ? { ...item, image_url: url } : item
      ))
      setImageEditModal(null)
      setImageUrlInput('')
      setIsDraggingImage(false)
    } catch (error) {
      console.error('Error saving image:', error)
      alert('画像の保存に失敗しました')
    }
  }

  // プロキシ画像URL取得
  const getProxiedImageUrl = (url: string | null) => {
    if (!url) return null
    if (url.startsWith('/api/') || url.startsWith('data:')) return url
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">業販販売実績</h1>

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
            <div className="ml-auto flex items-center gap-4">
              <span className="text-sm text-gray-500">
                対象販路: {wholesalePlatformNames.join(', ') || 'なし'}
              </span>
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
        ) : activeTab === 'summary' ? (
          /* 集計タブ */
          <>
            {summary ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* サマリー */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-slate-600">
                    <h2 className="text-base font-semibold text-white">
                      {selectedYear}年{selectedMonth === 'all' ? '間' : `${parseInt(selectedMonth)}月`}の業販販売
                    </h2>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-gray-600 font-medium">販売件数</td>
                        <td className="px-6 py-3.5 text-right text-gray-700 tabular-nums">{summary.soldCount}件</td>
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

                {/* 販路別集計 */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-slate-600">
                    <h2 className="text-base font-semibold text-white">販路別内訳</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">販路</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">件数</th>
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
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                年月を選択してください
              </div>
            )}

            {/* 月別一覧表 */}
            {selectedYear && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-600">
                  <h2 className="text-base font-semibold text-white">{selectedYear}年 月別業販販売実績</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">月</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">件数</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">売上</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">原価</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">手数料</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">送料</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">利益</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">利益率</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">平均売価</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">平均利益</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthlyData.map((data) => (
                        <tr key={data.month} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3.5 text-center text-gray-900 font-semibold">{data.month}月</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.soldCount}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.totalSales)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.costOfGoodsSold)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.totalCommission)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.totalShipping)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.totalProfit)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{data.profitRate}%</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.avgSalePrice)}</td>
                          <td className="px-4 py-3.5 text-center text-gray-700 tabular-nums">{formatCurrency(data.avgProfit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {yearlyTotal && (
                      <tfoot>
                        <tr className="bg-slate-700 text-white">
                          <td className="px-4 py-4 text-center font-bold">合計</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.soldCount}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalSales)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.costOfGoodsSold)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalCommission)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalShipping)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.totalProfit)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{yearlyTotal.profitRate}%</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.avgSalePrice)}</td>
                          <td className="px-4 py-4 text-center tabular-nums font-semibold">{formatCurrency(yearlyTotal.avgProfit)}</td>
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
                {selectedYear}年{selectedMonth === 'all' ? '間' : `${parseInt(selectedMonth)}月`}の販売履歴（{filteredSoldItems.length}件）
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {visibleColumns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => col.key !== 'image' && handleSort(col.key)}
                        className={`px-2 py-3 text-xs font-semibold text-gray-600 ${
                          col.key !== 'image' ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                        } ${
                          ['sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price', 'purchase_total', 'deposit_amount', 'profit', 'profit_rate', 'turnover_days'].includes(col.key)
                            ? 'text-right'
                            : ['purchase_date', 'listing_date', 'sale_date'].includes(col.key)
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key && (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedSoldItems.map((item) => {
                    const profit = calculateProfit(item)
                    const profitRate = calculateProfitRate(item)
                    const turnoverDays = calculateTurnoverDays(item)
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        {visibleColumns.map(col => {
                          switch (col.key) {
                            case 'inventory_number':
                              return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{item.inventory_number || '-'}</td>
                            case 'image':
                              const imgUrl = item.saved_image_url || item.image_url
                              const proxyImageUrl = imgUrl
                                ? imgUrl.startsWith('/api/') || imgUrl.startsWith('data:')
                                  ? imgUrl
                                  : `/api/image-proxy?url=${encodeURIComponent(imgUrl)}`
                                : null
                              return (
                                <td key={col.key} className="px-2 py-2">
                                  <div className="relative group">
                                    {proxyImageUrl ? (
                                      <img
                                        src={proxyImageUrl}
                                        alt={item.product_name}
                                        className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => setEnlargedImage(proxyImageUrl)}
                                      />
                                    ) : (
                                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                                        No
                                      </div>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setImageEditModal({ id: item.id, currentUrl: imgUrl })
                                        setImageUrlInput('')
                                      }}
                                      className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-blue-600"
                                      title="画像を追加/編集"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                              )
                            case 'category':
                              return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{item.category || '-'}</td>
                            case 'brand_name':
                              return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{item.brand_name || '-'}</td>
                            case 'product_name':
                              return (
                                <td key={col.key} className="px-2 py-2">
                                  <div className="text-gray-900 text-xs font-medium truncate max-w-[150px]">{item.product_name}</div>
                                </td>
                              )
                            case 'purchase_source':
                              return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{item.purchase_source || '-'}</td>
                            case 'sale_destination':
                              return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs">{item.sale_destination || '-'}</td>
                            case 'sale_price':
                              return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(item.sale_price)}</td>
                            case 'commission':
                              return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(item.commission)}</td>
                            case 'shipping_cost':
                              return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(item.shipping_cost)}</td>
                            case 'other_cost':
                              return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(item.other_cost)}</td>
                            case 'purchase_price':
                              return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(item.purchase_price)}</td>
                            case 'purchase_total':
                              return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(item.purchase_total)}</td>
                            case 'deposit_amount':
                              return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{formatCurrency(item.deposit_amount)}</td>
                            case 'profit':
                              return (
                                <td key={col.key} className={`px-2 py-2 text-right tabular-nums text-xs font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(profit)}
                                </td>
                              )
                            case 'profit_rate':
                              return (
                                <td key={col.key} className={`px-2 py-2 text-right tabular-nums text-xs ${profitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {profitRate}%
                                </td>
                              )
                            case 'purchase_date':
                              return <td key={col.key} className="px-2 py-2 text-center text-gray-700 text-xs">{formatDate(item.purchase_date)}</td>
                            case 'listing_date':
                              return <td key={col.key} className="px-2 py-2 text-center text-gray-700 text-xs">{formatDate(item.listing_date)}</td>
                            case 'sale_date':
                              return <td key={col.key} className="px-2 py-2 text-center text-gray-700 text-xs">{formatDate(item.sale_date)}</td>
                            case 'turnover_days':
                              return <td key={col.key} className="px-2 py-2 text-right text-gray-700 tabular-nums text-xs">{turnoverDays !== null ? `${turnoverDays}日` : '-'}</td>
                            case 'memo':
                              return <td key={col.key} className="px-2 py-2 text-gray-700 text-xs truncate max-w-[100px]">{item.memo || '-'}</td>
                            default:
                              return null
                          }
                        })}
                      </tr>
                    )
                  })}
                  {sortedSoldItems.length === 0 && (
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

        {/* 画像編集モーダル */}
        {imageEditModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300]"
            onClick={() => {
              setImageEditModal(null)
              setImageUrlInput('')
              setIsDraggingImage(false)
            }}
          >
            <div
              className={`bg-white rounded-lg shadow-xl p-6 w-full max-w-md ${isDraggingImage ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
              onClick={(e) => e.stopPropagation()}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDraggingImage(true)
              }}
              onDragLeave={() => setIsDraggingImage(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDraggingImage(false)
                const file = e.dataTransfer.files[0]
                if (file) {
                  handleImageDrop(imageEditModal.id, file)
                }
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {imageEditModal.currentUrl ? '画像を編集' : '画像を追加'}
                </h3>
                <button
                  onClick={() => {
                    setImageEditModal(null)
                    setImageUrlInput('')
                    setIsDraggingImage(false)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {imageEditModal.currentUrl && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">現在の画像:</p>
                  <img
                    src={getProxiedImageUrl(imageEditModal.currentUrl) || ''}
                    alt=""
                    className="w-20 h-20 object-cover rounded border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}

              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-colors ${
                  isDraggingImage ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="wholesale-image-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleImageDrop(imageEditModal.id, file)
                    }
                  }}
                />
                <label htmlFor="wholesale-image-upload" className="cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-600">
                    画像をドラッグ&ドロップ<br />
                    <span className="text-blue-600 hover:text-blue-700">またはクリックして選択</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">最大5MB</p>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">または画像URLを入力</label>
                <input
                  type="text"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && imageUrlInput.trim()) {
                      handleSaveImageUrl(imageEditModal.id, imageUrlInput)
                    }
                  }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setImageEditModal(null)
                    setImageUrlInput('')
                    setIsDraggingImage(false)
                  }}
                  className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleSaveImageUrl(imageEditModal.id, imageUrlInput)}
                  disabled={!imageUrlInput.trim()}
                  className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  URL保存
                </button>
              </div>

              {imageEditModal.currentUrl && (
                <button
                  onClick={async () => {
                    if (confirm('画像を削除しますか？')) {
                      try {
                        const { error } = await supabase
                          .from('inventory')
                          .update({ image_url: null, saved_image_url: null })
                          .eq('id', imageEditModal.id)
                        if (error) throw error
                        setInventory(prev => prev.map(item =>
                          item.id === imageEditModal.id ? { ...item, image_url: null, saved_image_url: null } : item
                        ))
                        setImageEditModal(null)
                        setImageUrlInput('')
                      } catch (error) {
                        console.error('Error deleting image:', error)
                        alert('画像の削除に失敗しました')
                      }
                    }
                  }}
                  className="w-full mt-3 px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200"
                >
                  画像を削除
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
