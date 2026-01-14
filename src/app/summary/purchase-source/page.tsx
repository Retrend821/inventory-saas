'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type InventoryItem = {
  id: string
  purchase_source: string | null
  purchase_date: string | null
  sale_date: string | null
  purchase_total: number | null
  deposit_amount: number | null
  other_cost: number | null
  status: string
}

type SourceStats = {
  source: string
  purchaseCount: number
  soldCount: number
  totalPurchase: number
  totalSales: number
  totalProfit: number
  profitRate: number
  roi: number // 投資利益率
}

export default function PurchaseSourcePage() {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    const fetchData = async () => {
      // 全件取得するためにページネーションで取得
      let allInventory: InventoryItem[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('inventory')
          .select('id, purchase_source, purchase_date, sale_date, purchase_total, deposit_amount, other_cost, status')
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
      setLoading(false)
    }

    if (user) {
      fetchData()
    }
  }, [user])

  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    // 現在の年を必ず含める
    years.add(new Date().getFullYear())
    inventory.forEach(item => {
      if (item.purchase_date) {
        // YYYY-MM-DD形式かチェック
        const yearStr = item.purchase_date.substring(0, 4)
        if (/^\d{4}$/.test(yearStr)) {
          const year = parseInt(yearStr, 10)
          if (!isNaN(year) && year >= 2000) {
            years.add(year)
          }
        }
      }
    })
    return ['all' as const, ...Array.from(years).sort((a, b) => b - a)]
  }, [inventory])

  // フィルタリングされたデータ
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (!item.purchase_date) return false
      if (selectedYear === 'all') return true
      const date = new Date(item.purchase_date)
      const year = date.getFullYear()
      const month = date.getMonth() + 1

      if (viewMode === 'yearly') {
        return year === selectedYear
      } else {
        return year === selectedYear && month === selectedMonth
      }
    })
  }, [inventory, viewMode, selectedYear, selectedMonth])

  // 仕入先別統計
  const sourceStats = useMemo(() => {
    const stats: Record<string, {
      purchaseCount: number
      soldCount: number
      totalPurchase: number
      totalSales: number
      totalProfit: number
    }> = {}

    filteredInventory.forEach(item => {
      const source = item.purchase_source || '未設定'

      if (!stats[source]) {
        stats[source] = {
          purchaseCount: 0,
          soldCount: 0,
          totalPurchase: 0,
          totalSales: 0,
          totalProfit: 0,
        }
      }

      stats[source].purchaseCount += 1
      stats[source].totalPurchase += item.purchase_total || 0

      // 売却済みの場合
      if (item.status === '売却済' && item.deposit_amount !== null) {
        stats[source].soldCount += 1
        stats[source].totalSales += item.deposit_amount
        const profit = item.deposit_amount - (item.purchase_total || 0) - (item.other_cost || 0)
        stats[source].totalProfit += profit
      }
    })

    // 配列に変換してソート
    const result: SourceStats[] = Object.entries(stats).map(([source, data]) => ({
      source,
      ...data,
      profitRate: data.totalSales > 0 ? (data.totalProfit / data.totalSales) * 100 : 0,
      roi: data.totalPurchase > 0 ? (data.totalProfit / data.totalPurchase) * 100 : 0,
    }))

    return result.sort((a, b) => b.totalProfit - a.totalProfit)
  }, [filteredInventory])

  // 合計
  const totals = useMemo(() => {
    return sourceStats.reduce((acc, stat) => ({
      purchaseCount: acc.purchaseCount + stat.purchaseCount,
      soldCount: acc.soldCount + stat.soldCount,
      totalPurchase: acc.totalPurchase + stat.totalPurchase,
      totalSales: acc.totalSales + stat.totalSales,
      totalProfit: acc.totalProfit + stat.totalProfit,
    }), {
      purchaseCount: 0,
      soldCount: 0,
      totalPurchase: 0,
      totalSales: 0,
      totalProfit: 0,
    })
  }, [sourceStats])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">仕入先別データ</h1>
            <div className="flex items-center gap-4">
              {/* 表示切替 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`px-3 py-1.5 text-sm rounded ${
                    viewMode === 'monthly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  当月
                </button>
                <button
                  onClick={() => setViewMode('yearly')}
                  className={`px-3 py-1.5 text-sm rounded ${
                    viewMode === 'yearly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  全月
                </button>
              </div>
              {/* 年選択 */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
              >
                {availableYears.length > 0 ? (
                  availableYears.map(year => (
                    <option key={year} value={year}>{year === 'all' ? '全年' : `${year}年`}</option>
                  ))
                ) : (
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}年</option>
                )}
              </select>
              {/* 月選択（当月モードのみ） */}
              {viewMode === 'monthly' && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}月</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">仕入件数</div>
              <div className="text-2xl font-bold text-gray-900">{totals.purchaseCount}件</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">販売件数</div>
              <div className="text-2xl font-bold text-gray-900">{totals.soldCount}件</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">仕入総額</div>
              <div className="text-2xl font-bold text-gray-900">¥{totals.totalPurchase.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">売上総額</div>
              <div className="text-2xl font-bold text-gray-900">¥{totals.totalSales.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">利益総額</div>
              <div className={`text-2xl font-bold ${totals.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ¥{totals.totalProfit.toLocaleString()}
              </div>
            </div>
          </div>

          {/* テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">仕入先</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">仕入件数</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">販売件数</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">仕入総額</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">売上総額</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">利益</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">利益率</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">ROI</th>
                </tr>
              </thead>
              <tbody>
                {sourceStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  sourceStats.map((stat, index) => (
                    <tr key={stat.source} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-gray-900 font-medium">{stat.source}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{stat.purchaseCount}件</td>
                      <td className="px-4 py-3 text-right text-gray-900">{stat.soldCount}件</td>
                      <td className="px-4 py-3 text-right text-gray-900">¥{stat.totalPurchase.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-900">¥{stat.totalSales.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-medium ${stat.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ¥{stat.totalProfit.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {stat.totalSales > 0 ? `${stat.profitRate.toFixed(1)}%` : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${stat.roi >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {stat.totalPurchase > 0 ? `${stat.roi.toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {sourceStats.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-200 font-semibold">
                    <td className="px-4 py-3 text-gray-900">合計</td>
                    <td className="px-4 py-3 text-right text-gray-900">{totals.purchaseCount}件</td>
                    <td className="px-4 py-3 text-right text-gray-900">{totals.soldCount}件</td>
                    <td className="px-4 py-3 text-right text-gray-900">¥{totals.totalPurchase.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-900">¥{totals.totalSales.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right ${totals.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ¥{totals.totalProfit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {totals.totalSales > 0 ? `${((totals.totalProfit / totals.totalSales) * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right ${totals.totalPurchase > 0 && totals.totalProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {totals.totalPurchase > 0 ? `${((totals.totalProfit / totals.totalPurchase) * 100).toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* 説明 */}
          <div className="mt-6 text-xs text-gray-500 space-y-1">
            <p>* 利益率 = 利益 / 売上総額 × 100</p>
            <p>* ROI（投資利益率）= 利益 / 仕入総額 × 100（仕入れに対してどれだけ利益が出たか）</p>
          </div>
        </div>
      </div>
    </div>
  )
}
