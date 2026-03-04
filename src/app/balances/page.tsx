'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type BalanceRecord = {
  id: number
  platform: string
  balance: number
  fetched_at: string
}

const PLATFORM_CONFIG: Record<string, { name: string; color: string }> = {
  mercari: { name: 'メルカリ', color: '#FF0211' },
  yahoo: { name: 'ヤフオク', color: '#FF0033' },
  rakuma: { name: 'ラクマ', color: '#6F2DBD' },
  'mercari-shops': { name: 'メルカリショップス', color: '#4DC4FF' },
  paypal: { name: 'PayPal', color: '#003087' },
  sbi: { name: '住信SBIネット銀行', color: '#0066CC' },
  toei: { name: '東栄信用金庫', color: '#006633' },
  shopify: { name: 'Shopify', color: '#96BF48' },
}

export default function BalancesPage() {
  const { user } = useAuth()
  const [latestBalances, setLatestBalances] = useState<BalanceRecord[]>([])
  const [historyData, setHistoryData] = useState<BalanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user])

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
      const latestResults = await Promise.all(latestPromises)
      setLatestBalances(latestResults.filter(Boolean) as BalanceRecord[])

      // 過去30日の履歴を取得（グラフ用）
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data: history } = await supabase
        .from('platform_balances')
        .select('*')
        .gte('fetched_at', thirtyDaysAgo.toISOString())
        .order('fetched_at', { ascending: true })
      setHistoryData(history || [])
    } catch (e) {
      console.error('データ取得エラー:', e)
    } finally {
      setLoading(false)
    }
  }

  // 合計残高
  const totalBalance = useMemo(
    () => latestBalances.reduce((sum, b) => sum + b.balance, 0),
    [latestBalances]
  )

  // グラフ用データ（日付ごとに各プラットフォームの残高をまとめる）
  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {}
    for (const record of historyData) {
      const date = record.fetched_at.slice(0, 10) // YYYY-MM-DD
      if (!byDate[date]) byDate[date] = {}
      // 同じ日に複数回取得した場合は最新のものを使う
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
          売掛金（売上残高）
        </h1>

        {/* 合計残高 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">合計残高</div>
          <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {totalBalance.toLocaleString()}
            <span className="text-lg ml-1">円</span>
          </div>
          {latestBalances.length > 0 && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              最終取得: {new Date(latestBalances.reduce((latest, b) =>
                b.fetched_at > latest ? b.fetched_at : latest, ''
              )).toLocaleString('ja-JP')}
            </div>
          )}
        </div>

        {/* プラットフォーム別カード */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Object.entries(PLATFORM_CONFIG).map(([key, config]) => {
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
