'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Navigation from '@/components/Navigation'

type ManualSale = {
  id: string
  inventory_number: string | null
  product_name: string
  brand_name: string | null
  category: string | null
  purchase_price: number | null
  purchase_total: number | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  other_cost: number | null
  deposit_amount: number | null
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  purchase_source: string | null
  sale_destination: string | null
  memo: string | null
  profit: number | null
  profit_rate: number | null
  turnover_days: number | null
  sale_type: 'main' | 'bulk'
  created_at: string
}

type Platform = {
  id: string
  name: string
  type: 'purchase' | 'sale'
}

export default function ManualSalesPage() {
  const { user, loading: authLoading } = useAuth()
  const [sales, setSales] = useState<ManualSale[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<ManualSale>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [newSale, setNewSale] = useState<Partial<ManualSale>>({
    sale_type: 'main'
  })
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'main' | 'bulk'>('all')

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      // 手入力売上データ取得
      let allSales: ManualSale[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_sales')
          .select('*')
          .range(from, from + pageSize - 1)
          .order('sale_date', { ascending: false })

        if (error) {
          console.error('Error fetching manual sales:', error)
          break
        }

        if (data && data.length > 0) {
          allSales = [...allSales, ...data]
          from += pageSize
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }
      setSales(allSales)

      // プラットフォーム取得
      const { data: platformData } = await supabase
        .from('platforms')
        .select('*')
      if (platformData) {
        setPlatforms(platformData)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  // 日付の正規化
  const normalizeDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null
    return dateStr.replace(/\//g, '-')
  }

  // 日付が有効かチェック
  const isValidDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false
    const normalized = normalizeDate(dateStr)
    if (!normalized) return false
    const date = new Date(normalized)
    return !isNaN(date.getTime())
  }

  // 年を抽出
  const extractYear = (dateStr: string | null): number | null => {
    if (!isValidDate(dateStr)) return null
    const normalized = normalizeDate(dateStr)
    if (!normalized) return null
    const date = new Date(normalized)
    return date.getFullYear()
  }

  // 月を抽出
  const extractMonth = (dateStr: string | null): number | null => {
    if (!isValidDate(dateStr)) return null
    const normalized = normalizeDate(dateStr)
    if (!normalized) return null
    const date = new Date(normalized)
    return date.getMonth() + 1
  }

  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    sales.forEach(sale => {
      const year = extractYear(sale.sale_date)
      if (year) years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [sales])

  // フィルタリング
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // 年フィルター
      if (selectedYear && selectedYear !== '') {
        const saleYear = extractYear(sale.sale_date)
        if (saleYear !== parseInt(selectedYear)) return false
      }
      // 月フィルター
      if (selectedMonth && selectedMonth !== '') {
        const saleMonth = extractMonth(sale.sale_date)
        if (saleMonth !== parseInt(selectedMonth)) return false
      }
      // タイプフィルター
      if (saleTypeFilter !== 'all' && sale.sale_type !== saleTypeFilter) {
        return false
      }
      return true
    })
  }, [sales, selectedYear, selectedMonth, saleTypeFilter])

  // 利益計算
  const calculateProfit = (sale: Partial<ManualSale>): number => {
    const salePrice = sale.sale_price || 0
    const purchaseTotal = sale.purchase_total || sale.purchase_price || 0
    const commission = sale.commission || 0
    const shippingCost = sale.shipping_cost || 0
    const otherCost = sale.other_cost || 0
    return salePrice - purchaseTotal - commission - shippingCost - otherCost
  }

  // 利益率計算
  const calculateProfitRate = (sale: Partial<ManualSale>): number => {
    const salePrice = sale.sale_price || 0
    if (salePrice === 0) return 0
    const profit = calculateProfit(sale)
    return Math.round((profit / salePrice) * 100 * 10) / 10
  }

  // 回転日数計算
  const calculateTurnoverDays = (sale: Partial<ManualSale>): number | null => {
    if (!sale.listing_date || !sale.sale_date) return null
    if (!isValidDate(sale.listing_date) || !isValidDate(sale.sale_date)) return null
    const listingDate = new Date(normalizeDate(sale.listing_date)!)
    const saleDate = new Date(normalizeDate(sale.sale_date)!)
    const diffTime = saleDate.getTime() - listingDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= 0 ? diffDays : null
  }

  // 新規追加
  const handleAdd = async () => {
    if (!newSale.product_name) {
      alert('商品名は必須です')
      return
    }

    const profit = calculateProfit(newSale)
    const profitRate = calculateProfitRate(newSale)
    const turnoverDays = calculateTurnoverDays(newSale)

    const { data, error } = await supabase
      .from('manual_sales')
      .insert([{
        ...newSale,
        profit,
        profit_rate: profitRate,
        turnover_days: turnoverDays,
        purchase_date: normalizeDate(newSale.purchase_date || null),
        listing_date: normalizeDate(newSale.listing_date || null),
        sale_date: normalizeDate(newSale.sale_date || null),
      }])
      .select()

    if (error) {
      console.error('Error adding sale:', error)
      alert('追加に失敗しました: ' + error.message)
      return
    }

    if (data) {
      setSales([data[0], ...sales])
      setNewSale({ sale_type: 'main' })
      setIsAdding(false)
    }
  }

  // 編集開始
  const handleEditStart = (sale: ManualSale) => {
    setEditingId(sale.id)
    setEditData(sale)
  }

  // 編集保存
  const handleEditSave = async () => {
    if (!editingId) return

    const profit = calculateProfit(editData)
    const profitRate = calculateProfitRate(editData)
    const turnoverDays = calculateTurnoverDays(editData)

    const { error } = await supabase
      .from('manual_sales')
      .update({
        ...editData,
        profit,
        profit_rate: profitRate,
        turnover_days: turnoverDays,
        purchase_date: normalizeDate(editData.purchase_date || null),
        listing_date: normalizeDate(editData.listing_date || null),
        sale_date: normalizeDate(editData.sale_date || null),
      })
      .eq('id', editingId)

    if (error) {
      console.error('Error updating sale:', error)
      alert('更新に失敗しました')
      return
    }

    setSales(sales.map(s => s.id === editingId ? { ...s, ...editData, profit, profit_rate: profitRate, turnover_days: turnoverDays } : s))
    setEditingId(null)
    setEditData({})
  }

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm('この売上データを削除しますか？')) return

    const { error } = await supabase
      .from('manual_sales')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting sale:', error)
      alert('削除に失敗しました')
      return
    }

    setSales(sales.filter(s => s.id !== id))
  }

  // 集計
  const summary = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + (s.sale_price || 0), 0)
    const totalPurchase = filteredSales.reduce((sum, s) => sum + (s.purchase_total || s.purchase_price || 0), 0)
    const totalProfit = filteredSales.reduce((sum, s) => sum + (s.profit || 0), 0)
    const avgProfitRate = filteredSales.length > 0
      ? Math.round(filteredSales.reduce((sum, s) => sum + (s.profit_rate || 0), 0) / filteredSales.length * 10) / 10
      : 0
    return { totalSales, totalPurchase, totalProfit, avgProfitRate, count: filteredSales.length }
  }, [filteredSales])

  const purchasePlatforms = platforms.filter(p => p.type === 'purchase')
  const salePlatforms = platforms.filter(p => p.type === 'sale')

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Navigation />
        <div className="pt-14 flex items-center justify-center min-h-screen">
          <div className="text-white">読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Navigation />
        <div className="pt-14 flex items-center justify-center min-h-screen">
          <div className="text-white">ログインしてください</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navigation />
      <div className="pt-14 px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">手入力売上表</h1>
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            新規追加
          </button>
        </div>

        {/* フィルター */}
        <div className="flex items-center gap-4 mb-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 bg-slate-800 text-white border border-slate-600 rounded"
          >
            <option value="">全年</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-slate-800 text-white border border-slate-600 rounded"
          >
            <option value="">全月</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
              <option key={month} value={month}>{month}月</option>
            ))}
          </select>
        </div>

        {/* 集計 */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">件数</div>
            <div className="text-white text-xl font-bold">{summary.count}件</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">売上合計</div>
            <div className="text-white text-xl font-bold">¥{summary.totalSales.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">仕入合計</div>
            <div className="text-white text-xl font-bold">¥{summary.totalPurchase.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">利益合計</div>
            <div className={`text-xl font-bold ${summary.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ¥{summary.totalProfit.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">平均利益率</div>
            <div className={`text-xl font-bold ${summary.avgProfitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.avgProfitRate}%
            </div>
          </div>
        </div>

        {/* 新規追加フォーム */}
        {isAdding && (
          <div className="bg-slate-800 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-bold text-white mb-4">新規売上追加</h2>
            <div className="grid grid-cols-6 gap-4">
              <div>
                <label className="text-slate-400 text-sm">管理番号</label>
                <input
                  type="text"
                  value={newSale.inventory_number || ''}
                  onChange={(e) => setNewSale({ ...newSale, inventory_number: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-sm">商品名 *</label>
                <input
                  type="text"
                  value={newSale.product_name || ''}
                  onChange={(e) => setNewSale({ ...newSale, product_name: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">ブランド</label>
                <input
                  type="text"
                  value={newSale.brand_name || ''}
                  onChange={(e) => setNewSale({ ...newSale, brand_name: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">カテゴリ</label>
                <input
                  type="text"
                  value={newSale.category || ''}
                  onChange={(e) => setNewSale({ ...newSale, category: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">仕入原価</label>
                <input
                  type="number"
                  value={newSale.purchase_price || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_price: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">仕入合計</label>
                <input
                  type="number"
                  value={newSale.purchase_total || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_total: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">売価</label>
                <input
                  type="number"
                  value={newSale.sale_price || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_price: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">手数料</label>
                <input
                  type="number"
                  value={newSale.commission || ''}
                  onChange={(e) => setNewSale({ ...newSale, commission: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">送料</label>
                <input
                  type="number"
                  value={newSale.shipping_cost || ''}
                  onChange={(e) => setNewSale({ ...newSale, shipping_cost: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">その他経費</label>
                <input
                  type="number"
                  value={newSale.other_cost || ''}
                  onChange={(e) => setNewSale({ ...newSale, other_cost: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">入金額</label>
                <input
                  type="number"
                  value={newSale.deposit_amount || ''}
                  onChange={(e) => setNewSale({ ...newSale, deposit_amount: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">仕入日</label>
                <input
                  type="date"
                  value={newSale.purchase_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_date: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">出品日</label>
                <input
                  type="date"
                  value={newSale.listing_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, listing_date: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">販売日</label>
                <input
                  type="date"
                  value={newSale.sale_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_date: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">仕入先</label>
                <select
                  value={newSale.purchase_source || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_source: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                >
                  <option value="">選択</option>
                  {purchasePlatforms.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm">販路</label>
                <select
                  value={newSale.sale_destination || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_destination: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                >
                  <option value="">選択</option>
                  {salePlatforms.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-sm">メモ</label>
                <input
                  type="text"
                  value={newSale.memo || ''}
                  onChange={(e) => setNewSale({ ...newSale, memo: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                追加
              </button>
              <button
                onClick={() => {
                  setIsAdding(false)
                  setNewSale({ sale_type: 'main' })
                }}
                className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-700">
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">No</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">管理番号</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">画像</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">ジャンル</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">ブランド名</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">商品名</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">仕入先</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">販売先</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">売価</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">手数料</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">送料</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">その他</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">原価</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">仕入総額</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">入金額</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">利益</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">利益率</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">仕入日</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">出品日</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">売却日</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">回転日数</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-800">
                  {editingId === sale.id ? (
                    // 編集モード
                    <>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {filteredSales.indexOf(sale) + 1}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="text"
                          value={editData.inventory_number || ''}
                          onChange={(e) => setEditData({ ...editData, inventory_number: e.target.value })}
                          className="w-full px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        -
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="text"
                          value={editData.category || ''}
                          onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                          className="w-full px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="text"
                          value={editData.brand_name || ''}
                          onChange={(e) => setEditData({ ...editData, brand_name: e.target.value })}
                          className="w-full px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="text"
                          value={editData.product_name || ''}
                          onChange={(e) => setEditData({ ...editData, product_name: e.target.value })}
                          className="w-full px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <select
                          value={editData.purchase_source || ''}
                          onChange={(e) => setEditData({ ...editData, purchase_source: e.target.value })}
                          className="w-full px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        >
                          <option value="">選択</option>
                          {purchasePlatforms.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <select
                          value={editData.sale_destination || ''}
                          onChange={(e) => setEditData({ ...editData, sale_destination: e.target.value })}
                          className="w-full px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        >
                          <option value="">選択</option>
                          {salePlatforms.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="number"
                          value={editData.sale_price || ''}
                          onChange={(e) => setEditData({ ...editData, sale_price: parseInt(e.target.value) || null })}
                          className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="number"
                          value={editData.commission || ''}
                          onChange={(e) => setEditData({ ...editData, commission: parseInt(e.target.value) || null })}
                          className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="number"
                          value={editData.shipping_cost || ''}
                          onChange={(e) => setEditData({ ...editData, shipping_cost: parseInt(e.target.value) || null })}
                          className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="number"
                          value={editData.other_cost || ''}
                          onChange={(e) => setEditData({ ...editData, other_cost: parseInt(e.target.value) || null })}
                          className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="number"
                          value={editData.purchase_price || ''}
                          onChange={(e) => setEditData({ ...editData, purchase_price: parseInt(e.target.value) || null })}
                          className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="number"
                          value={editData.purchase_total || ''}
                          onChange={(e) => setEditData({ ...editData, purchase_total: parseInt(e.target.value) || null })}
                          className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="number"
                          value={editData.deposit_amount || ''}
                          onChange={(e) => setEditData({ ...editData, deposit_amount: parseInt(e.target.value) || null })}
                          className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {calculateProfit(editData).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {calculateProfitRate(editData)}%
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="date"
                          value={editData.purchase_date || ''}
                          onChange={(e) => setEditData({ ...editData, purchase_date: e.target.value })}
                          className="px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="date"
                          value={editData.listing_date || ''}
                          onChange={(e) => setEditData({ ...editData, listing_date: e.target.value })}
                          className="px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600">
                        <input
                          type="date"
                          value={editData.sale_date || ''}
                          onChange={(e) => setEditData({ ...editData, sale_date: e.target.value })}
                          className="px-1 py-0.5 bg-slate-700 text-white border border-slate-600 rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {calculateTurnoverDays(editData) ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        <button
                          onClick={handleEditSave}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 mr-1"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditData({})
                          }}
                          className="px-2 py-1 bg-slate-600 text-white rounded text-xs hover:bg-slate-500"
                        >
                          取消
                        </button>
                      </td>
                    </>
                  ) : (
                    // 表示モード
                    <>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {filteredSales.indexOf(sale) + 1}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.inventory_number || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        -
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.category || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.brand_name || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.product_name}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.purchase_source || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.sale_destination || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.sale_price?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.commission?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.shipping_cost?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.other_cost?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.purchase_price?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.purchase_total?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.deposit_amount?.toLocaleString() || '-'}
                      </td>
                      <td className={`px-3 py-2 text-center text-sm border border-slate-600 whitespace-nowrap ${(sale.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {sale.profit?.toLocaleString() || '-'}
                      </td>
                      <td className={`px-3 py-2 text-center text-sm border border-slate-600 whitespace-nowrap ${(sale.profit_rate || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {sale.profit_rate != null ? `${sale.profit_rate}%` : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.purchase_date || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.listing_date || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.sale_date || '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        {sale.turnover_days ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                        <button
                          onClick={() => handleEditStart(sale)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 mr-1"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          削除
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center text-slate-400 py-8">
            データがありません
          </div>
        )}
      </div>
    </div>
  )
}
