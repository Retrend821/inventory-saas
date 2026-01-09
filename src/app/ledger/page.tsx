'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type InventoryItem = {
  id: string
  inventory_number: string | null
  product_name: string
  category: string | null
  purchase_price: number | null
  purchase_total: number | null
  sale_price: number | null
  deposit_amount: number | null
  purchase_date: string | null
  sale_date: string | null
  purchase_source: string | null
  sale_destination: string | null
  image_url: string | null
  saved_image_url: string | null
  status: string
}

type Platform = {
  name: string
  address: string | null
  representative_name: string | null
  occupation: string | null
  phone: string | null
  email: string | null
  website: string | null
  verification_method: string | null
  is_anonymous: boolean
}

type Supplier = {
  name: string
  address: string | null
  representative_name: string | null
  occupation: string | null
  phone: string | null
  email: string | null
  website: string | null
  verification_method: string | null
  is_anonymous: boolean
}

export default function LedgerPage() {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all')
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      // 全件取得するためにページネーションで取得
      let allInventory: InventoryItem[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .order('purchase_date', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error fetching inventory:', error)
          break
        }

        if (data && data.length > 0) {
          allInventory = [...allInventory, ...data]
          from += pageSize
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }
      setInventory(allInventory)

      // プラットフォームとサプライヤーは通常1000件未満なのでそのまま
      const [platformsRes, suppliersRes] = await Promise.all([
        supabase.from('platforms').select('name, address, representative_name, occupation, phone, email, website, verification_method, is_anonymous'),
        supabase.from('suppliers').select('name, address, representative_name, occupation, phone, email, website, verification_method, is_anonymous'),
      ])

      if (!platformsRes.error) setPlatforms(platformsRes.data || [])
      if (!suppliersRes.error) setSuppliers(suppliersRes.data || [])

      setLoading(false)
    }

    if (user) {
      fetchData()
    }
  }, [user])

  // 仕入先情報を取得
  const getSupplierInfo = (name: string | null): Supplier | null => {
    if (!name) return null
    return suppliers.find(s => s.name === name) || null
  }

  // 販路情報を取得
  const getPlatformInfo = (name: string | null): Platform | null => {
    if (!name) return null
    return platforms.find(p => p.name === name) || null
  }

  // 画像URLを取得（外部URLはプロキシ経由）
  const getImageUrl = (url: string | null): string | null => {
    if (!url) return null
    // Supabase Storage URLはそのまま使用
    if (url.includes('supabase.co/storage')) {
      return url
    }
    // 外部URLはプロキシ経由
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }

  // 有効な日付形式かどうかをチェック
  const isValidDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false
    if (/返品|不明|キャンセル/.test(dateStr)) return false
    return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)
  }

  // 年を抽出（バリデーション付き）
  const extractYear = (dateStr: string | null): number | null => {
    if (!isValidDate(dateStr)) return null
    const year = parseInt(dateStr!.substring(0, 4))
    return year >= 2000 ? year : null
  }

  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    // 現在の年を必ず追加
    years.add(new Date().getFullYear())
    inventory.forEach(item => {
      const purchaseYear = extractYear(item.purchase_date)
      if (purchaseYear) years.add(purchaseYear)
      const saleYear = extractYear(item.sale_date)
      if (saleYear) years.add(saleYear)
    })
    return ['all' as const, ...Array.from(years).sort((a, b) => b - a)]
  }, [inventory])

  // フィルタリングされたデータ（受入ベースで作成、払出情報も含める）
  const ledgerData = useMemo(() => {
    return inventory
      .filter(item => {
        if (!isValidDate(item.purchase_date)) return false
        if (selectedYear === 'all') return true
        const year = extractYear(item.purchase_date)
        if (!year || year !== selectedYear) return false
        if (selectedMonth !== 'all') {
          const month = parseInt(item.purchase_date!.substring(5, 7))
          if (month !== selectedMonth) return false
        }
        return true
      })
      .map((item, index) => {
        const supplierInfo = getSupplierInfo(item.purchase_source)
        const platformInfo = getPlatformInfo(item.sale_destination)
        // 売却日または販売先があれば払出済みとみなす
        const isSold = !!(item.sale_date || item.sale_destination)

        return {
          ...item,
          no: index + 1,
          supplierInfo,
          platformInfo,
          isSold,
        }
      })
  }, [inventory, selectedYear, selectedMonth, suppliers, platforms])

  // CSVエクスポート
  const exportCSV = () => {
    const headers = [
      'No',
      // 受入
      '受入_年月日', '受入_区別', '受入_品目', '受入_代価', '受入_数量',
      '受入_相手の確認方法', '受入_住所', '受入_氏名', '受入_職業', '受入_電話番号', '受入_メールアドレス', '受入_ホームページアドレス',
      // 払出
      '払出_年月日', '払出_区別', '払出_代価', '払出_住所', '払出_氏名', '払出_販路',
      // 共通
      '商品画像URL'
    ]

    const rows: string[][] = []

    ledgerData.forEach(item => {
      const sInfo = item.supplierInfo
      const pInfo = item.platformInfo
      rows.push([
        String(item.no),
        // 受入
        item.purchase_date || '',
        '仕入',
        item.product_name,
        String(item.purchase_total || item.purchase_price || ''),
        '1',
        sInfo?.verification_method || '',
        sInfo?.address || '',
        sInfo?.representative_name || '',
        sInfo?.occupation || '',
        sInfo?.phone || '',
        sInfo?.email || '',
        sInfo?.website || '',
        // 払出
        item.isSold ? (item.sale_date || '') : '',
        item.isSold ? '売却' : '',
        item.isSold ? String(item.deposit_amount || item.sale_price || '') : '',
        item.isSold ? (pInfo?.address || '') : '',
        item.isSold ? (pInfo?.representative_name || '') : '',
        item.isSold ? (item.sale_destination || '') : '',
        // 共通
        item.image_url || item.saved_image_url || ''
      ])
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `古物台帳_${selectedYear}年${selectedMonth === 'all' ? '' : selectedMonth + '月'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">古物台帳</h1>
            <div className="flex items-center gap-4">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
              >
                {availableYears.length > 0 ? (
                  availableYears.map(year => (
                    <option key={year} value={year}>{year === 'all' ? '全て' : `${year}年`}</option>
                  ))
                ) : (
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}年</option>
                )}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
              >
                <option value="all">全月</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}月</option>
                ))}
              </select>
              <button
                onClick={exportCSV}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                CSVエクスポート
              </button>
            </div>
          </div>

          {/* 古物台帳テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                {/* ヘッダー行1 - グループヘッダー */}
                <tr className="bg-gray-200">
                  <th className="border border-gray-400 px-2 py-1" rowSpan={2}></th>
                  <th className="border border-gray-400 px-2 py-1 bg-blue-100 text-center text-black font-bold" colSpan={12}>受入</th>
                  <th className="border border-gray-400 px-2 py-1 bg-green-100 text-center text-black font-bold" colSpan={6}>払出</th>
                </tr>
                {/* ヘッダー行2 - サブグループ */}
                <tr className="bg-gray-100">
                  {/* 受入 - 取引した古物 */}
                  <th className="border border-gray-400 px-2 py-1 bg-blue-50 text-center text-black font-bold" colSpan={5}>取引した古物</th>
                  {/* 受入 - 取引した相手方 */}
                  <th className="border border-gray-400 px-2 py-1 bg-blue-50 text-center text-black font-bold" colSpan={7}>取引した相手方</th>
                  {/* 払出 */}
                  <th className="border border-gray-400 px-2 py-1 bg-green-50 text-center text-black font-bold" colSpan={4}>取引の相手方</th>
                  <th className="border border-gray-400 px-2 py-1 bg-green-50 text-center" colSpan={2}></th>
                </tr>
                {/* ヘッダー行3 - 詳細ヘッダー */}
                <tr className="bg-gray-50">
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap">No</th>
                  {/* 受入 - 取引した古物 */}
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">年月日</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">区別</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">品目</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">代価</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">数量</th>
                  {/* 受入 - 取引した相手方 */}
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">相手の確認方法</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">住所</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">氏名</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">職業</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">電話番号</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">メールアドレス</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-blue-50">ホームページアドレス</th>
                  {/* 払出 - 取引の相手方 */}
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-green-50">年月日</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-green-50">区別</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-green-50">代価</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-green-50">住所</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-green-50">氏名</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap bg-green-50">販路</th>
                  {/* 共通 */}
                  <th className="border border-gray-400 px-2 py-1 text-center font-bold text-black whitespace-nowrap">商品画像</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="border border-gray-400 px-4 py-8 text-center text-black">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  ledgerData.map((item) => {
                    const sInfo = item.supplierInfo
                    const pInfo = item.platformInfo
                    const rawImageUrl = item.image_url || item.saved_image_url
                    const imageUrl = getImageUrl(rawImageUrl)
                    return (
                      <tr key={item.id} className="hover:bg-gray-100">
                        <td className="border border-gray-300 px-2 py-1 text-center text-black font-medium">{item.no}</td>
                        {/* 受入 - 取引した古物 */}
                        <td className="border border-gray-300 px-2 py-1 text-black whitespace-nowrap bg-blue-50/50">{item.purchase_date}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black bg-blue-50/50">仕入</td>
                        <td className="border border-gray-300 px-2 py-1 text-black font-medium max-w-[150px] truncate bg-blue-50/50" title={item.product_name}>{item.product_name}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right text-black font-medium bg-blue-50/50">¥{(item.purchase_total || item.purchase_price)?.toLocaleString() || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center text-black bg-blue-50/50">1</td>
                        {/* 受入 - 取引した相手方 */}
                        <td className="border border-gray-300 px-2 py-1 text-black bg-blue-50/50">{sInfo?.verification_method || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black max-w-[120px] truncate bg-blue-50/50" title={sInfo?.address || ''}>{sInfo?.address || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black bg-blue-50/50">{sInfo?.representative_name || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black bg-blue-50/50">{sInfo?.occupation || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black bg-blue-50/50">{sInfo?.phone || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black max-w-[120px] truncate bg-blue-50/50" title={sInfo?.email || ''}>{sInfo?.email || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black max-w-[100px] truncate bg-blue-50/50" title={sInfo?.website || ''}>{sInfo?.website || '-'}</td>
                        {/* 払出 - 取引の相手方 */}
                        <td className="border border-gray-300 px-2 py-1 text-black whitespace-nowrap bg-green-50/50">{item.isSold ? item.sale_date : '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black bg-green-50/50">{item.isSold ? '売却' : '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right text-black font-medium bg-green-50/50">{item.isSold ? `¥${(item.deposit_amount || item.sale_price)?.toLocaleString() || '-'}` : '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black max-w-[120px] truncate bg-green-50/50" title={pInfo?.address || ''}>{item.isSold ? (pInfo?.address || '-') : '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black bg-green-50/50">{item.isSold ? (pInfo?.representative_name || '-') : '-'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-black bg-green-50/50">{item.isSold ? (item.sale_destination || '-') : '-'}</td>
                        {/* 共通 */}
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt="商品"
                              className="w-10 h-10 object-cover mx-auto cursor-pointer hover:opacity-80"
                              onClick={() => setEnlargedImage(imageUrl)}
                            />
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 件数サマリー */}
          <div className="mt-4 text-sm text-gray-600">
            <span>受入: {ledgerData.length}件</span>
            <span className="mx-4">|</span>
            <span>払出: {ledgerData.filter(item => item.isSold).length}件</span>
          </div>

          {/* 注記 */}
          <div className="mt-6 text-xs text-gray-500">
            <p>* 相手方情報は「設定」→「仕入先・販路マスタ設定」で登録できます。</p>
            <p>* 匿名取引（フリマアプリ等）の場合は、販路/仕入先の情報のみ記録されます。</p>
          </div>
        </div>
      </div>

      {/* 画像拡大モーダル */}
      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-[200] flex items-center justify-center cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={enlargedImage}
              alt="拡大画像"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-2 right-2 bg-white rounded-full w-8 h-8 flex items-center justify-center text-black font-bold hover:bg-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
