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
  const [inventoryOpen, setInventoryOpen] = useState(false)
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

  return (
    <nav className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-lg border-b border-gray-700 fixed top-0 left-0 right-0 z-[100]">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center h-14 gap-6">
          <Link
            href="/dashboard"
            className={pathname === '/dashboard'
              ? "text-white font-bold border-b-2 border-white pb-1"
              : "text-white font-medium hover:text-yellow-300"
            }
          >
            TOP
          </Link>
          <div className="relative" ref={inventoryDropdownRef}>
            <button
              onClick={() => {
                setInventoryOpen(!inventoryOpen)
                setSummaryOpen(false)
                setSettingsOpen(false)
              }}
              className={pathname === '/' || pathname.startsWith('/inventory') || pathname.startsWith('/returns')
                ? "text-white font-bold border-b-2 border-white pb-1"
                : "text-white font-medium hover:text-yellow-300"
              }
            >
              在庫管理
            </button>
            {inventoryOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 whitespace-nowrap">
                <Link
                  href="/"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setInventoryOpen(false)}
                >
                  在庫一覧
                </Link>
                <Link
                  href="/inventory/bulk"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setInventoryOpen(false)}
                >
                  まとめ仕入れ在庫一覧
                </Link>
                <Link
                  href="/returns"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setInventoryOpen(false)}
                >
                  返品管理
                </Link>
              </div>
            )}
          </div>
          <div className="relative" ref={summaryDropdownRef}>
            <button
              onClick={() => {
                setSummaryOpen(!summaryOpen)
                setSettingsOpen(false)
                setInventoryOpen(false)
              }}
              className={pathname.startsWith('/summary')
                ? "text-white font-bold border-b-2 border-white pb-1"
                : "text-white font-medium hover:text-yellow-300"
              }
            >
              集計・分析
            </button>
            {summaryOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 whitespace-nowrap">
                <Link
                  href="/summary"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSummaryOpen(false)}
                >
                  年間・月別
                </Link>
                <Link
                  href="/summary/retail"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSummaryOpen(false)}
                >
                  小売販売データ
                </Link>
                <Link
                  href="/summary/wholesale"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSummaryOpen(false)}
                >
                  業販販売データ
                </Link>
                <Link
                  href="/summary/all"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSummaryOpen(false)}
                >
                  全販売データ
                </Link>
                <Link
                  href="/summary/purchase-source"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSummaryOpen(false)}
                >
                  仕入先別データ
                </Link>
              </div>
            )}
          </div>
          <Link
            href="/ledger"
            className={pathname === '/ledger'
              ? "text-white font-bold border-b-2 border-white pb-1"
              : "text-white font-medium hover:text-yellow-300"
            }
          >
            古物台帳
          </Link>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setSettingsOpen(!settingsOpen)
                setSummaryOpen(false)
                setInventoryOpen(false)
              }}
              className={pathname.startsWith('/settings')
                ? "text-white font-bold border-b-2 border-white pb-1"
                : "text-white font-medium hover:text-yellow-300"
              }
            >
              設定
            </button>
            {settingsOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 whitespace-nowrap">
                <Link
                  href="/settings/platforms"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSettingsOpen(false)}
                >
                  仕入先・販路マスタ設定
                </Link>
                <Link
                  href="/settings/ledger"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSettingsOpen(false)}
                >
                  古物台帳マスタ設定
                </Link>
                <Link
                  href="/settings/google-drive"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSettingsOpen(false)}
                >
                  Googleドライブ連携
                </Link>
              </div>
            )}
          </div>
          {/* スペーサー */}
          <div className="flex-grow" />
          {/* ユーザー情報・ログアウト */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-300">{user.email}</span>
              <button
                onClick={() => signOut()}
                className="text-sm text-red-400 hover:text-red-300"
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
