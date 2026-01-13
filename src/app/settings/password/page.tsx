'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function PasswordChangePage() {
  const { user } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [isResetMode, setIsResetMode] = useState(false)

  // Supabaseの認証イベントを監視してパスワードリカバリーモードを検出
  useEffect(() => {
    // URLハッシュからリカバリートークンをチェック
    const hash = window.location.hash
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
      setIsResetMode(true)
    }

    // 認証状態変更イベントを監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetMode(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // パスワードリセットメール送信
  const handleSendResetEmail = async () => {
    if (!user?.email) {
      setMessage({ type: 'error', text: 'ユーザー情報が取得できません' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/settings/password`,
      })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'パスワードリセットメールを送信しました。メールを確認してリンクをクリックしてください。' })
      }
    } catch {
      setMessage({ type: 'error', text: 'エラーが発生しました' })
    } finally {
      setLoading(false)
    }
  }

  // 新しいパスワードを設定
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'パスワードは6文字以上で入力してください' })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'パスワードが一致しません' })
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'パスワードを変更しました' })
        setNewPassword('')
        setConfirmPassword('')
        setIsResetMode(false)
        // URLのハッシュをクリア
        window.history.replaceState(null, '', window.location.pathname)
      }
    } catch {
      setMessage({ type: 'error', text: 'エラーが発生しました' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">パスワード変更</h1>

          {user && (
            <div className="mb-6 p-3 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">ログイン中: {user.email}</p>
            </div>
          )}

          {isResetMode ? (
            // メールリンクからのアクセス時：新パスワード入力フォーム
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">メール認証が完了しました。新しいパスワードを入力してください。</p>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-900">
                  新しいパスワード
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="6文字以上"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-900">
                  新しいパスワード（確認）
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="もう一度入力"
                />
              </div>

              {message && (
                <div className={`text-sm p-3 rounded-md ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '変更中...' : 'パスワードを変更'}
              </button>
            </form>
          ) : (
            // 通常アクセス時：メール送信ボタン
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  セキュリティのため、パスワード変更にはメール認証が必要です。
                </p>
                <p className="text-sm text-yellow-800 mt-2">
                  下のボタンをクリックすると、登録メールアドレスにパスワードリセットリンクが送信されます。
                </p>
              </div>

              {message && (
                <div className={`text-sm p-3 rounded-md ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {message.text}
                </div>
              )}

              <button
                onClick={handleSendResetEmail}
                disabled={loading}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '送信中...' : 'パスワードリセットメールを送信'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
