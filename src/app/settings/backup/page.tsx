'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// バックアップ対象のテーブル一覧（復元順序を考慮）
const BACKUP_TABLES = [
  { name: 'platforms', label: '販路マスタ' },
  { name: 'suppliers', label: '仕入先マスタ' },
  { name: 'inventory', label: '在庫データ' },
  { name: 'manual_sales', label: '売上データ' },
  { name: 'bulk_purchases', label: 'まとめ仕入れ' },
  { name: 'bulk_sales', label: 'まとめ売上' },
] as const

interface BackupData {
  exportedAt: string
  tables: {
    [key: string]: {
      count: number
      data: Record<string, unknown>[]
    }
  }
}

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [lastRestore, setLastRestore] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<BackupData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportAllData = async () => {
    setIsExporting(true)
    setError(null)
    setProgress('バックアップを開始...')

    try {
      const backupData: BackupData = {
        exportedAt: new Date().toISOString(),
        tables: {}
      }

      for (const table of BACKUP_TABLES) {
        setProgress(`${table.label}を取得中...`)

        let allData: Record<string, unknown>[] = []
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

      setProgress('ファイルを生成中...')

      const jsonString = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const fileName = `在庫バックアップ_${year}年${month}月${day}日_${hour}時${minute}分.json`

      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const totalRecords = Object.values(backupData.tables).reduce((sum, t) => sum + t.count, 0)
      setLastBackup(`${now.toLocaleString('ja-JP')} - ${totalRecords}件のレコードをエクスポート`)
      setProgress('')
    } catch (err) {
      console.error('Backup error:', err)
      setError('バックアップ中にエラーが発生しました')
      setProgress('')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setProgress('ファイルを読み込み中...')

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as BackupData

        // バリデーション
        if (!data.exportedAt || !data.tables) {
          throw new Error('無効なバックアップファイルです')
        }

        setImportPreview(data)
        setProgress('')
      } catch (err) {
        console.error('File parse error:', err)
        setError('ファイルの読み込みに失敗しました。正しいバックアップファイルか確認してください。')
        setProgress('')
      }
    }
    reader.readAsText(file)

    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const executeRestore = async () => {
    if (!importPreview) return

    const confirmMessage = `本当にデータを復元しますか？\n\n` +
      `この操作は現在のデータを上書きします。\n` +
      `復元元: ${new Date(importPreview.exportedAt).toLocaleString('ja-JP')}\n\n` +
      `続行するには「復元する」と入力してください。`

    const input = prompt(confirmMessage)
    if (input !== '復元する') {
      return
    }

    setIsImporting(true)
    setError(null)
    setProgress('復元を開始...')

    try {
      // テーブルごとに復元（依存関係を考慮した順序で）
      for (const table of BACKUP_TABLES) {
        const tableData = importPreview.tables[table.name]
        if (!tableData || tableData.data.length === 0) {
          continue
        }

        setProgress(`${table.label}を復元中... (${tableData.count}件)`)

        // 既存データを削除
        const { error: deleteError } = await supabase
          .from(table.name)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // 全件削除のワークアラウンド

        if (deleteError) {
          console.error(`Error deleting ${table.name}:`, deleteError)
          // 削除エラーは無視して続行（データがない場合もエラーになる）
        }

        // データを挿入（バッチ処理）
        const batchSize = 100
        for (let i = 0; i < tableData.data.length; i += batchSize) {
          const batch = tableData.data.slice(i, i + batchSize)

          const { error: insertError } = await supabase
            .from(table.name)
            .insert(batch)

          if (insertError) {
            console.error(`Error inserting ${table.name}:`, insertError)
            throw new Error(`${table.label}の復元に失敗しました: ${insertError.message}`)
          }
        }
      }

      const totalRecords = Object.values(importPreview.tables).reduce((sum, t) => sum + t.count, 0)
      setLastRestore(`${new Date().toLocaleString('ja-JP')} - ${totalRecords}件のレコードを復元`)
      setImportPreview(null)
      setProgress('')
      alert('データの復元が完了しました。ページを再読み込みしてください。')
    } catch (err) {
      console.error('Restore error:', err)
      setError(err instanceof Error ? err.message : '復元中にエラーが発生しました')
      setProgress('')
    } finally {
      setIsImporting(false)
    }
  }

  const isProcessing = isExporting || isImporting

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* エクスポートセクション */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">データバックアップ</h1>

          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <h2 className="font-semibold text-blue-800 mb-2 text-sm sm:text-base">バックアップについて</h2>
              <p className="text-xs sm:text-sm text-blue-700">
                すべてのデータをJSON形式でダウンロードします。
                定期的にバックアップを取ることで、万が一のデータ消失に備えることができます。
              </p>
            </div>

            <div>
              <h2 className="font-semibold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">バックアップ対象</h2>
              <ul className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {BACKUP_TABLES.map((table) => (
                  <li key={table.name} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {table.label}
                  </li>
                ))}
              </ul>
            </div>

            {lastBackup && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-green-700">
                  <span className="font-semibold">最後のバックアップ:</span> {lastBackup}
                </p>
              </div>
            )}

            <button
              onClick={exportAllData}
              disabled={isProcessing}
              className={`w-full py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-white transition-colors touch-target text-sm sm:text-base ${
                isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isExporting ? 'エクスポート中...' : 'バックアップをダウンロード'}
            </button>
          </div>
        </div>

        {/* インポートセクション */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">データ復元</h1>

          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
              <h2 className="font-semibold text-yellow-800 mb-2 text-sm sm:text-base">復元について</h2>
              <p className="text-xs sm:text-sm text-yellow-700">
                バックアップファイルからデータを復元します。
                <strong>現在のデータは上書きされます</strong>のでご注意ください。
              </p>
            </div>

            {!importPreview ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="backup-file"
                />
                <label
                  htmlFor="backup-file"
                  className={`block w-full py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-center cursor-pointer transition-colors touch-target text-sm sm:text-base ${
                    isProcessing
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-dashed border-gray-300'
                  }`}
                >
                  バックアップファイルを選択
                </label>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">復元するデータ</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                    バックアップ日時: {new Date(importPreview.exportedAt).toLocaleString('ja-JP')}
                  </p>
                  <ul className="space-y-1">
                    {BACKUP_TABLES.map((table) => {
                      const tableData = importPreview.tables[table.name]
                      return (
                        <li key={table.name} className="flex justify-between text-xs sm:text-sm">
                          <span className="text-gray-600">{table.label}</span>
                          <span className="text-gray-900 font-medium">
                            {tableData?.count ?? 0}件
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => setImportPreview(null)}
                    disabled={isImporting}
                    className="flex-1 py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors touch-target text-sm sm:text-base"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={executeRestore}
                    disabled={isImporting}
                    className={`flex-1 py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-white transition-colors touch-target text-sm sm:text-base ${
                      isImporting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isImporting ? '復元中...' : 'データを復元する'}
                  </button>
                </div>
              </div>
            )}

            {lastRestore && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-green-700">
                  <span className="font-semibold">最後の復元:</span> {lastRestore}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* エラー・進捗表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-red-700">{error}</p>
          </div>
        )}

        {progress && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs sm:text-sm text-gray-700">{progress}</span>
            </div>
          </div>
        )}

        {/* 注意事項 */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>* バックアップファイルは安全な場所に保管してください</p>
          <p>* 月に1回程度のバックアップを推奨します</p>
          <p>* 復元前に必ず現在のデータをバックアップしてください</p>
        </div>
      </div>
    </div>
  )
}
