'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { syncSalesSummary } from '@/lib/syncSalesSummary'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

type InventoryItem = {
  id: string
  product_name: string | null
  brand_name: string | null
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  purchase_price: number | null
  purchase_total: number | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  photography_fee: number | null
  deposit_amount: number | null
  other_cost: number | null
  profit: number | null
  status: string
  sale_type: string | null
  sale_destination: string | null
  image_url: string | null
}

type ManualSale = {
  id: string
  product_name: string | null
  brand_name: string | null
  sale_date: string | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  other_cost: number | null
  purchase_total: number | null
  profit: number | null
  sale_type: string | null
  sale_destination: string | null
  cost_recovered: boolean | null
}

type UserTodo = {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

type Platform = {
  id: string
  name: string
  sales_type: 'toC' | 'toB'
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
  sale_destination: string | null
  quantity: number
  sale_amount: number
  commission: number
  shipping_cost: number
  product_name: string | null
  purchase_price: number | null
  other_cost: number | null
  deposit_amount: number | null
}

type SalesSummaryRecord = {
  id: string
  source_type: 'single' | 'bulk' | 'manual'
  sale_destination: string | null
  sale_price: number
  purchase_cost: number
  profit: number
  sale_date: string | null
  quantity: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [manualSales, setManualSales] = useState<ManualSale[]>([])
  const [bulkPurchases, setBulkPurchases] = useState<BulkPurchase[]>([])
  const [bulkSales, setBulkSales] = useState<BulkSale[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [salesSummary, setSalesSummary] = useState<SalesSummaryRecord[]>([])
  const [loading, setLoading] = useState(true)

  // ユーザーToDo
  const [todos, setTodos] = useState<UserTodo[]>([])
  const [newTodoText, setNewTodoText] = useState('')
  const [todosLoaded, setTodosLoaded] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      // 在庫データを取得
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
          console.error('Error fetching inventory:', error.message || error)
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

      // 手入力売上データを取得
      let allManualSales: ManualSale[] = []
      from = 0
      hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_sales')
          .select('*')
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error fetching manual_sales:', error.message || error)
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

      // まとめ仕入れデータを取得
      const { data: bulkPurchasesData } = await supabase
        .from('bulk_purchases')
        .select('*')

      // まとめ売上データを取得
      const { data: bulkSalesData } = await supabase
        .from('bulk_sales')
        .select('*')

      // プラットフォームデータを取得
      const { data: platformsData } = await supabase
        .from('platforms')
        .select('id, name, sales_type')

      // sales_summaryデータを取得（売上レポートと同じ利益値を使用）
      let allSalesSummary: SalesSummaryRecord[] = []
      from = 0
      hasMore = true
      while (hasMore) {
        const { data, error } = await supabase
          .from('sales_summary')
          .select('id, source_type, sale_destination, sale_price, purchase_cost, profit, sale_date, quantity')
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error fetching sales_summary:', error.message || error)
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

      setInventory(allInventory)
      setManualSales(allManualSales)
      setBulkPurchases(bulkPurchasesData || [])
      setBulkSales(bulkSalesData || [])
      setPlatforms(platformsData || [])
      setSalesSummary(allSalesSummary)
      setLoading(false)
    }

    if (user) {
      fetchData()
    }
  }, [user])

  // ToDoをlocalStorageから読み込み
  useEffect(() => {
    const savedTodos = localStorage.getItem('dashboard_todos')
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos))
    }
    setTodosLoaded(true)
  }, [])

  // ToDoをlocalStorageに保存（初期化完了後のみ）
  useEffect(() => {
    if (todosLoaded) {
      localStorage.setItem('dashboard_todos', JSON.stringify(todos))
    }
  }, [todos, todosLoaded])

  // ToDo追加
  const addTodo = () => {
    if (!newTodoText.trim()) return
    const newTodo: UserTodo = {
      id: Date.now().toString(),
      text: newTodoText.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    }
    setTodos([newTodo, ...todos])
    setNewTodoText('')
  }

  // ToDo完了切り替え
  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  // ToDo削除
  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  // 今月の日付範囲
  const currentMonth = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0)
    return {
      year,
      month: month + 1,
      startDate,
      endDate,
      label: `${year}年${month + 1}月`
    }
  }, [])

  // まとめ仕入れのID→データのマップ
  const bulkPurchaseMap = useMemo(() => {
    const map = new Map<string, BulkPurchase>()
    bulkPurchases.forEach(bp => map.set(bp.id, bp))
    return map
  }, [bulkPurchases])

  // 今月のデータ
  const monthlyStats = useMemo(() => {
    const isThisMonth = (dateStr: string | null) => {
      if (!dateStr) return false
      const date = new Date(dateStr)
      return date >= currentMonth.startDate && date <= currentMonth.endDate
    }

    // 今月の仕入れ（在庫テーブルのみ）
    const purchases = inventory.filter(item => isThisMonth(item.purchase_date))
    const purchaseCount = purchases.length
    const purchaseTotal = purchases.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

    // sales_summaryから今月のデータを取得（売上レポートと同じデータソース）
    const summaryThisMonth = salesSummary.filter(item => isThisMonth(item.sale_date))
    const salesCount = summaryThisMonth.reduce((sum, item) => sum + item.quantity, 0)
    const salesTotal = summaryThisMonth.reduce((sum, item) => sum + item.sale_price, 0)
    const salesCost = summaryThisMonth.reduce((sum, item) => sum + item.purchase_cost, 0)
    const profit = summaryThisMonth.reduce((sum, item) => sum + item.profit, 0)
    const profitRate = salesTotal > 0 ? (profit / salesTotal) * 100 : 0
    const roi = salesCost > 0 ? (profit / salesCost) * 100 : 0

    // 小売（toC）・業販（toB）の販路名リスト
    const retailPlatformNames = platforms.filter(p => p.sales_type === 'toC').map(p => p.name)
    const wholesalePlatformNames = platforms.filter(p => p.sales_type === 'toB').map(p => p.name)

    // 小売・業販の内訳（sales_summaryから）
    const retailItems = summaryThisMonth.filter(item => item.sale_destination && retailPlatformNames.includes(item.sale_destination))
    const wholesaleItems = summaryThisMonth.filter(item => item.sale_destination && wholesalePlatformNames.includes(item.sale_destination))

    const retailCount = retailItems.reduce((sum, item) => sum + item.quantity, 0)
    const retailTotal = retailItems.reduce((sum, item) => sum + item.sale_price, 0)
    const retailProfit = retailItems.reduce((sum, item) => sum + item.profit, 0)
    const wholesaleCount = wholesaleItems.reduce((sum, item) => sum + item.quantity, 0)
    const wholesaleTotal = wholesaleItems.reduce((sum, item) => sum + item.sale_price, 0)
    const wholesaleProfit = wholesaleItems.reduce((sum, item) => sum + item.profit, 0)

    return {
      purchaseCount,
      purchaseTotal,
      salesCount,
      salesTotal,
      profit,
      profitRate,
      roi,
      retailCount,
      retailTotal,
      retailProfit,
      wholesaleCount,
      wholesaleTotal,
      wholesaleProfit
    }
  }, [inventory, salesSummary, platforms, currentMonth])

  // 本日の売上（sales_summaryから取得 - 売上レポートと同じデータソース）
  const todayStats = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // sales_summaryから本日売却のデータを取得
    const summaryToday = salesSummary.filter(item => item.sale_date === todayStr)

    return {
      salesCount: summaryToday.reduce((sum, item) => sum + item.quantity, 0),
      salesTotal: summaryToday.reduce((sum, item) => sum + item.sale_price, 0),
      profit: summaryToday.reduce((sum, item) => sum + item.profit, 0)
    }
  }, [salesSummary])

  // 在庫状況
  const stockStats = useMemo(() => {
    // 除外すべき文字列かどうかをチェック（在庫一覧ページと同じ）
    const isExcludedText = (value: string | null) => {
      if (!value) return false
      return value.includes('返品') || value.includes('不明')
    }

    // 除外対象：売却日または出品日に「返品」「不明」が含まれるもの
    const validItems = inventory.filter(item =>
      !isExcludedText(item.sale_date) && !isExcludedText(item.listing_date)
    )

    // 売却済み：売却日があるもの
    const sold = validItems.filter(item => item.sale_date)

    // 未販売：売却日が空のもの（= 在庫数）
    const unsold = validItems.filter(item => !item.sale_date)
    const unsoldValue = unsold.reduce((sum, item) => sum + (item.purchase_total || 0), 0)
    const unsoldValueCost = unsold.reduce((sum, item) => sum + (item.purchase_price || 0), 0)

    // 未出品：未販売かつ出品日が空のもの
    const unlisted = unsold.filter(item => !item.listing_date)
    const unlistedValue = unlisted.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

    // 出品中：未販売 - 未出品（出品日はあるが売却日がないもの）
    const listedCount = unsold.length - unlisted.length
    const listed = unsold.filter(item => item.listing_date)
    const listedValue = listed.reduce((sum, item) => sum + (item.purchase_total || 0), 0)

    return {
      unsoldCount: unsold.length,       // 在庫数（未販売）
      unsoldValue,                       // 在庫総額（仕入総額ベース）
      unsoldValueCost,                   // 在庫総額（原価ベース）
      listedCount,                       // 出品中（未販売 - 未出品）
      listedValue,                       // 出品中の在庫金額
      soldCount: sold.length,            // 売却済み
      unlistedCount: unlisted.length,    // 未出品
      unlistedValue,                     // 未出品の在庫金額
      totalStockValue: unsoldValue,      // 在庫総額（仕入総額ベース）
      totalStockValueCost: unsoldValueCost // 在庫総額（原価ベース）
    }
  }, [inventory])

  // 滞留在庫（出品日から90日以上売れていないもの）
  const { staleStock, staleStockCount } = useMemo(() => {
    const now = new Date()
    const threshold = 90 // 日

    const allStale = inventory
      .filter(item => {
        // 売却済は除外
        if (item.status === '売却済み') return false
        // 出品日がないものは除外
        if (!item.listing_date) return false
        const listingDate = new Date(item.listing_date)
        const days = Math.floor((now.getTime() - listingDate.getTime()) / (1000 * 60 * 60 * 24))
        return days >= threshold
      })
      .map(item => {
        const listingDate = new Date(item.listing_date!)
        const days = Math.floor((now.getTime() - listingDate.getTime()) / (1000 * 60 * 60 * 24))
        return { ...item, staleDays: days }
      })
      .sort((a, b) => b.staleDays - a.staleDays)

    return {
      staleStock: allStale.slice(0, 10),
      staleStockCount: allStale.length
    }
  }, [inventory])

  // クイックアクション生成
  const quickActions = useMemo(() => {
    const actions: { label: string; count: number; href: string; color: string; description: string }[] = []

    // 未出品
    actions.push({
      label: '未出品の在庫を確認する',
      count: stockStats.unlistedCount,
      href: '/?quickFilter=unlisted',
      color: 'bg-orange-500 hover:bg-orange-600',
      description: stockStats.unlistedCount > 0 ? `${stockStats.unlistedCount}件の未出品在庫があります` : '未出品在庫はありません'
    })

    // 滞留在庫があれば
    if (staleStockCount > 0) {
      actions.push({
        label: '滞留在庫を確認する',
        count: staleStockCount,
        href: '/?quickFilter=stale90',
        color: 'bg-red-500 hover:bg-red-600',
        description: `${staleStockCount}件の滞留在庫（90日以上）があります`
      })
    }

    // 未販売（売却日が空のもの）
    actions.push({
      label: '未販売の在庫を確認する',
      count: stockStats.unsoldCount,
      href: '/?quickFilter=unsold',
      color: 'bg-blue-500 hover:bg-blue-600',
      description: stockStats.unsoldCount > 0 ? `現在${stockStats.unsoldCount}件の未販売在庫があります` : '未販売在庫はありません'
    })

    // 今月の販売データ
    actions.push({
      label: '今月の販売データを見る',
      count: monthlyStats.salesCount,
      href: '/summary/all',
      color: 'bg-green-500 hover:bg-green-600',
      description: `今月${monthlyStats.salesCount}件販売`
    })

    return actions
  }, [stockStats, staleStock, monthlyStats])

  // 日付文字列をパースするヘルパー関数
  const parseDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null

    // YYYY-MM-DD形式
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr)
    }

    // YYYY/MM/DD形式
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
      return new Date(dateStr.replace(/\//g, '-'))
    }

    // YYYY年MM月DD日形式
    const jpMatch = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
    if (jpMatch) {
      return new Date(`${jpMatch[1]}-${jpMatch[2].padStart(2, '0')}-${jpMatch[3].padStart(2, '0')}`)
    }

    // その他の形式はそのままパース
    const parsed = new Date(dateStr)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  // 最近売れた商品（直近10件）- 在庫テーブル + 手入力売上を統合
  const recentSales = useMemo(() => {
    // 在庫テーブルの売却済みを統一形式に変換
    const inventorySalesItems = inventory
      .filter(item => item.status === '売却済み' && item.sale_date && parseDate(item.sale_date))
      .map(item => ({
        id: item.id,
        product_name: item.product_name,
        brand_name: item.brand_name,
        sale_date: item.sale_date,
        sale_type: item.sale_type,
        sale_amount: item.sale_price || 0,
        // DBに保存されている利益を直接使用
        profit: item.profit || 0,
        source: 'inventory' as const
      }))

    // 手入力売上を統一形式に変換
    const manualSalesItems = manualSales
      .filter(item => item.sale_date && parseDate(item.sale_date))
      .map(item => ({
        id: item.id,
        product_name: item.product_name,
        brand_name: item.brand_name,
        sale_date: item.sale_date,
        sale_type: item.sale_type,
        sale_amount: item.sale_price || 0,
        profit: item.profit || 0,
        source: 'manual' as const
      }))

    // 統合してソート
    return [...inventorySalesItems, ...manualSalesItems]
      .sort((a, b) => {
        const dateA = parseDate(a.sale_date)
        const dateB = parseDate(b.sale_date)
        if (!dateA || !dateB) return 0
        return dateB.getTime() - dateA.getTime()
      })
      .slice(0, 10)
  }, [inventory, manualSales])

  // 最近仕入れた商品（直近10件）
  const recentPurchases = useMemo(() => {
    return inventory
      .filter(item => item.purchase_date && parseDate(item.purchase_date))
      .sort((a, b) => {
        const dateA = parseDate(a.purchase_date)
        const dateB = parseDate(b.purchase_date)
        if (!dateA || !dateB) return 0
        return dateB.getTime() - dateA.getTime()
      })
      .slice(0, 10)
  }, [inventory])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl md:text-2xl font-light tracking-widest text-amber-200/90 mb-6 md:mb-8 uppercase">Dashboard</h1>

        {/* 今月のサマリー */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 md:p-8 mb-5 md:mb-8 backdrop-blur">
          <h2 className="text-sm md:text-base font-light tracking-wider text-slate-300 mb-6 uppercase">{currentMonth.label}のサマリー</h2>

          {/* 本日の売上 */}
          <div className="bg-gradient-to-r from-amber-900/40 to-yellow-900/30 rounded-xl p-5 md:p-6 mb-5 md:mb-8 border border-amber-700/30">
            <div className="text-xs font-medium tracking-widest text-amber-400/80 mb-3 uppercase">Today&apos;s Sales</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] tracking-wider text-amber-300/50 uppercase mb-1">販売件数</div>
                <div className="text-xl md:text-3xl font-extralight text-amber-100 tabular-nums">{todayStats.salesCount}<span className="text-sm ml-0.5">件</span></div>
              </div>
              <div>
                <div className="text-[10px] tracking-wider text-amber-300/50 uppercase mb-1">売上</div>
                <div className="text-xl md:text-3xl font-extralight text-amber-100 tabular-nums">¥{todayStats.salesTotal.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] tracking-wider text-amber-300/50 uppercase mb-1">利益</div>
                <div className={`text-xl md:text-3xl font-extralight tabular-nums ${todayStats.profit >= 0 ? 'text-amber-100' : 'text-rose-300'}`}>
                  ¥{todayStats.profit.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* 今月の指標 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4 mb-5 md:mb-8">
            <div className="bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-700/40 border-b-2 border-b-emerald-500/40">
              <div className="text-[10px] tracking-wider text-slate-500 uppercase mb-1">販売件数</div>
              <div className="text-lg md:text-2xl font-light text-slate-100 tabular-nums">{monthlyStats.salesCount}<span className="text-xs ml-0.5 text-slate-400">件</span></div>
            </div>
            <div className="bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-700/40 border-b-2 border-b-emerald-500/40">
              <div className="text-[10px] tracking-wider text-slate-500 uppercase mb-1">売上総額</div>
              <div className="text-lg md:text-2xl font-light text-slate-100 tabular-nums">¥{monthlyStats.salesTotal.toLocaleString()}</div>
            </div>
            <div className={`bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-700/40 border-b-2 ${monthlyStats.profit >= 0 ? 'border-b-amber-500/50' : 'border-b-rose-500/50'}`}>
              <div className={`text-[10px] tracking-wider uppercase mb-1 ${monthlyStats.profit >= 0 ? 'text-slate-500' : 'text-rose-400/70'}`}>利益</div>
              <div className={`text-lg md:text-2xl font-light tabular-nums ${monthlyStats.profit >= 0 ? 'text-amber-200' : 'text-rose-300'}`}>
                ¥{monthlyStats.profit.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-700/40 border-b-2 border-b-violet-500/40">
              <div className="text-[10px] tracking-wider text-slate-500 uppercase mb-1">ROI</div>
              <div className="text-lg md:text-2xl font-light text-slate-100 tabular-nums">{monthlyStats.roi.toFixed(1)}<span className="text-xs ml-0.5 text-slate-400">%</span></div>
            </div>
            <div className="bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-700/40 border-b-2 border-b-sky-500/40">
              <div className="text-[10px] tracking-wider text-slate-500 uppercase mb-1">仕入件数</div>
              <div className="text-lg md:text-2xl font-light text-slate-100 tabular-nums">{monthlyStats.purchaseCount}<span className="text-xs ml-0.5 text-slate-400">件</span></div>
            </div>
            <div className="bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-700/40 border-b-2 border-b-sky-500/40">
              <div className="text-[10px] tracking-wider text-slate-500 uppercase mb-1">仕入総額</div>
              <div className="text-lg md:text-2xl font-light text-slate-100 tabular-nums">¥{monthlyStats.purchaseTotal.toLocaleString()}</div>
            </div>
          </div>

          {/* 小売・業販内訳 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-4 bg-slate-800/60 border border-slate-700/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-200 font-light tracking-wide flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block"></span>
                  小売
                </span>
                <span className="text-[10px] tracking-wider text-slate-500 bg-slate-700/50 px-2.5 py-1 rounded-full">{monthlyStats.retailCount}件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">売上: ¥{monthlyStats.retailTotal.toLocaleString()}</span>
                <span className={monthlyStats.retailProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  利益: ¥{monthlyStats.retailProfit.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="rounded-xl p-4 bg-slate-800/60 border border-slate-700/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-200 font-light tracking-wide flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
                  業販
                </span>
                <span className="text-[10px] tracking-wider text-slate-500 bg-slate-700/50 px-2.5 py-1 rounded-full">{monthlyStats.wholesaleCount}件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">売上: ¥{monthlyStats.wholesaleTotal.toLocaleString()}</span>
                <span className={monthlyStats.wholesaleProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  利益: ¥{monthlyStats.wholesaleProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* クイックアクション & ToDo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8 mb-5 md:mb-8">
          {/* クイックアクション */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 md:p-8 backdrop-blur">
            <h2 className="text-sm font-light tracking-wider text-slate-300 mb-5 uppercase">Quick Actions</h2>
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <Link
                  key={index}
                  href={action.href}
                  className="block p-4 rounded-xl bg-slate-700/30 border border-slate-600/30 text-slate-200 transition-all duration-300 hover:bg-slate-700/60 hover:border-amber-600/30 hover:shadow-lg hover:shadow-amber-900/10 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-light tracking-wide">{action.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{action.description}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-extralight text-amber-300/80 tabular-nums">{action.count}</div>
                      <svg className="w-4 h-4 text-slate-600 group-hover:text-amber-400/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ユーザーToDo */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 md:p-8 backdrop-blur">
            <h2 className="text-sm font-light tracking-wider text-slate-300 mb-5 uppercase">To Do</h2>

            {/* 新規追加 */}
            <div className="flex gap-2 mb-5">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyDown={(e) => {
                  // IME入力中（変換確定のEnter）は無視
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    addTodo()
                  }
                }}
                placeholder="新しいタスクを追加..."
                className="flex-1 px-4 py-2.5 bg-slate-700/30 border border-slate-600/30 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-600/40 focus:ring-1 focus:ring-amber-600/20 transition-colors"
              />
              <button
                onClick={addTodo}
                disabled={!newTodoText.trim()}
                className="px-5 py-2.5 bg-amber-700/30 text-amber-300 border border-amber-600/30 rounded-xl text-sm hover:bg-amber-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all tracking-wide"
              >
                追加
              </button>
            </div>

            {/* ToDoリスト */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {todos.length === 0 ? (
                <div className="text-center py-8 text-slate-600 font-light">
                  タスクがありません
                </div>
              ) : (
                todos.map(todo => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      todo.completed ? 'bg-slate-800/30 border-slate-700/20' : 'bg-slate-700/20 border-slate-600/30 hover:border-slate-500/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700/50 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className={`flex-1 text-sm transition-colors ${
                      todo.completed ? 'text-slate-600 line-through decoration-slate-700' : 'text-slate-300 font-light'
                    }`}>
                      {todo.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="text-slate-700 hover:text-rose-400 text-xs transition-colors tracking-wide"
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 完了済みを一括削除 */}
            {todos.some(t => t.completed) && (
              <button
                onClick={() => setTodos(todos.filter(t => !t.completed))}
                className="mt-4 text-xs text-slate-600 hover:text-rose-400 transition-colors tracking-wide"
              >
                完了済みを削除
              </button>
            )}
          </div>
        </div>

        {/* 在庫状況 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8 mb-5 md:mb-8">
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 md:p-8 backdrop-blur">
            <h2 className="text-sm font-light tracking-wider text-slate-300 mb-5 uppercase">在庫状況</h2>
            <div className="space-y-1">
              <div className="flex justify-between items-center py-3 border-b border-slate-700/30">
                <span className="text-slate-400 text-sm font-light">在庫数</span>
                <div className="text-right">
                  <span className="text-slate-200 tabular-nums">{stockStats.unsoldCount}<span className="text-xs text-slate-500 ml-0.5">件</span></span>
                  <span className="text-sm text-slate-500 ml-3 tabular-nums">¥{stockStats.unsoldValue.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-700/30">
                <span className="text-slate-400 text-sm font-light">出品中</span>
                <div className="text-right">
                  <span className="text-slate-200 tabular-nums">{stockStats.listedCount}<span className="text-xs text-slate-500 ml-0.5">件</span></span>
                  <span className="text-sm text-slate-500 ml-3 tabular-nums">¥{stockStats.listedValue.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-700/30">
                <span className="text-slate-400 text-sm font-light">売却済（累計）</span>
                <div className="text-right">
                  <span className="text-slate-200 tabular-nums">{stockStats.soldCount}<span className="text-xs text-slate-500 ml-0.5">件</span></span>
                </div>
              </div>
              <Link
                href="/?status=未出品"
                className="flex justify-between items-center py-3 -mx-3 px-3 rounded-lg hover:bg-amber-900/10 transition-all group"
              >
                <span className="text-amber-400/80 text-sm font-light group-hover:text-amber-300 transition-colors">未出品</span>
                <div className="text-right">
                  <span className="text-amber-300/80 tabular-nums">{stockStats.unlistedCount}<span className="text-xs text-amber-400/40 ml-0.5">件</span></span>
                  <span className="text-sm text-amber-400/40 ml-3 tabular-nums">¥{stockStats.unlistedValue.toLocaleString()}</span>
                </div>
              </Link>
              <div className="flex justify-between items-center pt-4 border-t border-slate-600/40">
                <span className="text-slate-300 text-sm">在庫総額（原価）</span>
                <span className="text-lg font-light text-slate-100 tabular-nums">¥{stockStats.totalStockValueCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-300 text-sm">在庫総額（仕入総額）</span>
                <span className="text-lg font-light text-amber-200/80 tabular-nums">¥{stockStats.totalStockValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 滞留在庫アラート */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 md:p-8 backdrop-blur">
            <h2 className="text-sm font-light tracking-wider text-slate-300 mb-5 uppercase flex items-center gap-3">
              滞留在庫（90日以上）
              {staleStockCount > 0 && (
                <span className="text-[10px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full tracking-wider">{staleStockCount}件</span>
              )}
            </h2>
            {staleStock.length === 0 ? (
              <div className="text-center py-8 text-slate-600 font-light">
                滞留在庫はありません
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {staleStock.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-slate-700/30 text-sm hover:bg-slate-700/20 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 font-light truncate">{item.product_name || '名称未設定'}</div>
                      <div className="text-slate-600 text-xs">{item.brand_name || '-'}</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-rose-400 tabular-nums">{item.staleDays}<span className="text-xs text-rose-400/50 ml-0.5">日</span></div>
                      <div className="text-slate-600 text-xs tabular-nums">¥{(item.purchase_total || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 最近のアクティビティ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8">
          {/* 最近売れた商品 */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 md:p-8 backdrop-blur">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-light tracking-wider text-slate-300 uppercase">最近売れた商品</h2>
              <Link href="/summary/all" className="text-xs text-amber-500/60 hover:text-amber-400 transition-colors tracking-wider">
                すべて見る →
              </Link>
            </div>
            {recentSales.length === 0 ? (
              <div className="text-center py-8 text-slate-600 font-light">
                販売履歴がありません
              </div>
            ) : (
              <div className="space-y-1">
                {recentSales.map(item => (
                  <div key={`${item.source}-${item.id}`} className="flex items-center justify-between py-2.5 border-b border-slate-700/30 text-sm hover:bg-slate-700/20 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 font-light truncate">
                        {item.product_name || '名称未設定'}
                        {item.source === 'manual' && <span className="ml-1.5 text-[10px] text-violet-400/60 tracking-wider">(手入力)</span>}
                      </div>
                      <div className="text-slate-600 text-xs mt-0.5">
                        {item.sale_date} / {item.sale_type || '-'}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-slate-200 font-light tabular-nums">¥{item.sale_amount.toLocaleString()}</div>
                      <div className={`text-xs tabular-nums ${item.profit >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                        利益: ¥{item.profit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 最近仕入れた商品 */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 md:p-8 backdrop-blur">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-light tracking-wider text-slate-300 uppercase">最近仕入れた商品</h2>
              <Link href="/" className="text-xs text-amber-500/60 hover:text-amber-400 transition-colors tracking-wider">
                在庫一覧へ →
              </Link>
            </div>
            {recentPurchases.length === 0 ? (
              <div className="text-center py-8 text-slate-600 font-light">
                仕入れ履歴がありません
              </div>
            ) : (
              <div className="space-y-1">
                {recentPurchases.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-slate-700/30 text-sm hover:bg-slate-700/20 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 font-light truncate">{item.product_name || '名称未設定'}</div>
                      <div className="text-slate-600 text-xs mt-0.5">
                        {item.purchase_date} / {item.brand_name || '-'}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-slate-200 font-light tabular-nums">¥{(item.purchase_total || 0).toLocaleString()}</div>
                      <div className={`text-xs ${
                        item.status === '売却済み' ? 'text-emerald-400/70' :
                        item.status === '出品中' ? 'text-sky-400/70' : 'text-slate-600'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
