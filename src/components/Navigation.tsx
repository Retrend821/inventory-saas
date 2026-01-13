'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function Navigation() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const summaryDropdownRef = useRef<HTMLDivElement>(null)
  const analysisDropdownRef = useRef<HTMLDivElement>(null)
  const inventoryDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
      if (summaryDropdownRef.current && !summaryDropdownRef.current.contains(event.target as Node)) {
        setSummaryOpen(false)
      }
      if (analysisDropdownRef.current && !analysisDropdownRef.current.contains(event.target as Node)) {
        setAnalysisOpen(false)
      }
      if (inventoryDropdownRef.current && !inventoryDropdownRef.current.contains(event.target as Node)) {
        setInventoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // スタイルの共通化
  const baseLinkStyle = "font-medium text-white hover:text-blue-300 transition-colors duration-200";
  const activeLinkStyle = "font-bold text-blue-300 border-b-2 border-blue-300 pb-1";
  const dropdownItemStyle = "block px-4 py-2 text-sm text-white hover:bg-slate-600";

  return (
    <nav className="bg-slate-700 shadow-lg border-b border-black/20 fixed top-0 left-0 right-0 z-[100]">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center h-14 gap-6">
          <Link
            href="/dashboard"
            className={pathname === '/dashboard' ? activeLinkStyle : baseLinkStyle}
          >
            ダッシュボード
          </Link>
          <div className="relative" ref={inventoryDropdownRef}>
            <button
              onClick={() => {
                setInventoryOpen(!inventoryOpen)
                setSummaryOpen(false)
                setAnalysisOpen(false)
                setSettingsOpen(false)
              }}
              className={pathname === '/' || pathname.startsWith('/inventory') ? activeLinkStyle : baseLinkStyle}
            >
              在庫管理
            </button>
            {inventoryOpen && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg py-1 whitespace-nowrap">
                <Link href="/" className={dropdownItemStyle} onClick={() => setInventoryOpen(false)}>単品仕入在庫一覧</Link>
                <Link href="/inventory/bulk" className={dropdownItemStyle} onClick={() => setInventoryOpen(false)}>まとめ仕入れ在庫一覧</Link>
              </div>
            )}
          </div>
          <div className="relative" ref={summaryDropdownRef}>
            <button
              onClick={() => {
                setSummaryOpen(!summaryOpen)
                setSettingsOpen(false)
                setInventoryOpen(false)
                setAnalysisOpen(false)
              }}
              className={pathname === '/summary' || pathname === '/summary/all' || pathname.startsWith('/sales') ? activeLinkStyle : baseLinkStyle}
            >
              売上
            </button>
            {summaryOpen && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg py-1 whitespace-nowrap">
                <Link href="/summary" className={dropdownItemStyle} onClick={() => setSummaryOpen(false)}>集計表</Link>
                <Link href="/summary/all" className={dropdownItemStyle} onClick={() => setSummaryOpen(false)}>実売データ</Link>
                <Link href="/sales/manual" className={dropdownItemStyle} onClick={() => setSummaryOpen(false)}>手入力売上表</Link>
              </div>
            )}
          </div>
          <div className="relative" ref={analysisDropdownRef}>
            <button
              onClick={() => {
                setAnalysisOpen(!analysisOpen)
                setSettingsOpen(false)
                setInventoryOpen(false)
                setSummaryOpen(false)
              }}
              className={pathname === '/summary/retail' || pathname === '/summary/wholesale' || pathname === '/summary/purchase-source' ? activeLinkStyle : baseLinkStyle}
            >
              分析
            </button>
            {analysisOpen && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg py-1 whitespace-nowrap">
                <Link href="/summary/purchase-source" className={dropdownItemStyle} onClick={() => setAnalysisOpen(false)}>仕入先別データ</Link>
              </div>
            )}
          </div>
          <Link
            href="/ledger"
            className={pathname === '/ledger' ? activeLinkStyle : baseLinkStyle}
          >
            古物台帳
          </Link>
          <Link
            href="/calculator"
            className={pathname === '/calculator' ? activeLinkStyle : baseLinkStyle}
          >
            計算ツール
          </Link>
          <Link
            href="/shipping"
            className={pathname === '/shipping' ? activeLinkStyle : baseLinkStyle}
          >
            送料表
          </Link>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setSettingsOpen(!settingsOpen)
                setSummaryOpen(false)
                setAnalysisOpen(false)
                setInventoryOpen(false)
              }}
              className={pathname.startsWith('/settings') ? activeLinkStyle : baseLinkStyle}
            >
              設定
            </button>
            {settingsOpen && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg py-1 whitespace-nowrap">
                <Link href="/settings/platforms" className={dropdownItemStyle} onClick={() => setSettingsOpen(false)}>仕入先・販路マスタ設定</Link>
                <Link href="/settings/ledger" className={dropdownItemStyle} onClick={() => setSettingsOpen(false)}>古物台帳マスタ設定</Link>
                <Link href="/settings/google-drive" className={dropdownItemStyle} onClick={() => setSettingsOpen(false)}>Googleドライブ連携</Link>
              </div>
            )}
          </div>
          {/* スペーサー */}
          <div className="flex-grow" />
          {/* ユーザー情報・ログアウト */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/80">{user.email}</span>
              <button
                onClick={() => signOut()}
                className="text-sm text-red-500 hover:text-red-400 transition-colors duration-200"
              >
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
