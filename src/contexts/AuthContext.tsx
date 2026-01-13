'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { isViewer } from '@/lib/userRoles'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  isViewerUser: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  viewerSignIn: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ローカルストレージから閲覧専用ユーザー情報を取得（SSR対応）
const getInitialViewerEmail = (): string | null => {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem('viewerEmail')
  return saved && isViewer(saved) ? saved : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [viewerEmail, setViewerEmail] = useState<string | null>(getInitialViewerEmail)
  const [user, setUser] = useState<User | null>(() => {
    const email = getInitialViewerEmail()
    return email ? { email, id: 'viewer-' + email } as User : null
  })
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(() => {
    // 閲覧専用ユーザーなら既にロード完了
    return !getInitialViewerEmail()
  })

  // 閲覧専用ユーザーかどうか（ホワイトリストでログインしたユーザー）
  const isViewerUser = viewerEmail !== null

  useEffect(() => {
    // 閲覧専用ユーザーとして既にログイン済みなら何もしない
    if (viewerEmail) return

    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error as Error | null }
  }

  // 閲覧専用ユーザーとしてログイン（パスワード不要）
  const viewerSignIn = async (email: string) => {
    if (!isViewer(email)) {
      return { error: new Error('このメールアドレスは閲覧専用アカウントとして登録されていません') }
    }
    // ローカルストレージに保存
    localStorage.setItem('viewerEmail', email)
    setViewerEmail(email)
    // 仮のユーザー情報をセット
    setUser({ email, id: 'viewer-' + email } as User)
    return { error: null }
  }

  const signOut = async () => {
    // 閲覧専用ユーザーの場合はローカルストレージをクリア
    if (viewerEmail) {
      localStorage.removeItem('viewerEmail')
      setViewerEmail(null)
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isViewerUser, signIn, signUp, viewerSignIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
