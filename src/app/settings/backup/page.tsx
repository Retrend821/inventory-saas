'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// バックアップ対象のテーブル一覧
const BACKUP_TABLES = [
  { name: 'inventory', label: '在庫データ' },
  { name: 'manual_sales', label: '売上データ' },
  { name: 'bulk_purchases', label: 'まとめ仕入れ' },
  { name: 'bulk_sales', label: 'まとめ売上' },
  { name: 'platforms', label: '販路マスタ' },
  { name: 'suppliers', label: '仕入先マスタ' },
] as const

interface BackupData {
  exportedAt: string
  tables: {
    [key: string]: {
      count: number
      data: unknown[]
    }
  }
}

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<string>('')
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportAllData = async () => {
    setIsExporting(true)
    setError(null)
    setExportProgress('バックアップを開始...')

    try {
      const backupData: BackupData = {
        exportedAt: new Date().toISOString(),
        tables: {}
      }

      for (const table of BACKUP_TABLES) {
        setExportProgress(`${table.label}を取得中...`)

        // ページネーションで全データを取得
        let allData: unknown[] = []
        let from = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error: fetchError } = await supabase
            .from(table.name)
            .select('*')
            .range(from, from + pageSize - 1)
            .order('created_at', { ascending: true })

          if (fetchError) {
            console.error(`Error fetching ${table.name}:`, fetchError)
            // エラーがあっても続行（テーブルが存在しない場合など）
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

        backupData.tables[table.name] = {
          count: allData.length,
          data: allData
        }
      }

      setExportProgress('ファイルを生成中...')

      // JSONファイルとしてダウンロード
      const jsonString = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      // ファイル名に日時を含める（日本語形式）
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const fileName = `在庫バックアップ_${year}年${month}月${day}日_${hour}時${minute}分.json`

      // ダウンロード実行
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // 完了
      const totalRecords = Object.values(backupData.tables).reduce((sum, t) => sum + t.count, 0)
      setLastBackup(`${now.toLocaleString('ja-JP')} - ${totalRecords}件のレコードをエクスポート`)
      setExportProgress('')
    } catch (err) {
      console.error('Backup error:', err)
      setError('バックアップ中にエラーが発生しました')
      setExportProgress('')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">データバックアップ</h1>

          <div className="space-y-6">
            {/* 説明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="font-semibold text-blue-800 mb-2">バックアップについて</h2>
              <p className="text-sm text-blue-700">
                すべてのデータをJSON形式でダウンロードします。
                定期的にバックアップを取ることで、万が一のデータ消失に備えることができます。
              </p>
            </div>

            {/* バックアップ対象テーブル */}
            <div>
              <h2 className="font-semibold text-gray-800 mb-3">バックアップ対象</h2>
              <ul className="space-y-2">
                {BACKUP_TABLES.map((table) => (
                  <li key={table.name} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {table.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* 進捗表示 */}
            {exportProgress && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-gray-700">{exportProgress}</span>
                </div>
              </div>
            )}

            {/* 最後のバックアップ情報 */}
            {lastBackup && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  <span className="font-semibold">最後のバックアップ:</span> {lastBackup}
                </p>
              </div>
            )}

            {/* エクスポートボタン */}
            <button
              onClick={exportAllData}
              disabled={isExporting}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
                isExporting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isExporting ? 'エクスポート中...' : 'バックアップをダウンロード'}
            </button>

            {/* 注意事項 */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>* バックアップファイルは安全な場所に保管してください</p>
              <p>* 月に1回程度のバックアップを推奨します</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
