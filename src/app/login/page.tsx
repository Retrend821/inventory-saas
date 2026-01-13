'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { isViewer } from '@/lib/userRoles'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isViewerLogin, setIsViewerLogin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signIn, signUp, viewerSignIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isViewerLogin) {
        // 閲覧専用ログイン
        if (!isViewer(email)) {
          setError('このメールアドレスは閲覧専用アカウントとして登録されていません')
          setLoading(false)
          return
        }
        const { error } = await viewerSignIn(email)
        if (error) {
          setError(error.message)
          setLoading(false)
        } else {
          await new Promise(resolve => setTimeout(resolve, 500))
          window.location.href = '/'
        }
      } else if (isSignUp) {
        const { error } = await signUp(email, password)
        if (error) {
          setError(error.message)
          setLoading(false)
        } else {
          setError('確認メールを送信しました。メールを確認してください。')
          setLoading(false)
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
          setLoading(false)
        } else {
          // ログイン成功 - セッション保存を待ってからリダイレクト
          await new Promise(resolve => setTimeout(resolve, 500))
          window.location.href = '/'
        }
      }
    } catch {
      setError('エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">
          {isViewerLogin ? '閲覧専用ログイン' : (isSignUp ? '新規登録' : 'ログイン')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          {!isViewerLogin && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
          )}

          {error && (
            <div className={`text-sm ${error.includes('確認メール') ? 'text-green-600' : 'text-red-600'}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '処理中...' : (isViewerLogin ? '閲覧専用でログイン' : (isSignUp ? '登録' : 'ログイン'))}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center">
          {!isViewerLogin && (
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
              }}
              className="text-sm text-blue-600 hover:text-blue-500 block w-full"
            >
              {isSignUp ? 'アカウントをお持ちの方はこちら' : '新規登録はこちら'}
            </button>
          )}
          <button
            onClick={() => {
              setIsViewerLogin(!isViewerLogin)
              setIsSignUp(false)
              setError(null)
              setPassword('')
            }}
            className="text-sm text-green-600 hover:text-green-500 block w-full"
          >
            {isViewerLogin ? '通常ログインに戻る' : '閲覧専用アカウントでログイン'}
          </button>
        </div>
      </div>
    </div>
  )
}
