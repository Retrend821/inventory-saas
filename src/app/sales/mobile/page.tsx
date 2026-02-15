'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

type ManualSale = {
  id: string
  inventory_number: string | null
  product_name: string
  brand_name: string | null
  category: string | null
  purchase_price: number | null
  purchase_total: number | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  other_cost: number | null
  deposit_amount: number | null
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  purchase_source: string | null
  sale_destination: string | null
  memo: string | null
  profit: number | null
  profit_rate: number | null
  turnover_days: number | null
  sale_type: 'main' | 'bulk'
  image_url: string | null
  cost_recovered: boolean | null
  created_at: string
}

type Platform = {
  id: string
  name: string
  color_class: string
}

type Supplier = {
  id: string
  name: string
  color_class: string
}

// 表示モード
type ViewMode = 'list' | 'input' | 'edit'

// フォームデータ
type FormData = {
  image_url: string
  product_name: string
  brand_name: string
  category: string
  purchase_source: string
  sale_destination: string
  sale_price: string
  commission: string
  purchase_price: string
  shipping_cost: string
  other_cost: string
  sale_date: string
}

const initialFormData: FormData = {
  image_url: '',
  product_name: '',
  brand_name: '',
  category: '',
  purchase_source: '',
  sale_destination: '',
  sale_price: '',
  commission: '',
  purchase_price: '',
  shipping_cost: '',
  other_cost: '',
  sale_date: new Date().toISOString().split('T')[0],
}

