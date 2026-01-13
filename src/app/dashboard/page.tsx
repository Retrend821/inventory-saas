'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
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
  deposit_amount: number | null
  other_cost: number | null
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

export default function DashboardPage() {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [manualSales, setManualSales] = useState<ManualSale[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
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

      // プラットフォームデータを取得
      const { data: platformsData } = await supabase
        .from('platforms')
        .select('id, name, sales_type')

      setInventory(allInventory)
      setManualSales(allManualSales)
      setPlatforms(platformsData || [])
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

    // 今月の販売（在庫テーブル）
    const inventorySales = inventory.filter(item => isThisMonth(item.sale_date) && item.status === '売却済み')
    const inventorySalesCount = inventorySales.length
    const inventorySalesTotal = inventorySales.reduce((sum, item) => sum + (item.sale_price || 0), 0)
    const inventorySalesCost = inventorySales.reduce((sum, item) => sum + (item.purchase_total || 0) + (item.other_cost || 0), 0)
    const inventoryProfit = inventorySales.reduce((sum, item) => sum + (item.deposit_amount || 0), 0) - inventorySalesCost

    // 今月の販売（手入力売上）
    const manualSalesThisMonth = manualSales.filter(item => isThisMonth(item.sale_date))
    const manualSalesCount = manualSalesThisMonth.length
    const manualSalesTotal = manualSalesThisMonth.reduce((sum, item) => sum + (item.sale_price || 0), 0)
    const manualSalesProfit = manualSalesThisMonth.reduce((sum, item) => sum + (item.profit || 0), 0)

    // 合計
    const salesCount = inventorySalesCount + manualSalesCount
    const salesTotal = inventorySalesTotal + manualSalesTotal
    const salesCost = inventorySalesCost + manualSalesThisMonth.reduce((sum, item) => sum + (item.purchase_total || 0), 0)
    const profit = inventoryProfit + manualSalesProfit
    const profitRate = salesTotal > 0 ? (profit / salesTotal) * 100 : 0
    const roi = salesCost > 0 ? (profit / salesCost) * 100 : 0

    // 小売（toC）・業販（toB）の販路名リスト
    const retailPlatformNames = platforms.filter(p => p.sales_type === 'toC').map(p => p.name)
    const wholesalePlatformNames = platforms.filter(p => p.sales_type === 'toB').map(p => p.name)

    // 小売・業販の内訳（在庫テーブル）- sale_destinationで判定
    const retailSalesInv = inventorySales.filter(item =>
      item.sale_destination && retailPlatformNames.includes(item.sale_destination)
    )
    const wholesaleSalesInv = inventorySales.filter(item =>
      item.sale_destination && wholesalePlatformNames.includes(item.sale_destination)
    )

    // 小売・業販の内訳（手入力売上）- sale_destinationで判定
    const retailSalesManual = manualSalesThisMonth.filter(item =>
      item.sale_destination && retailPlatformNames.includes(item.sale_destination)
    )
    const wholesaleSalesManual = manualSalesThisMonth.filter(item =>
      item.sale_destination && wholesalePlatformNames.includes(item.sale_destination)
    )

    const retailTotal = retailSalesInv.reduce((sum, item) => sum + (item.sale_price || 0), 0)
      + retailSalesManual.reduce((sum, item) => sum + (item.sale_price || 0), 0)
    const wholesaleTotal = wholesaleSalesInv.reduce((sum, item) => sum + (item.sale_price || 0), 0)
      + wholesaleSalesManual.reduce((sum, item) => sum + (item.sale_price || 0), 0)

    const retailProfit = retailSalesInv.reduce((sum, item) => {
      const cost = (item.purchase_total || 0) + (item.other_cost || 0)
      return sum + (item.deposit_amount || 0) - cost
    }, 0) + retailSalesManual.reduce((sum, item) => sum + (item.profit || 0), 0)

    const wholesaleProfit = wholesaleSalesInv.reduce((sum, item) => {
      const cost = (item.purchase_total || 0) + (item.other_cost || 0)
      return sum + (item.deposit_amount || 0) - cost
    }, 0) + wholesaleSalesManual.reduce((sum, item) => sum + (item.profit || 0), 0)

    return {
      purchaseCount,
      purchaseTotal,
      salesCount,
      salesTotal,
      profit,
      profitRate,
      roi,
      retailCount: retailSalesInv.length + retailSalesManual.length,
      retailTotal,
      retailProfit,
      wholesaleCount: wholesaleSalesInv.length + wholesaleSalesManual.length,
      wholesaleTotal,
      wholesaleProfit
    }
  }, [inventory, manualSales, platforms, currentMonth])

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
        profit: (item.deposit_amount || 0) - (item.purchase_total || 0) - (item.other_cost || 0),
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
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">ダッシュボード</h1>

        {/* 今月のサマリー */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-4 md:mb-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">{currentMonth.label}のサマリー</h2>

          {/* メイン指標 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="bg-green-50 rounded-lg p-3 md:p-4">
              <div className="text-xs md:text-sm text-green-600">販売件数</div>
              <div className="text-lg md:text-2xl font-bold text-green-900">{monthlyStats.salesCount}件</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 md:p-4">
              <div className="text-xs md:text-sm text-green-600">売上総額</div>
              <div className="text-lg md:text-2xl font-bold text-green-900">¥{monthlyStats.salesTotal.toLocaleString()}</div>
            </div>
            <div className={`rounded-lg p-3 md:p-4 ${monthlyStats.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className={`text-xs md:text-sm ${monthlyStats.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>利益</div>
              <div className={`text-lg md:text-2xl font-bold ${monthlyStats.profit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                ¥{monthlyStats.profit.toLocaleString()}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 md:p-4">
              <div className="text-xs md:text-sm text-purple-600">ROI</div>
              <div className="text-lg md:text-2xl font-bold text-purple-900">{monthlyStats.roi.toFixed(1)}%</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 md:p-4">
              <div className="text-xs md:text-sm text-blue-600">仕入件数</div>
              <div className="text-lg md:text-2xl font-bold text-blue-900">{monthlyStats.purchaseCount}件</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 md:p-4">
              <div className="text-xs md:text-sm text-blue-600">仕入総額</div>
              <div className="text-lg md:text-2xl font-bold text-blue-900">¥{monthlyStats.purchaseTotal.toLocaleString()}</div>
            </div>
          </div>

          {/* 小売・業販内訳 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">小売</span>
                <span className="text-sm text-gray-500">{monthlyStats.retailCount}件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">売上: ¥{monthlyStats.retailTotal.toLocaleString()}</span>
                <span className={monthlyStats.retailProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  利益: ¥{monthlyStats.retailProfit.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">業販</span>
                <span className="text-sm text-gray-500">{monthlyStats.wholesaleCount}件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">売上: ¥{monthlyStats.wholesaleTotal.toLocaleString()}</span>
                <span className={monthlyStats.wholesaleProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  利益: ¥{monthlyStats.wholesaleProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* クイックアクション & ToDo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* クイックアクション */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">クイックアクション</h2>
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <Link
                  key={index}
                  href={action.href}
                  className={`block p-4 rounded-lg text-white transition-colors ${action.color}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{action.label}</div>
                      <div className="text-sm opacity-90">{action.description}</div>
                    </div>
                    <div className="text-2xl font-bold">{action.count}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ユーザーToDo */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">やることリスト</h2>

            {/* 新規追加 */}
            <div className="flex gap-2 mb-4">
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addTodo}
                disabled={!newTodoText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加
              </button>
            </div>

            {/* ToDoリスト */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {todos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  タスクがありません
                </div>
              ) : (
                todos.map(todo => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      todo.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={`flex-1 text-sm ${
                      todo.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                    }`}>
                      {todo.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="text-gray-400 hover:text-red-500 text-sm"
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
                className="mt-3 text-sm text-gray-500 hover:text-red-500"
              >
                完了済みを削除
              </button>
            )}
          </div>
        </div>

        {/* 在庫状況 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">在庫状況</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">在庫数</span>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{stockStats.unsoldCount}件</span>
                  <span className="text-sm text-gray-500 ml-2">¥{stockStats.unsoldValue.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">出品中</span>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{stockStats.listedCount}件</span>
                  <span className="text-sm text-gray-500 ml-2">¥{stockStats.listedValue.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">売却済（累計）</span>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{stockStats.soldCount}件</span>
                </div>
              </div>
              <Link
                href="/?status=未出品"
                className="flex justify-between items-center py-2 bg-orange-50 -mx-2 px-2 rounded hover:bg-orange-100 transition-colors"
              >
                <span className="text-orange-600 font-medium">未出品</span>
                <div className="text-right">
                  <span className="font-semibold text-orange-900">{stockStats.unlistedCount}件</span>
                  <span className="text-sm text-orange-700 ml-2">¥{stockStats.unlistedValue.toLocaleString()}</span>
                </div>
              </Link>
              <div className="flex justify-between items-center pt-2 border-t-2">
                <span className="font-medium text-gray-900">在庫総額（原価）</span>
                <span className="font-bold text-lg text-gray-900">¥{stockStats.totalStockValueCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-medium text-gray-900">在庫総額（仕入総額）</span>
                <span className="font-bold text-lg text-blue-700">¥{stockStats.totalStockValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 滞留在庫アラート */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              滞留在庫（90日以上）
              {staleStockCount > 0 && (
                <span className="ml-2 text-sm font-normal text-red-600">{staleStockCount}件</span>
              )}
            </h2>
            {staleStock.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                滞留在庫はありません
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {staleStock.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{item.product_name || '名称未設定'}</div>
                      <div className="text-gray-500 text-xs">{item.brand_name || '-'}</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-red-600 font-medium">{item.staleDays}日</div>
                      <div className="text-gray-500 text-xs">¥{(item.purchase_total || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 最近のアクティビティ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 最近売れた商品 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">最近売れた商品</h2>
              <Link href="/summary/all" className="text-sm text-blue-600 hover:text-blue-800">
                すべて見る →
              </Link>
            </div>
            {recentSales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                販売履歴がありません
              </div>
            ) : (
              <div className="space-y-2">
                {recentSales.map(item => (
                  <div key={`${item.source}-${item.id}`} className="flex items-center justify-between py-2 border-b text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {item.product_name || '名称未設定'}
                        {item.source === 'manual' && <span className="ml-1 text-xs text-purple-500">(手入力)</span>}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {item.sale_date} / {item.sale_type || '-'}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-gray-900">¥{item.sale_amount.toLocaleString()}</div>
                      <div className={`text-xs ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        利益: ¥{item.profit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 最近仕入れた商品 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">最近仕入れた商品</h2>
              <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
                在庫一覧へ →
              </Link>
            </div>
            {recentPurchases.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                仕入れ履歴がありません
              </div>
            ) : (
              <div className="space-y-2">
                {recentPurchases.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{item.product_name || '名称未設定'}</div>
                      <div className="text-gray-500 text-xs">
                        {item.purchase_date} / {item.brand_name || '-'}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-gray-900">¥{(item.purchase_total || 0).toLocaleString()}</div>
                      <div className={`text-xs ${
                        item.status === '売却済み' ? 'text-green-600' :
                        item.status === '出品中' ? 'text-blue-600' : 'text-gray-500'
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
