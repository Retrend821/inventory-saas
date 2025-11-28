'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export default function Navigation() {
  const pathname = usePathname()
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
    <nav className="bg-white shadow fixed top-0 left-0 right-0 z-[100]">
      <div className="max-w-full mx-auto px-4">
        <div className="flex items-center h-14 gap-6">
          <div className="relative" ref={inventoryDropdownRef}>
            <button
              onClick={() => {
                setInventoryOpen(!inventoryOpen)
                setSummaryOpen(false)
                setSettingsOpen(false)
              }}
              className={pathname === '/' || pathname.startsWith('/inventory') || pathname.startsWith('/returns')
                ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1"
                : "text-gray-600 hover:text-gray-900"
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
                ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1"
                : "text-gray-600 hover:text-gray-900"
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
                  小売販売実績
                </Link>
                <Link
                  href="/summary/wholesale"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSummaryOpen(false)}
                >
                  業販販売実績
                </Link>
                <Link
                  href="/summary/all"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setSummaryOpen(false)}
                >
                  全販売実績
                </Link>
              </div>
            )}
          </div>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setSettingsOpen(!settingsOpen)
                setSummaryOpen(false)
                setInventoryOpen(false)
              }}
              className={pathname.startsWith('/settings')
                ? "text-blue-600 font-semibold border-b-2 border-blue-600 pb-1"
                : "text-gray-600 hover:text-gray-900"
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
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
