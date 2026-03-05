'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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

type TabType = 'assets' | 'liabilities'

export default function BalancesPage() {
  const { user } = useAuth()
  const [latestBalances, setLatestBalances] = useState<BalanceRecord[]>([])
  const [historyData, setHistoryData] = useState<BalanceRecord[]>([])
  const [stockValueCost, setStockValueCost] = useState(0)
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('assets')

  // 売掛金取得ツール連携
  const [collectorStatus, setCollectorStatus] = useState<'idle' | 'checking' | 'running' | 'done' | 'error'>('idle')
  const [collectorLogs, setCollectorLogs] = useState<string[]>([])
  const [serverAvailable, setServerAvailable] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const BALANCE_SERVER = 'http://localhost:3456'

  // サーバー生存確認
  const checkServer = useCallback(async () => {
    try {
      const res = await fetch(`${BALANCE_SERVER}/health`, { signal: AbortSignal.timeout(2000) })
      const data = await res.json()
      setServerAvailable(data.status === 'ok')
      return data.status === 'ok'
    } catch {
      setServerAvailable(false)
      return false
    }
  }, [])

  useEffect(() => {
    checkServer()
  }, [checkServer])

  // ログ自動スクロール
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [collectorLogs])

  // 残高取得実行
  const runCollector = useCallback(async (only?: string) => {
    const available = await checkServer()
    if (!available) {
      setCollectorStatus('error')
      setCollectorLogs(['サーバーに接続できません。ターミナルで以下を実行してください:', '', '  cd 13_売掛金一括取得ツール && node balance_server.cjs'])
      return
    }

    setCollectorStatus('running')
    setCollectorLogs([])

    try {
      const url = only ? `${BALANCE_SERVER}/run?only=${only}` : `${BALANCE_SERVER}/run`
      const res = await fetch(url)
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('レスポンスの読み取りに失敗')

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'log' || event.type === 'error') {
              setCollectorLogs(prev => [...prev, event.data])
            } else if (event.type === 'start') {
              setCollectorLogs(prev => [...prev, event.data.message])
            } else if (event.type === 'done') {
              setCollectorLogs(prev => [...prev, '', event.data.message])
              setCollectorStatus(event.data.code === 0 ? 'done' : 'error')
              // 完了後にデータを再取得
              if (event.data.code === 0) {
                setTimeout(() => fetchData(), 1000)
              }
            }
          } catch {}
        }
      }
    } catch (e) {
      setCollectorStatus('error')
      setCollectorLogs(prev => [...prev, `エラー: ${e instanceof Error ? e.message : String(e)}`])
    }
  }, [checkServer])

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            資産状況
          </h1>
          <button
            onClick={() => runCollector()}
            disabled={collectorStatus === 'running'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              collectorStatus === 'running'
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : serverAvailable
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {collectorStatus === 'running' ? '取得中...' : '残高を更新'}
          </button>
        </div>

        {/* 取得ログ表示 */}
        {collectorLogs.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">実行ログ</span>
              {collectorStatus !== 'running' && (
                <button
                  onClick={() => { setCollectorLogs([]); setCollectorStatus('idle') }}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  閉じる
                </button>
              )}
            </div>
            <div className="font-mono text-xs text-gray-300 space-y-0.5">
              {collectorLogs.map((line, i) => (
                <div key={i} className={line.includes('エラー') ? 'text-red-400' : ''}>{line || '\u00A0'}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* 純資産サマリー */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">純資産（資産 - 負債）</div>
              <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                {netAssets.toLocaleString()}
                <span className="text-lg ml-1">円</span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                資産 <span className="font-bold text-gray-800 dark:text-gray-100">{totalAssets.toLocaleString()}円</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                負債 <span className="font-bold text-red-600 dark:text-red-400">{loanTotal.toLocaleString()}円</span>
              </div>
            </div>
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'assets'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            資産（{totalAssets.toLocaleString()}円）
          </button>
          <button
            onClick={() => setActiveTab('liabilities')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'liabilities'
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            負債（{loanTotal.toLocaleString()}円）
          </button>
        </div>

        {activeTab === 'assets' && (
          <>
            {/* 資産サマリーカード */}
            <div className="grid grid-cols-3 gap-4 mb-6">
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
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-200 dark:border-green-800 p-6">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">在庫高（原価）</div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {stockValueCost.toLocaleString()}
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
          </>
        )}

        {activeTab === 'liabilities' && (
          <>
            {/* 借入残高 */}
            {loansByLender.map(group => (
              <div key={group.lender} className="mb-6">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{group.lender}</h2>
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
          </>
        )}

        {/* 残高推移グラフ（資産タブのみ） */}
        {activeTab === 'assets' && chartData.length > 1 && (
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
              売掛金データを取得するには、APIサーバーを起動してから「残高を更新」ボタンを押してください。
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 font-mono text-sm text-gray-800 dark:text-gray-200">
              <div className="text-gray-500 dark:text-gray-500 mb-1"># APIサーバー起動（初回のみ）</div>
              <div>cd 13_売掛金一括取得ツール && node balance_server.cjs</div>
              <div className="text-gray-500 dark:text-gray-500 mt-2 mb-1"># 初回: メルカリにログイン</div>
              <div>node balance_collector.cjs --setup mercari</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
