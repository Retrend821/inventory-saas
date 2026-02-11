'use client'

import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'

function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (!loading) {
      if (!user && !isLoginPage) {
        // 未認証でログインページ以外にいる場合はリダイレクト
        router.push('/login')
      } else if (user && isLoginPage) {
        // 認証済みでログインページにいる場合はホームへ
        router.push('/')
      }
    }
  }, [user, loading, isLoginPage, router])

  // ローディング中または認証チェック中は何も表示しない
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  // 未認証でログインページ以外 → リダイレクト待ち
  if (!user && !isLoginPage) {
    return null
  }

  // 認証済みでログインページ → リダイレクト待ち
  if (user && isLoginPage) {
    return null
  }

  return (
    <>
      {!isLoginPage && <Navigation />}
      <div className={isLoginPage ? '' : 'pt-14'}>
        {children}
      </div>
    </>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AuthGuard>{children}</AuthGuard>
      </ThemeProvider>
    </AuthProvider>
  )
}
