'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

export default function Navigation() {
  const pathname = usePathname()
  const { user, signOut, isViewerUser } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const summaryDropdownRef = useRef<HTMLDivElement>(null)
  const inventoryDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
      if (summaryDropdownRef.current && !summaryDropdownRef.current.contains(event.target as Node)) {
        setSummaryOpen(false)
      }
      if (inventoryDropdownRef.current && !inventoryDropdownRef.current.contains(event.target as Node)) {
        setInventoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // モバイルメニューが開いている時はスクロールを無効化
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  // ページ遷移時にモバイルメニューを閉じる
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // スタイルの共通化
  const baseLinkStyle = "font-medium text-white hover:text-blue-300 transition-colors duration-200";
  const activeLinkStyle = "font-bold text-blue-300 border-b-2 border-blue-300 pb-1";
  const dropdownItemStyle = "block px-4 py-2 text-sm text-white hover:bg-slate-600";
  // モバイル用スタイル
  const mobileBaseLinkStyle = "block px-4 py-3 text-base font-medium text-white hover:bg-slate-600 transition-colors touch-target";
  const mobileActiveLinkStyle = "block px-4 py-3 text-base font-bold text-blue-300 bg-slate-600 touch-target";
  const mobileSubLinkStyle = "block pl-8 pr-4 py-2.5 text-sm text-white/90 hover:bg-slate-600 transition-colors touch-target";

  return (
    <nav className="bg-slate-700 shadow-lg border-b border-black/20 fixed top-0 left-0 right-0 z-[100]">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center h-14 gap-6">
          {/* モバイル: ハンバーガーメニューボタン */}
          <button
            className="md:hidden p-2 -ml-2 text-white hover:text-blue-300 transition-colors touch-target"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="メニューを開く"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* デスクトップ: 従来のナビゲーション */}
          <Link
            href="/dashboard"
            className={`hidden md:block ${pathname === '/dashboard' ? activeLinkStyle : baseLinkStyle}`}
          >
            ダッシュボード
          </Link>
          <div
            className="relative hidden md:block"
            ref={summaryDropdownRef}
            onMouseEnter={() => {
              setSummaryOpen(true)
              setSettingsOpen(false)
              setInventoryOpen(false)
            }}
            onMouseLeave={() => setSummaryOpen(false)}
          >
            <button
              className={pathname === '/summary' || pathname.startsWith('/summary/') || pathname.startsWith('/sales') ? activeLinkStyle : baseLinkStyle}
            >
              売上
            </button>
            {summaryOpen && (
              <div className="absolute top-full left-0 pt-1">
                <div className="bg-slate-700 border border-slate-600 rounded-md shadow-lg py-1 whitespace-nowrap">
                  <Link href="/summary" className={dropdownItemStyle} onClick={() => setSummaryOpen(false)}>売上レポート</Link>
                  <Link href="/summary/all" className={dropdownItemStyle} onClick={() => setSummaryOpen(false)}>売上明細</Link>
                  <Link href="/summary/analysis" className={dropdownItemStyle} onClick={() => setSummaryOpen(false)}>売上分析</Link>
                  <Link href="/sales/manual" className={dropdownItemStyle} onClick={() => setSummaryOpen(false)}>売上入力</Link>
                </div>
              </div>
            )}
          </div>
          <div
            className="relative hidden md:block"
            ref={inventoryDropdownRef}
            onMouseEnter={() => {
              setInventoryOpen(true)
              setSummaryOpen(false)
              setSettingsOpen(false)
            }}
            onMouseLeave={() => setInventoryOpen(false)}
          >
            <button
              className={pathname === '/' || pathname.startsWith('/inventory') ? activeLinkStyle : baseLinkStyle}
            >
              在庫管理
            </button>
            {inventoryOpen && (
              <div className="absolute top-full left-0 pt-1">
                <div className="bg-slate-700 border border-slate-600 rounded-md shadow-lg py-1 whitespace-nowrap">
                  <Link href="/" className={dropdownItemStyle} onClick={() => setInventoryOpen(false)}>単品仕入在庫一覧</Link>
                  <Link href="/inventory/bulk" className={dropdownItemStyle} onClick={() => setInventoryOpen(false)}>まとめ仕入れ在庫一覧</Link>
                </div>
              </div>
            )}
          </div>
          <Link
            href="/ledger"
            className={`hidden md:block ${pathname === '/ledger' ? activeLinkStyle : baseLinkStyle}`}
          >
            古物台帳
          </Link>
          <Link
            href="/calculator"
            className={`hidden md:block ${pathname === '/calculator' ? activeLinkStyle : baseLinkStyle}`}
          >
            計算ツール
          </Link>
          <Link
            href="/shipping"
            className={`hidden md:block ${pathname === '/shipping' ? activeLinkStyle : baseLinkStyle}`}
          >
            送料表
          </Link>
          {/* 閲覧専用ユーザーには設定メニューを非表示 */}
          {!isViewerUser && (
          <div
            className="relative hidden md:block"
            ref={dropdownRef}
            onMouseEnter={() => {
              setSettingsOpen(true)
              setSummaryOpen(false)
              setInventoryOpen(false)
            }}
            onMouseLeave={() => setSettingsOpen(false)}
          >
            <button
              className={pathname.startsWith('/settings') ? activeLinkStyle : baseLinkStyle}
            >
              設定
            </button>
            {settingsOpen && (
              <div className="absolute top-full left-0 pt-1">
                <div className="bg-slate-700 border border-slate-600 rounded-md shadow-lg py-1 whitespace-nowrap">
                  <Link href="/settings/platforms" className={dropdownItemStyle} onClick={() => setSettingsOpen(false)}>仕入先・販路マスタ設定</Link>
                  <Link href="/settings/ledger" className={dropdownItemStyle} onClick={() => setSettingsOpen(false)}>古物台帳マスタ設定</Link>
                  <Link href="/settings/google-drive" className={dropdownItemStyle} onClick={() => setSettingsOpen(false)}>Googleドライブ連携</Link>
                  <Link href="/settings/backup" className={dropdownItemStyle} onClick={() => setSettingsOpen(false)}>データバックアップ</Link>
                  <Link href="/settings/password" className={dropdownItemStyle} onClick={() => setSettingsOpen(false)}>パスワード変更</Link>
                </div>
              </div>
            )}
          </div>
          )}
          {/* スペーサー */}
          <div className="flex-grow" />
          {/* テーマ切り替え・ユーザー情報・ログアウト（デスクトップのみ） */}
          {user && (
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-1.5 text-white/80 hover:text-yellow-300 transition-colors duration-200"
                aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <span className="text-sm text-white/80">{user.email}</span>
              <button
                onClick={() => signOut()}
                className="text-sm text-red-500 hover:text-red-400 transition-colors duration-200"
              >
                ログアウト
              </button>
            </div>
          )}
          {/* モバイル: 現在のページ名を表示 */}
          <span className="md:hidden text-sm font-medium text-white truncate">
            {pathname === '/dashboard' && 'ダッシュボード'}
            {pathname === '/' && '在庫一覧'}
            {pathname === '/inventory/bulk' && 'まとめ仕入れ'}
            {pathname === '/ledger' && '古物台帳'}
            {pathname === '/calculator' && '計算ツール'}
            {pathname === '/shipping' && '送料表'}
            {pathname.startsWith('/summary') && '売上'}
            {pathname.startsWith('/sales') && '売上入力'}
            {pathname.startsWith('/settings') && '設定'}
          </span>
        </div>
      </div>

      {/* モバイル: スライドアウトドロワー */}
      <div className={`fixed inset-0 z-50 md:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        {/* バックドロップ */}
        <div
          className="absolute inset-0 bg-black/50 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
        {/* ドロワー本体 */}
        <nav className={`absolute left-0 top-0 bottom-0 w-72 bg-slate-700 shadow-xl transform transition-transform duration-300 ease-out overflow-y-auto ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-slate-600">
            <span className="font-semibold text-white">メニュー</span>
            <button
              className="p-2 text-white hover:text-blue-300 transition-colors touch-target"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="メニューを閉じる"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* メニュー項目 */}
          <div className="py-2">
            <Link
              href="/dashboard"
              className={pathname === '/dashboard' ? mobileActiveLinkStyle : mobileBaseLinkStyle}
            >
              ダッシュボード
            </Link>

            {/* 売上メニュー */}
            <div className="border-t border-slate-600 mt-2 pt-2">
              <span className="block px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">売上</span>
              <Link href="/summary" className={pathname === '/summary' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                売上レポート
              </Link>
              <Link href="/summary/all" className={pathname === '/summary/all' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                売上明細
              </Link>
              <Link href="/summary/analysis" className={pathname === '/summary/analysis' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                売上分析
              </Link>
              <Link href="/sales/manual" className={pathname === '/sales/manual' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                売上入力
              </Link>
            </div>

            {/* 在庫管理メニュー */}
            <div className="border-t border-slate-600 mt-2 pt-2">
              <span className="block px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">在庫管理</span>
              <Link href="/" className={pathname === '/' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                単品仕入在庫一覧
              </Link>
              <Link href="/inventory/bulk" className={pathname === '/inventory/bulk' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                まとめ仕入れ在庫一覧
              </Link>
            </div>

            {/* その他メニュー */}
            <div className="border-t border-slate-600 mt-2 pt-2">
              <Link
                href="/ledger"
                className={pathname === '/ledger' ? mobileActiveLinkStyle : mobileBaseLinkStyle}
              >
                古物台帳
              </Link>
              <Link
                href="/calculator"
                className={pathname === '/calculator' ? mobileActiveLinkStyle : mobileBaseLinkStyle}
              >
                計算ツール
              </Link>
              <Link
                href="/shipping"
                className={pathname === '/shipping' ? mobileActiveLinkStyle : mobileBaseLinkStyle}
              >
                送料表
              </Link>
            </div>

            {/* 設定メニュー（閲覧専用ユーザー以外） */}
            {!isViewerUser && (
              <div className="border-t border-slate-600 mt-2 pt-2">
                <span className="block px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">設定</span>
                <Link href="/settings/platforms" className={pathname === '/settings/platforms' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                  仕入先・販路マスタ設定
                </Link>
                <Link href="/settings/ledger" className={pathname === '/settings/ledger' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                  古物台帳マスタ設定
                </Link>
                <Link href="/settings/google-drive" className={pathname === '/settings/google-drive' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                  Googleドライブ連携
                </Link>
                <Link href="/settings/backup" className={pathname === '/settings/backup' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                  データバックアップ
                </Link>
                <Link href="/settings/password" className={pathname === '/settings/password' ? mobileActiveLinkStyle : mobileSubLinkStyle}>
                  パスワード変更
                </Link>
              </div>
            )}

            {/* テーマ切り替え */}
            <div className="border-t border-slate-600 mt-2 pt-2">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-white hover:bg-slate-600 transition-colors touch-target"
              >
                {isDark ? (
                  <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              </button>
            </div>

            {/* ユーザー情報・ログアウト */}
            {user && (
              <div className="border-t border-slate-600 mt-2 pt-4 px-4">
                <div className="text-xs text-white/60 mb-2">ログイン中</div>
                <div className="text-sm text-white/90 truncate mb-3">{user.email}</div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    signOut()
                  }}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors touch-target"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </nav>
  )
}
