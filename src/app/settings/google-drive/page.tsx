'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Googleドライブ連携状態を確認する関数
async function checkGoogleDriveConnection(): Promise<boolean> {
  try {
    const response = await fetch('/api/google-drive/status')
    const data = await response.json()
    return data.connected
  } catch {
    return false
  }
}

function GoogleDrivePageContent() {
  const searchParams = useSearchParams()

  const [googleDriveConnected, setGoogleDriveConnected] = useState(false)
  const [googleDriveLoading, setGoogleDriveLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    checkGoogleDrive()

    // URLパラメータをチェック
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'google_connected') {
      setMessage({ type: 'success', text: 'Googleドライブと連携しました' })
      setGoogleDriveConnected(true)
      // URLパラメータをクリア
      window.history.replaceState({}, '', '/settings/google-drive')
    } else if (error) {
      const errorMessages: Record<string, string> = {
        google_auth_failed: 'Google認証に失敗しました',
        no_code: '認証コードが取得できませんでした',
        token_error: 'トークンの取得に失敗しました',
        server_error: 'サーバーエラーが発生しました',
      }
      setMessage({ type: 'error', text: errorMessages[error] || '認証に失敗しました' })
      // URLパラメータをクリア
      window.history.replaceState({}, '', '/settings/google-drive')
    }
  }, [searchParams])

  const checkGoogleDrive = async () => {
    setGoogleDriveLoading(true)
    const connected = await checkGoogleDriveConnection()
    setGoogleDriveConnected(connected)
    setGoogleDriveLoading(false)
  }

  if (googleDriveLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l3.43 5.5h6.28l3.43-5.5L7.71 3.5zm9.58 0L10.71 15l3.43 5.5h6.28L17.29 3.5h-.01zm-9.58 2.08L11.14 12H5.29l2.42-6.42zM12 12l2.43 6.42H8.57L12 12zm1.71-6.42L16.14 12H22l-5.57-6.42h-2.72z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Googleドライブ連携</h1>
            <p className="text-gray-500">画像ストレージの設定</p>
          </div>
          {/* ステータスバッジ */}
          <div className="ml-auto">
            {googleDriveConnected ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                連携済み
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                未連携
              </span>
            )}
          </div>
        </div>

        {/* メッセージ表示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {message.text}
              <button
                onClick={() => setMessage(null)}
                className="ml-auto text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* メインカード */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* カードヘッダー */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">画像ストレージ連携</h2>
          </div>

          <div className="p-6">
            <p className="text-gray-600 mb-6">
              Googleドライブと連携することで、CSVインポート時の画像を自動的に保存できます。
              画像はあなたのGoogleドライブ内の「ワンポチ在庫_画像」フォルダに保存されます。
            </p>

            {/* 機能説明 */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-900 mb-1">無料で15GBまで</h3>
                <p className="text-sm text-gray-500">Googleドライブの無料容量をそのまま利用できます</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-900 mb-1">URLが期限切れにならない</h3>
                <p className="text-sm text-gray-500">オークション画像と違い、永続的に利用できます</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-900 mb-1">安全に管理</h3>
                <p className="text-sm text-gray-500">あなた専用のストレージで画像を管理します</p>
              </div>
            </div>

            {/* 接続ボタン */}
            <div className="flex items-center justify-center py-6 border-t border-gray-200">
              {googleDriveConnected ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-lg font-medium">Googleドライブと連携済みです</span>
                  </div>
                  <a
                    href="/api/auth/google"
                    className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    再連携する
                  </a>
                </div>
              ) : (
                <a
                  href="/api/auth/google"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg shadow-lg hover:shadow-xl"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.71 3.5L1.15 15l3.43 5.5h6.28l3.43-5.5L7.71 3.5zm9.58 0L10.71 15l3.43 5.5h6.28L17.29 3.5h-.01zm-9.58 2.08L11.14 12H5.29l2.42-6.42zM12 12l2.43 6.42H8.57L12 12zm1.71-6.42L16.14 12H22l-5.57-6.42h-2.72z"/>
                  </svg>
                  Googleドライブと連携する
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 補足情報 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">連携について</p>
              <p>連携すると、CSVインポート時に画像URLが自動的にGoogleドライブにコピーされます。元のURLが期限切れになっても、Googleドライブ上の画像は永続的に利用できます。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GoogleDrivePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <p>読み込み中...</p>
        </div>
      </div>
    }>
      <GoogleDrivePageContent />
    </Suspense>
  )
}
