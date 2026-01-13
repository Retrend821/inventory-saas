'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// パスワード変更を許可するメールアドレス（管理者のみ）
const ADMIN_EMAIL = 'retrend.brand@gmail.com'

export default function PasswordChangePage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 管理者以外はアクセス不可
  const isAdmin = user?.email === ADMIN_EMAIL

  // 新しいパスワードを設定（現在のパスワードで再認証してから変更）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!currentPassword) {
      setMessage({ type: 'error', text: '現在のパスワードを入力してください' })
      return
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '新しいパスワードは6文字以上で入力してください' })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '新しいパスワードが一致しません' })
      return
    }

    if (!user?.email) {
      setMessage({ type: 'error', text: 'ユーザー情報が取得できません' })
      return
    }

    setLoading(true)

    try {
      // まず現在のパスワードで再認証
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })

      if (signInError) {
        setMessage({ type: 'error', text: '現在のパスワードが正しくありません' })
        setLoading(false)
        return
      }

      // 再認証成功後、パスワードを変更
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        setMessage({ type: 'error', text: updateError.message })
      } else {
        setMessage({ type: 'success', text: 'パスワードを変更しました' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
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

          {!isAdmin ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                パスワードの変更は管理者のみ可能です。
              </p>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-900">
                現在のパスワード
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="現在のパスワードを入力"
              />
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
          )}
        </div>
      </div>
    </div>
  )
}
