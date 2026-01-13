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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewerEmail, setViewerEmail] = useState<string | null>(null)

  // 閲覧専用ユーザーかどうか（ホワイトリストでログインしたユーザー、またはメールアドレスがホワイトリストに含まれる）
  const isViewerUser = viewerEmail !== null || isViewer(user?.email)

  useEffect(() => {
    // ローカルストレージから閲覧専用ユーザー情報を復元
    const savedViewerEmail = localStorage.getItem('viewerEmail')
    if (savedViewerEmail && isViewer(savedViewerEmail)) {
      setViewerEmail(savedViewerEmail)
      setUser({ email: savedViewerEmail, id: 'viewer-' + savedViewerEmail } as User)
      setLoading(false)
      return
    }

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
