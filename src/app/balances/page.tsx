'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { calcStockValueCost } from '@/lib/calcStockValue'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type BalanceRecord = {
  id: number
  platform: string
  balance: number
  fetched_at: string
}

type Loan = {
  id: string
  name: string
  lender: string
  starting_balance: number
  monthly_principal: number
  first_payment_date: string
  payment_day: number
  is_active: boolean
}

const PLATFORM_CONFIG: Record<string, { name: string; color: string; category: 'receivable' | 'bank' }> = {
  mercari: { name: 'メルカリ', color: '#FF0211', category: 'receivable' },
  yahoo: { name: 'ヤフオク', color: '#FF0033', category: 'receivable' },
  rakuma: { name: 'ラクマ', color: '#6F2DBD', category: 'receivable' },
  'mercari-shops': { name: 'メルカリショップス', color: '#4DC4FF', category: 'receivable' },
  paypal: { name: 'PayPal', color: '#003087', category: 'receivable' },
  shopify: { name: 'Shopify', color: '#96BF48', category: 'receivable' },
  sbi: { name: '住信SBIネット銀行', color: '#0066CC', category: 'bank' },
  toei: { name: '東栄信用金庫', color: '#006633', category: 'bank' },
}

export default function BalancesPage() {
  const { user } = useAuth()
  const [latestBalances, setLatestBalances] = useState<BalanceRecord[]>([])
  const [historyData, setHistoryData] = useState<BalanceRecord[]>([])
  const [stockValueCost, setStockValueCost] = useState(0)
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user])

  // 大量データを並列ページネーションで取得するヘルパー（ダッシュボードと同じ）
  async function fetchAllRows<T>(table: string, select: string): Promise<T[]> {
    const { count } = await supabase.from(table).select(select, { count: 'exact', head: true })
    if (!count || count === 0) return []
    const pageSize = 1000
    const pages = Math.ceil(count / pageSize)
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        supabase.from(table).select(select).range(i * pageSize, (i + 1) * pageSize - 1)
      )
    )
    const allData: T[] = []
    for (const { data, error } of results) {
      if (error) { console.error(`Error fetching ${table}:`, error); continue }
      if (data) allData.push(...(data as T[]))
    }
    return allData
  }

  async function fetchData() {
    setLoading(true)
    try {
      // 各プラットフォームの最新残高を取得
      const platforms = Object.keys(PLATFORM_CONFIG)
      const latestPromises = platforms.map(async (platform) => {
        const { data } = await supabase
          .from('platform_balances')
          .select('*')
          .eq('platform', platform)
          .order('fetched_at', { ascending: false })
          .limit(1)
        return data?.[0] || null
      })

      const [latestResults, historyResult, inventoryResult, bulkPurchasesResult, bulkSalesResult, loansResult] = await Promise.all([
        Promise.all(latestPromises),
        (() => {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          return supabase
            .from('platform_balances')
            .select('*')
            .gte('fetched_at', thirtyDaysAgo.toISOString())
            .order('fetched_at', { ascending: true })
        })(),
        // 在庫データ — ダッシュボードと同じ共通関数で計算
        fetchAllRows('inventory', 'purchase_price, purchase_total, sale_date, listing_date'),
        supabase.from('bulk_purchases').select('id, total_amount, total_quantity').then(r => r.data || []),
        supabase.from('bulk_sales').select('bulk_purchase_id, sale_destination, quantity, sale_amount, commission, shipping_cost, purchase_price, other_cost, deposit_amount').then(r => r.data || []),
        supabase.from('loans').select('*').eq('is_active', true).then(r => r.data || []),
      ])

      setLatestBalances(latestResults.filter(Boolean) as BalanceRecord[])
      setHistoryData(historyResult.data || [])
      // 在庫原価はダッシュボードと同じ共通関数で計算
      setStockValueCost(calcStockValueCost(inventoryResult as any, bulkPurchasesResult as any, bulkSalesResult as any))
      setLoans(loansResult as Loan[])
    } catch (e) {
      console.error('データ取得エラー:', e)
    } finally {
      setLoading(false)
    }
  }

  // カテゴリ別合計
  const receivableTotal = useMemo(
    () => latestBalances
      .filter(b => PLATFORM_CONFIG[b.platform]?.category === 'receivable')
      .reduce((sum, b) => sum + b.balance, 0),
    [latestBalances]
  )
  const bankTotal = useMemo(
    () => latestBalances
      .filter(b => PLATFORM_CONFIG[b.platform]?.category === 'bank')
      .reduce((sum, b) => sum + b.balance, 0),
    [latestBalances]
  )

  // 借入残高計算
  const loanBalances = useMemo(() => {
    const now = new Date()
    return loans.map(loan => {
      const firstDate = new Date(loan.first_payment_date)
      const firstYear = firstDate.getFullYear()
      const firstMonth = firstDate.getMonth()

      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      const currentDay = now.getDate()

      const paymentDay = loan.payment_day >= 28
        ? new Date(currentYear, currentMonth + 1, 0).getDate()
        : loan.payment_day
      const paidThisMonth = currentDay >= paymentDay

      let monthsElapsed = (currentYear - firstYear) * 12 + (currentMonth - firstMonth)
      if (paidThisMonth) monthsElapsed += 1
      if (monthsElapsed < 0) monthsElapsed = 0

      const balance = Math.max(0, loan.starting_balance - loan.monthly_principal * monthsElapsed)
      return { ...loan, currentBalance: balance }
    })
  }, [loans])

  const loanTotal = useMemo(
    () => loanBalances.reduce((sum, l) => sum + l.currentBalance, 0),
    [loanBalances]
  )

  // 金融機関ごとの借入合計
  const loansByLender = useMemo(() => {
    const grouped: Record<string, { lender: string; total: number; loans: typeof loanBalances }> = {}
    for (const loan of loanBalances) {
      if (!grouped[loan.lender]) {
        grouped[loan.lender] = { lender: loan.lender, total: 0, loans: [] }
      }
      grouped[loan.lender].total += loan.currentBalance
      grouped[loan.lender].loans.push(loan)
    }
    return Object.values(grouped)
  }, [loanBalances])

  const totalAssets = receivableTotal + bankTotal + stockValueCost
  const netAssets = totalAssets - loanTotal

  // グラフ用データ
  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {}
    for (const record of historyData) {
      const date = record.fetched_at.slice(0, 10)
      if (!byDate[date]) byDate[date] = {}
      byDate[date][record.platform] = record.balance
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, platforms]) => ({
        date: `${date.slice(5, 7)}/${date.slice(8, 10)}`,
        ...platforms,
      }))
  }, [historyData])

  if (loading) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-14 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          資産状況
        </h1>

        {/* 合計サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="col-span-2 md:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">純資産</div>
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {netAssets.toLocaleString()}
              <span className="text-lg ml-1">円</span>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              資産合計 - 借入残高
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-orange-200 dark:border-orange-800 p-6">
            <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">売掛金</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {receivableTotal.toLocaleString()}
              <span className="text-lg ml-1">円</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-800 p-6">
            <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">口座残高</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {bankTotal.toLocaleString()}
              <span className="text-lg ml-1">円</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-200 dark:border-green-800 p-6">
            <div className="text-sm text-green-600 dark:text-green-400 mb-1">在庫高（原価）</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {stockValueCost.toLocaleString()}
              <span className="text-lg ml-1">円</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-6">
            <div className="text-sm text-red-600 dark:text-red-400 mb-1">借入残高</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {loanTotal.toLocaleString()}
              <span className="text-lg ml-1">円</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">資産合計</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {totalAssets.toLocaleString()}
              <span className="text-lg ml-1">円</span>
            </div>
          </div>
        </div>

        {/* 売掛金 */}
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">売掛金</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(PLATFORM_CONFIG).filter(([, c]) => c.category === 'receivable').map(([key, config]) => {
            const record = latestBalances.find(b => b.platform === key)
            return (
              <div
                key={key}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {config.name}
                  </span>
                </div>
                {record ? (
                  <>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      {record.balance.toLocaleString()}
                      <span className="text-sm ml-1">円</span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(record.fetched_at).toLocaleString('ja-JP', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400 dark:text-gray-500">未取得</div>
                )}
              </div>
            )
          })}
        </div>

        {/* 口座残高 */}
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">口座残高</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(PLATFORM_CONFIG).filter(([, c]) => c.category === 'bank').map(([key, config]) => {
            const record = latestBalances.find(b => b.platform === key)
            return (
              <div
                key={key}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {config.name}
                  </span>
                </div>
                {record ? (
                  <>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      {record.balance.toLocaleString()}
                      <span className="text-sm ml-1">円</span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(record.fetched_at).toLocaleString('ja-JP', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400 dark:text-gray-500">未取得</div>
                )}
              </div>
            )
          })}
        </div>

        {/* 在庫高 */}
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">在庫高（原価）</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {stockValueCost.toLocaleString()}
            <span className="text-lg ml-1">円</span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            単品在庫 + まとめ仕入れ未回収額（税抜）
          </div>
        </div>

        {/* 借入残高 */}
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">借入残高</h2>
        {loansByLender.map(group => (
          <div key={group.lender} className="mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.lender}</span>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                合計 {group.total.toLocaleString()}円
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {group.loans.map(loan => (
                <div
                  key={loan.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                    {loan.name}
                  </div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {loan.currentBalance.toLocaleString()}
                    <span className="text-sm ml-1">円</span>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    月額 {loan.monthly_principal.toLocaleString()}円返済
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="mb-6" />

        {/* 残高推移グラフ */}
        {chartData.length > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              残高推移（過去30日）
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()}円`,
                    PLATFORM_CONFIG[name]?.name || name
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  formatter={(value: string) => PLATFORM_CONFIG[value]?.name || value}
                />
                {Object.entries(PLATFORM_CONFIG).map(([key, config]) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 使い方ガイド */}
        {latestBalances.length === 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
            <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">
              はじめに
            </h2>
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
              売掛金データを取得するには、ターミナルで以下のコマンドを実行してください。
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 font-mono text-sm text-gray-800 dark:text-gray-200">
              <div className="text-gray-500 dark:text-gray-500 mb-1"># 初回: メルカリにログイン</div>
              <div>node balance_collector.cjs --setup mercari</div>
              <div className="text-gray-500 dark:text-gray-500 mt-2 mb-1"># 全サービスの残高を取得</div>
              <div>node balance_collector.cjs</div>
              <div className="text-gray-500 dark:text-gray-500 mt-2 mb-1"># またはメニューから</div>
              <div>./balance_collector.sh</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