export default function MobileSalesPage() {
  const { user, loading: authLoading, isViewerUser } = useAuth()
  const canEdit = !authLoading && !isViewerUser

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sales, setSales] = useState<ManualSale[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [rakumaCommissionSettings, setRakumaCommissionSettings] = useState<Record<string, number>>({})
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // カテゴリオプション（既存データから動的に生成）
  const categoryOptions = useMemo(() => {
    const uniqueCategories = new Set<string>()
    sales.forEach(sale => {
      if (sale.category) {
        uniqueCategories.add(sale.category)
      }
    })
    return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b, 'ja'))
  }, [sales])

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      // 手入力売上データ取得（直近50件）
      const { data: salesData, error: salesError } = await supabase
        .from('manual_sales')
        .select('*')
        .order('sale_date', { ascending: false })
        .limit(50)

      if (salesError) {
        console.error('Error fetching manual sales:', salesError)
      } else if (salesData) {
        setSales(salesData)
      }

      // プラットフォーム（販路）取得
      const { data: platformData } = await supabase
        .from('platforms')
        .select('id, name, color_class')
        .eq('is_active', true)
        .order('sort_order')
      if (platformData) {
        setPlatforms(platformData)
      }

      // 仕入先取得
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('id, name, color_class')
        .eq('is_active', true)
        .order('sort_order')
      if (supplierData) {
        setSuppliers(supplierData)
      }

      // ラクマ手数料設定取得
      const { data: rakumaData } = await supabase
        .from('rakuma_commission_settings')
        .select('year_month, commission_rate')
      if (rakumaData) {
        const settings: Record<string, number> = {}
        rakumaData.forEach((row: { year_month: string; commission_rate: number }) => {
          settings[row.year_month] = row.commission_rate
        })
        setRakumaCommissionSettings(settings)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  // 手数料自動計算（販売先と売価から）
  const calculateCommission = (destination: string | null, salePrice: number | null, saleDate?: string | null): number | null => {
    if (!destination || !salePrice) return null
    const price = salePrice

    switch (destination) {
      case 'エコオク':
      case 'エレオク':
        // 〜10,000円→550円、〜50,000円→1,100円、50,000円超→2,200円
        if (price <= 10000) return 550
        if (price <= 50000) return 1100
        return 2200
      case 'モノバンク':
        // 5%
        return Math.round(price * 0.05)
      case 'スターバイヤーズ':
        // 固定1,100円
        return 1100
      case 'アプレ':
        // 3%
        return Math.round(price * 0.03)
      case 'タイムレス':
        // 10,000円未満→10%、10,000円以上→5%
        return price < 10000 ? Math.round(price * 0.1) : Math.round(price * 0.05)
      case 'ヤフーフリマ':
      case 'ペイペイ':
        // 5%
        return Math.round(price * 0.05)
      case 'ラクマ': {
        // 売却日がある場合はその月の設定、なければ現在月の設定を使用
        let yearMonth: string
        if (saleDate) {
          const match = saleDate.match(/(\d{4})[-/](\d{1,2})/)
          if (match) {
            yearMonth = `${match[1]}-${match[2].padStart(2, '0')}`
          } else {
            const now = new Date()
            yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          }
        } else {
          const now = new Date()
          yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        }
        const rate = rakumaCommissionSettings[yearMonth] ?? 10 // デフォルト10%
        return Math.round(price * rate / 100)
      }
      case 'メルカリ':
        // 10%
        return Math.round(price * 0.1)
      case 'ヤフオク':
        // 10%
        return Math.round(price * 0.1)
      case 'オークネット':
        // 5%
        return Math.round(price * 0.05)
      default:
        return null
    }
  }

  // 販売先または売価が変更されたときに手数料を再計算
  const handleFieldChange = (field: keyof FormData, value: string) => {
    const newFormData = { ...formData, [field]: value }

    // 販売先または売価が変更された場合、手数料を自動計算
    if (field === 'sale_destination' || field === 'sale_price') {
      const salePrice = field === 'sale_price' ? Number(value) : Number(formData.sale_price)
      const destination = field === 'sale_destination' ? value : formData.sale_destination

      if (destination && salePrice > 0) {
        const commission = calculateCommission(destination, salePrice, formData.sale_date)
        if (commission !== null) {
          newFormData.commission = String(commission)
        }
      }
    }

    setFormData(newFormData)
  }

  // 利益計算
  const calculateProfit = (data: FormData): number | null => {
    const salePrice = Number(data.sale_price) || 0
    const commission = Number(data.commission) || 0
    const purchasePrice = Number(data.purchase_price) || 0
    const shippingCost = Number(data.shipping_cost) || 0
    const otherCost = Number(data.other_cost) || 0

    if (salePrice === 0) return null
    return salePrice - commission - purchasePrice - shippingCost - otherCost
  }

  // 利益率計算
  const calculateProfitRate = (data: FormData): number | null => {
    const salePrice = Number(data.sale_price) || 0
    const profit = calculateProfit(data)
    if (profit === null || salePrice === 0) return null
    return Math.round((profit / salePrice) * 100 * 10) / 10
  }

  // 画像アップロード処理
  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true)
    try {
      // ファイル名を生成
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `manual-sales/${fileName}`

      // Supabase Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('画像のアップロードに失敗しました')
        return
      }

      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      setFormData(prev => ({ ...prev, image_url: publicUrl }))
    } catch (error) {
      console.error('Image upload error:', error)
      alert('画像のアップロードに失敗しました')
    } finally {
      setIsUploadingImage(false)
    }
  }

  // 画像選択ハンドラ
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  // フォーム送信
  const handleSubmit = async () => {
    if (!formData.product_name.trim()) {
      alert('商品名を入力してください')
      return
    }
    if (!formData.sale_destination) {
      alert('販売先を選択してください')
      return
    }

    setSubmitting(true)

    const profit = calculateProfit(formData)
    const profitRate = calculateProfitRate(formData)

    const saleData = {
      product_name: formData.product_name.trim(),
      brand_name: formData.brand_name.trim() || null,
      category: formData.category || null,
      purchase_source: formData.purchase_source || null,
      sale_destination: formData.sale_destination,
      sale_price: Number(formData.sale_price) || null,
      commission: Number(formData.commission) || null,
      purchase_price: Number(formData.purchase_price) || null,
      shipping_cost: Number(formData.shipping_cost) || null,
      other_cost: Number(formData.other_cost) || null,
      sale_date: formData.sale_date || null,
      image_url: formData.image_url || null,
      profit,
      profit_rate: profitRate,
      sale_type: 'main' as const,
    }

    try {
      if (editingId) {
        // 更新
        const { error } = await supabase
          .from('manual_sales')
          .update(saleData)
          .eq('id', editingId)

        if (error) {
          console.error('Update error:', error)
          alert('更新に失敗しました')
          return
        }

        // ローカルの売上リストを更新
        setSales(prev => prev.map(s =>
          s.id === editingId ? { ...s, ...saleData } : s
        ))
      } else {
        // 新規登録
        const { data, error } = await supabase
          .from('manual_sales')
          .insert(saleData)
          .select()
          .single()

        if (error) {
          console.error('Insert error:', error)
          alert('登録に失敗しました')
          return
        }

        // ローカルの売上リストに追加
        if (data) {
          setSales(prev => [data, ...prev])
        }
      }

      // フォームリセットして一覧に戻る
      setFormData(initialFormData)
      setEditingId(null)
      setViewMode('list')
    } catch (error) {
      console.error('Submit error:', error)
      alert('エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  // 編集モードへ
  const handleEdit = (sale: ManualSale) => {
    setFormData({
      image_url: sale.image_url || '',
      product_name: sale.product_name || '',
      brand_name: sale.brand_name || '',
      category: sale.category || '',
      purchase_source: sale.purchase_source || '',
      sale_destination: sale.sale_destination || '',
      sale_price: sale.sale_price?.toString() || '',
      commission: sale.commission?.toString() || '',
      purchase_price: sale.purchase_price?.toString() || '',
      shipping_cost: sale.shipping_cost?.toString() || '',
      other_cost: sale.other_cost?.toString() || '',
      sale_date: sale.sale_date || new Date().toISOString().split('T')[0],
    })
    setEditingId(sale.id)
    setViewMode('edit')
  }

  // 新規入力モードへ
  const handleNewInput = () => {
    setFormData({
      ...initialFormData,
      sale_date: new Date().toISOString().split('T')[0],
    })
    setEditingId(null)
    setViewMode('input')
  }

  // 認証チェック
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">
          <Link href="/login" className="text-blue-600 underline">ログイン</Link>してください
        </div>
      </div>
    )
  }

  // 利益の表示用
  const displayProfit = calculateProfit(formData)
  const displayProfitRate = calculateProfitRate(formData)

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* ヘッダー */}
      <header className="bg-slate-700 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          {viewMode === 'list' ? (
            <>
              <h1 className="text-lg font-bold">売上入力</h1>
              <Link href="/sales/manual" className="text-sm text-blue-300 hover:text-blue-200">
                PC版へ
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setViewMode('list')
                  setFormData(initialFormData)
                  setEditingId(null)
                }}
                className="text-blue-300 hover:text-blue-200 flex items-center gap-1"
              >
                <span>←</span>
                <span>戻る</span>
              </button>
              <h1 className="text-lg font-bold">
                {viewMode === 'edit' ? '売上編集' : '新規売上'}
              </h1>
              <div className="w-12" />
            </>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4">
        {loading ? (
          <div className="text-center text-gray-600 py-8">読み込み中...</div>
        ) : viewMode === 'list' ? (
          // 一覧表示
          <div>
            {/* 新規入力ボタン */}
            {canEdit && (
              <button
                onClick={handleNewInput}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold mb-4 hover:bg-blue-700 transition-colors"
              >
                + 新規売上を登録
              </button>
            )}

            {/* 売上一覧（カード形式） */}
            <div className="space-y-3">
              {sales.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  売上データがありません
                </div>
              ) : (
                sales.map(sale => (
                  <div
                    key={sale.id}
                    onClick={() => canEdit && handleEdit(sale)}
                    className={`bg-white rounded-lg shadow p-4 ${canEdit ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                  >
                    <div className="flex gap-3">
                      {/* 画像 */}
                      <div className="w-16 h-16 bg-gray-200 rounded-md overflow-hidden flex-shrink-0">
                        {sale.image_url ? (
                          <img
                            src={sale.image_url}
                            alt={sale.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </div>

                      {/* 情報 */}
                      <div className="flex-grow min-w-0">
                        <div className="font-bold text-sm truncate">{sale.product_name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {sale.brand_name || '-'} / {sale.category || '-'}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                            {sale.sale_destination || '-'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {sale.sale_date || '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-bold text-blue-600">
                            ¥{sale.sale_price?.toLocaleString() || 0}
                          </span>
                          <span className={`text-sm font-bold ${(sale.profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            利益: ¥{sale.profit?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          // 入力/編集フォーム
          <div className="space-y-4">
            {/* 画像選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">画像</label>
              <div className="flex gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="flex-1 py-3 px-4 bg-gray-200 rounded-lg text-gray-700 text-center hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  {isUploadingImage ? 'アップロード中...' : '📷 カメラ / ギャラリー'}
                </button>
              </div>
              {formData.image_url && (
                <div className="mt-2 relative">
                  <img
                    src={formData.image_url}
                    alt="選択された画像"
                    className="w-full max-h-48 object-contain rounded-lg bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                    className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-sm hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* 商品名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                商品名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.product_name}
                onChange={(e) => handleFieldChange('product_name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="商品名を入力"
              />
            </div>

            {/* ブランド名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ブランド名</label>
              <input
                type="text"
                value={formData.brand_name}
                onChange={(e) => handleFieldChange('brand_name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ブランド名を入力"
              />
            </div>

            {/* ジャンル / 仕入先（2列） */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ジャンル</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleFieldChange('category', e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">選択</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">仕入先</label>
                <select
                  value={formData.purchase_source}
                  onChange={(e) => handleFieldChange('purchase_source', e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">選択</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 販売先 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                販売先 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.sale_destination}
                onChange={(e) => handleFieldChange('sale_destination', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">選択してください</option>
                {platforms.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 売価 / 手数料（2列） */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">売価</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.sale_price}
                    onChange={(e) => handleFieldChange('sale_price', e.target.value)}
                    className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手数料</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.commission}
                    onChange={(e) => handleFieldChange('commission', e.target.value)}
                    className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                    placeholder="自動"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">円</span>
                </div>
              </div>
            </div>

            {/* 原価 / 送料（2列） */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原価</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.purchase_price}
                    onChange={(e) => handleFieldChange('purchase_price', e.target.value)}
                    className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">送料</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.shipping_cost}
                    onChange={(e) => handleFieldChange('shipping_cost', e.target.value)}
                    className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">円</span>
                </div>
              </div>
            </div>

            {/* その他経費 / 売却日（2列） */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">その他経費</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.other_cost}
                    onChange={(e) => handleFieldChange('other_cost', e.target.value)}
                    className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">売却日</label>
                <input
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) => handleFieldChange('sale_date', e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* 利益表示 */}
            {(Number(formData.sale_price) > 0) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">予想利益</span>
                  <span className={`text-xl font-bold ${(displayProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ¥{displayProfit?.toLocaleString() || 0}
                    <span className="text-sm ml-2">
                      ({displayProfitRate ?? 0}%)
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* 登録ボタン */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canEdit}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '処理中...' : (editingId ? '更新する' : '登録する')}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
