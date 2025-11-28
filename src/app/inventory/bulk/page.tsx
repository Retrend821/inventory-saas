'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type BulkPurchase = {
  id: string
  genre: string
  purchase_date: string
  purchase_source: string | null
  total_amount: number
  total_quantity: number
  purchase_price: number | null
  memo: string | null
  created_at: string
}

type BulkSale = {
  id: string
  bulk_purchase_id: string
  sale_date: string
  sale_destination: string | null
  quantity: number
  sale_amount: number
  commission: number
  shipping_cost: number
  memo: string | null
  created_at: string
  // 商品詳細（単品と同じ形式）
  product_name: string | null
  brand_name: string | null
  category: string | null
  image_url: string | null
  purchase_price: number | null
  other_cost: number | null
  deposit_amount: number | null
  listing_date: string | null
}

type Supplier = {
  id: string
  name: string
  is_active: boolean
  color_class: string
}

type Platform = {
  id: string
  name: string
  is_active: boolean
  color_class: string
}

export default function BulkInventoryPage() {
  const [bulkPurchases, setBulkPurchases] = useState<BulkPurchase[]>([])
  const [bulkSales, setBulkSales] = useState<BulkSale[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<BulkPurchase | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [selectedGenre, setSelectedGenre] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'purchases' | 'sales'>('sales')

  // 編集機能用ステート
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof BulkSale | keyof BulkPurchase; type: 'sale' | 'purchase' } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const editCellRef = useRef<HTMLDivElement>(null)

  // 新規まとめ仕入れフォーム
  const [newPurchase, setNewPurchase] = useState({
    genre: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_source: '',
    total_amount: '',
    total_quantity: '',
    memo: ''
  })

  // 売上登録フォーム（単品と同じ形式）
  const [newSale, setNewSale] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    sale_destination: '',
    quantity: '1',
    sale_amount: '',
    commission: '',
    shipping_cost: '',
    memo: '',
    // 商品詳細
    product_name: '',
    brand_name: '',
    category: '',
    image_url: '',
    purchase_price: '',
    other_cost: '',
    deposit_amount: '',
    listing_date: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // まとめ仕入れデータ取得
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('bulk_purchases')
      .select('*')
      .order('purchase_date', { ascending: false })

    if (purchaseError) {
      console.error('Error fetching bulk purchases:', purchaseError)
    } else {
      setBulkPurchases(purchaseData || [])
    }

    // 売上データ取得
    const { data: salesData, error: salesError } = await supabase
      .from('bulk_sales')
      .select('*')
      .order('sale_date', { ascending: false })

    if (salesError) {
      console.error('Error fetching bulk sales:', salesError)
    } else {
      setBulkSales(salesData || [])
    }

    // 仕入先マスタ取得
    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('id, name, is_active, color_class')
      .eq('is_active', true)
      .order('sort_order')

    setSuppliers(supplierData || [])

    // 販路マスタ取得
    const { data: platformData } = await supabase
      .from('platforms')
      .select('id, name, is_active, color_class')
      .eq('is_active', true)
      .order('sort_order')

    setPlatforms(platformData || [])

    setLoading(false)
  }

  // 各まとめ仕入れの集計データを計算
  const purchaseStats = useMemo(() => {
    const stats = new Map<string, {
      soldQuantity: number
      totalSales: number
      totalCommission: number
      totalShipping: number
    }>()

    bulkSales.forEach(sale => {
      const current = stats.get(sale.bulk_purchase_id) || {
        soldQuantity: 0,
        totalSales: 0,
        totalCommission: 0,
        totalShipping: 0
      }

      stats.set(sale.bulk_purchase_id, {
        soldQuantity: current.soldQuantity + sale.quantity,
        totalSales: current.totalSales + sale.sale_amount,
        totalCommission: current.totalCommission + sale.commission,
        totalShipping: current.totalShipping + sale.shipping_cost
      })
    })

    return stats
  }, [bulkSales])

  // 販路・仕入先の色マップ
  const platformColors: Record<string, string> = useMemo(() => {
    const colors: Record<string, string> = {}
    platforms.forEach(p => {
      colors[p.name] = p.color_class
    })
    suppliers.forEach(s => {
      colors[s.name] = s.color_class
    })
    return colors
  }, [platforms, suppliers])

  // ジャンル一覧を取得
  const genres = useMemo(() => {
    const genreSet = new Set<string>()
    bulkPurchases.forEach(p => genreSet.add(p.genre))
    return Array.from(genreSet).sort()
  }, [bulkPurchases])

  // ジャンルでフィルタされたpurchases
  const filteredPurchases = useMemo(() => {
    if (selectedGenre === 'all') return bulkPurchases
    return bulkPurchases.filter(p => p.genre === selectedGenre)
  }, [bulkPurchases, selectedGenre])

  // 選択中ジャンルのサマリー計算
  const genreSummary = useMemo(() => {
    const targetPurchases = filteredPurchases

    let totalPurchaseAmount = 0
    let totalQuantity = 0
    let soldQuantity = 0
    let totalSales = 0
    let totalCommission = 0
    let totalShipping = 0

    targetPurchases.forEach(purchase => {
      totalPurchaseAmount += purchase.total_amount
      totalQuantity += purchase.total_quantity

      const stats = purchaseStats.get(purchase.id)
      if (stats) {
        soldQuantity += stats.soldQuantity
        totalSales += stats.totalSales
        totalCommission += stats.totalCommission
        totalShipping += stats.totalShipping
      }
    })

    const remainingQuantity = totalQuantity - soldQuantity
    const netProfit = totalSales - totalCommission - totalShipping - totalPurchaseAmount
    const profitRate = totalPurchaseAmount > 0 ? Math.round((netProfit / totalPurchaseAmount) * 100) : 0
    const recoveryRate = totalPurchaseAmount > 0 ? Math.round(((totalSales - totalCommission - totalShipping) / totalPurchaseAmount) * 100) : 0

    return {
      totalPurchaseAmount,
      totalQuantity,
      soldQuantity,
      remainingQuantity,
      totalSales,
      totalCommission,
      totalShipping,
      netProfit,
      profitRate,
      recoveryRate
    }
  }, [filteredPurchases, purchaseStats])

  // フィルタされた売上一覧（売上一覧モード用）
  const filteredSales = useMemo(() => {
    const purchaseIds = new Set(filteredPurchases.map(p => p.id))
    return bulkSales.filter(sale => purchaseIds.has(sale.bulk_purchase_id))
  }, [bulkSales, filteredPurchases])

  // 売上に紐づく仕入れ情報を取得
  const getPurchaseForSale = useCallback((bulkPurchaseId: string) => {
    return bulkPurchases.find(p => p.id === bulkPurchaseId)
  }, [bulkPurchases])

  // 仕入れと販売を混合したリスト（通算計算モード用）
  type MixedRow = {
    id: string
    type: 'purchase' | 'sale'
    date: string
    genre: string
    brandName: string | null
    productName: string | null
    saleDestination: string | null
    purchaseAmount: number  // 仕入れ額（仕入れ行の場合）
    saleAmount: number      // 売上額（販売行の場合）
    commission: number
    shippingCost: number
    profit: number          // その行の損益
    purchaseData?: BulkPurchase
    saleData?: BulkSale
  }

  const mixedRows = useMemo(() => {
    const rows: MixedRow[] = []

    // 仕入れ行を追加
    filteredPurchases.forEach(purchase => {
      rows.push({
        id: `purchase-${purchase.id}`,
        type: 'purchase',
        date: purchase.purchase_date,
        genre: purchase.genre,
        brandName: null,
        productName: purchase.memo || `${purchase.genre}（${purchase.total_quantity}点）`,
        saleDestination: null,
        purchaseAmount: purchase.total_amount,
        saleAmount: 0,
        commission: 0,
        shippingCost: 0,
        profit: -purchase.total_amount,
        purchaseData: purchase
      })
    })

    // 販売行を追加
    filteredSales.forEach(sale => {
      const purchase = getPurchaseForSale(sale.bulk_purchase_id)
      const depositAmount = sale.deposit_amount ?? (sale.sale_amount - sale.commission - sale.shipping_cost)
      rows.push({
        id: `sale-${sale.id}`,
        type: 'sale',
        date: sale.sale_date,
        genre: sale.category || purchase?.genre || '',
        brandName: sale.brand_name,
        productName: sale.product_name,
        saleDestination: sale.sale_destination,
        purchaseAmount: 0,
        saleAmount: sale.sale_amount,
        commission: sale.commission,
        shippingCost: sale.shipping_cost,
        profit: depositAmount,
        saleData: sale,
        purchaseData: purchase
      })
    })

    // 日付でソート
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // 累計利益を計算
    let cumulative = 0
    rows.forEach(row => {
      cumulative += row.profit
      ;(row as MixedRow & { cumulativeProfit: number }).cumulativeProfit = cumulative
    })

    return rows as (MixedRow & { cumulativeProfit: number })[]
  }, [filteredPurchases, filteredSales, getPurchaseForSale])

  // 新規まとめ仕入れ登録
  const handleAddPurchase = async () => {
    if (!newPurchase.genre || !newPurchase.total_amount || !newPurchase.total_quantity) {
      alert('ジャンル、仕入総額、総数量は必須です')
      return
    }

    const { error } = await supabase
      .from('bulk_purchases')
      .insert({
        genre: newPurchase.genre,
        purchase_date: newPurchase.purchase_date,
        purchase_source: newPurchase.purchase_source || null,
        total_amount: parseInt(newPurchase.total_amount),
        total_quantity: parseInt(newPurchase.total_quantity),
        memo: newPurchase.memo || null
      })

    if (error) {
      console.error('Error adding bulk purchase:', error)
      alert('登録に失敗しました')
    } else {
      setShowAddModal(false)
      setNewPurchase({
        genre: '',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_source: '',
        total_amount: '',
        total_quantity: '',
        memo: ''
      })
      fetchData()
    }
  }

  // 売上登録
  const handleAddSale = async () => {
    if (!selectedPurchase || !newSale.quantity || !newSale.sale_amount) {
      alert('販売数量と売上額は必須です')
      return
    }

    const { error } = await supabase
      .from('bulk_sales')
      .insert({
        bulk_purchase_id: selectedPurchase.id,
        sale_date: newSale.sale_date,
        sale_destination: newSale.sale_destination || null,
        quantity: parseInt(newSale.quantity),
        sale_amount: parseInt(newSale.sale_amount),
        commission: parseInt(newSale.commission) || 0,
        shipping_cost: parseInt(newSale.shipping_cost) || 0,
        memo: newSale.memo || null,
        // 商品詳細
        product_name: newSale.product_name || null,
        brand_name: newSale.brand_name || null,
        category: newSale.category || null,
        image_url: newSale.image_url || null,
        purchase_price: newSale.purchase_price ? parseInt(newSale.purchase_price) : null,
        other_cost: newSale.other_cost ? parseInt(newSale.other_cost) : 0,
        deposit_amount: newSale.deposit_amount ? parseInt(newSale.deposit_amount) : null,
        listing_date: newSale.listing_date || null
      })

    if (error) {
      console.error('Error adding sale:', error)
      alert('登録に失敗しました')
    } else {
      setShowSaleModal(false)
      setSelectedPurchase(null)
      setNewSale({
        sale_date: new Date().toISOString().split('T')[0],
        sale_destination: '',
        quantity: '1',
        sale_amount: '',
        commission: '',
        shipping_cost: '',
        memo: '',
        product_name: '',
        brand_name: '',
        category: '',
        image_url: '',
        purchase_price: '',
        other_cost: '',
        deposit_amount: '',
        listing_date: ''
      })
      fetchData()
    }
  }

  // まとめ仕入れ削除
  const handleDeletePurchase = async (id: string) => {
    if (!confirm('このまとめ仕入れを削除しますか？関連する売上データも削除されます。')) {
      return
    }

    const { error } = await supabase
      .from('bulk_purchases')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting bulk purchase:', error)
      alert('削除に失敗しました')
    } else {
      fetchData()
    }
  }

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }

  // 特定のまとめ仕入れの売上履歴
  const getSalesForPurchase = (purchaseId: string) => {
    return bulkSales.filter(sale => sale.bulk_purchase_id === purchaseId)
  }

  // セルクリックで編集開始（販売用）
  const handleSaleCellClick = (sale: BulkSale, field: keyof BulkSale) => {
    if (editingCell?.id === sale.id && editingCell?.field === field && editingCell?.type === 'sale') return

    // 先に現在の編集を保存
    if (editingCell) {
      saveEditingCell()
    }

    const value = sale[field]
    setEditValue(value !== null && value !== undefined ? String(value) : '')
    setEditingCell({ id: sale.id, field, type: 'sale' })
  }

  // セルクリックで編集開始（仕入れ用）
  const handlePurchaseCellClick = (purchase: BulkPurchase, field: keyof BulkPurchase) => {
    if (editingCell?.id === purchase.id && editingCell?.field === field && editingCell?.type === 'purchase') return

    // 先に現在の編集を保存
    if (editingCell) {
      saveEditingCell()
    }

    const value = purchase[field]
    setEditValue(value !== null && value !== undefined ? String(value) : '')
    setEditingCell({ id: purchase.id, field: field as keyof BulkSale | keyof BulkPurchase, type: 'purchase' })
  }

  // 編集内容を保存
  const saveEditingCell = useCallback(async () => {
    if (!editingCell) return

    const { id, field, type } = editingCell

    if (type === 'sale') {
      // 販売の保存
      const sale = bulkSales.find(s => s.id === id)
      if (!sale) {
        setEditingCell(null)
        return
      }

      let newValue: string | number | null = editValue

      // 数値フィールドの変換
      const numericFields = ['quantity', 'sale_amount', 'commission', 'shipping_cost', 'purchase_price', 'other_cost', 'deposit_amount']
      if (numericFields.includes(field)) {
        newValue = editValue ? parseInt(editValue) : null
      }

      // 変更がない場合はスキップ
      const currentValue = sale[field as keyof BulkSale]
      if (String(currentValue ?? '') === String(newValue ?? '')) {
        setEditingCell(null)
        return
      }

      const { error } = await supabase
        .from('bulk_sales')
        .update({ [field]: newValue })
        .eq('id', id)

      if (error) {
        console.error('Error updating sale:', error)
      } else {
        setBulkSales(prev => prev.map(s =>
          s.id === id ? { ...s, [field]: newValue } : s
        ))
      }
    } else {
      // 仕入れの保存
      const purchase = bulkPurchases.find(p => p.id === id)
      if (!purchase) {
        setEditingCell(null)
        return
      }

      let newValue: string | number | null = editValue

      // 数値フィールドの変換
      const numericFields = ['total_amount', 'total_quantity', 'purchase_price']
      if (numericFields.includes(field)) {
        newValue = editValue ? parseInt(editValue) : null
      }

      // 変更がない場合はスキップ
      const currentValue = purchase[field as keyof BulkPurchase]
      if (String(currentValue ?? '') === String(newValue ?? '')) {
        setEditingCell(null)
        return
      }

      const { error } = await supabase
        .from('bulk_purchases')
        .update({ [field]: newValue })
        .eq('id', id)

      if (error) {
        console.error('Error updating purchase:', error)
      } else {
        setBulkPurchases(prev => prev.map(p =>
          p.id === id ? { ...p, [field]: newValue } : p
        ))
      }
    }

    setEditingCell(null)
  }, [editingCell, editValue, bulkSales, bulkPurchases])

  // セレクトボックス専用の即時保存（販売先など）
  const handleSelectChange = async (saleId: string, field: keyof BulkSale, value: string) => {
    const newValue = value || null

    const { error } = await supabase
      .from('bulk_sales')
      .update({ [field]: newValue })
      .eq('id', saleId)

    if (error) {
      console.error('Error updating sale:', error)
    } else {
      setBulkSales(prev => prev.map(s =>
        s.id === saleId ? { ...s, [field]: newValue } : s
      ))
    }
    setEditingCell(null)
  }

  // キー入力処理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // IME変換中は処理しない（変換確定のEnterで編集モードを終了しないように）
    if (e.nativeEvent.isComposing) return

    if (e.key === 'Enter') {
      e.preventDefault()
      saveEditingCell()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      saveEditingCell()
    }
  }

  // 外側クリックで保存
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingCell && editCellRef.current && !editCellRef.current.contains(e.target as Node)) {
        saveEditingCell()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCell, saveEditingCell])

  // 入力タイプ判定
  const getInputType = (field: keyof BulkSale): 'text' | 'number' | 'date' | 'sale_destination' => {
    const numericFields = ['quantity', 'sale_amount', 'commission', 'shipping_cost', 'purchase_price', 'other_cost', 'deposit_amount']
    const dateFields = ['sale_date', 'listing_date']

    if (numericFields.includes(field)) return 'number'
    if (dateFields.includes(field)) return 'date'
    if (field === 'sale_destination') return 'sale_destination'
    return 'text'
  }

  // セルの編集可能判定
  const isEditableField = (field: string): field is keyof BulkSale => {
    const editableFields = [
      'product_name', 'brand_name', 'category', 'image_url',
      'sale_destination', 'sale_amount', 'commission', 'shipping_cost',
      'purchase_price', 'other_cost', 'deposit_amount',
      'listing_date', 'sale_date', 'memo'
    ]
    return editableFields.includes(field)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">まとめ仕入れ在庫一覧</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            新規まとめ仕入れ登録
          </button>
        </div>

        {/* 表示モード切替 */}
        {!loading && bulkPurchases.length > 0 && (
          <div className="mb-6 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">原価回収モード:</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('sales')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'sales'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                通算で計算
              </button>
              <button
                onClick={() => setViewMode('purchases')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'purchases'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                仕入れ別に計算
              </button>
            </div>
          </div>
        )}

        {/* ジャンルタブ */}
        {!loading && genres.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedGenre('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedGenre === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              すべて ({bulkPurchases.length})
            </button>
            {genres.map(genre => {
              const count = bulkPurchases.filter(p => p.genre === genre).length
              return (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedGenre === genre
                      ? 'bg-slate-700 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {genre} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* ジャンルサマリー */}
        {!loading && filteredPurchases.length > 0 && (
          <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                {selectedGenre === 'all' ? '全体' : selectedGenre} サマリー
              </h3>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                genreSummary.recoveryRate >= 100
                  ? 'bg-green-100 text-green-700'
                  : genreSummary.recoveryRate >= 50
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}>
                回収率 {genreSummary.recoveryRate}%
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs">仕入総額</div>
                <div className="font-bold text-gray-900">¥{genreSummary.totalPurchaseAmount.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs">総数量</div>
                <div className="font-bold text-gray-900">{genreSummary.totalQuantity}点</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs">販売済</div>
                <div className="font-bold text-blue-600">{genreSummary.soldQuantity}点</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs">残り</div>
                <div className="font-bold text-orange-600">{genreSummary.remainingQuantity}点</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs">売上総額</div>
                <div className="font-bold text-gray-900">¥{genreSummary.totalSales.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs">手数料+送料</div>
                <div className="font-bold text-gray-600">¥{(genreSummary.totalCommission + genreSummary.totalShipping).toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs">純利益</div>
                <div className={`font-bold ${genreSummary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{genreSummary.netProfit.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs">利益率</div>
                <div className={`font-bold ${genreSummary.profitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {genreSummary.profitRate}%
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            読み込み中...
          </div>
        ) : bulkPurchases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            まとめ仕入れデータがありません
          </div>
        ) : viewMode === 'sales' ? (
          /* 通算計算モード - 仕入れと販売を混合表示 */
          <div>
            {/* 行追加ボタン */}
            <div className="mb-3 flex items-center gap-3">
              <button
                onClick={async () => {
                  const defaultPurchase = filteredPurchases[0]
                  if (!defaultPurchase) {
                    alert('仕入れデータがありません')
                    return
                  }
                  const { error } = await supabase
                    .from('bulk_sales')
                    .insert({
                      bulk_purchase_id: defaultPurchase.id,
                      sale_date: new Date().toISOString().split('T')[0],
                      sale_destination: null,
                      quantity: 1,
                      sale_amount: 0,
                      commission: 0,
                      shipping_cost: 0,
                      memo: null,
                      product_name: null,
                      brand_name: null,
                      category: null,
                      image_url: null,
                      purchase_price: null,
                      other_cost: 0,
                      deposit_amount: null,
                      listing_date: null
                    })
                  if (error) {
                    alert('エラー: ' + error.message)
                    return
                  }
                  fetchData()
                }}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                販売行を追加
              </button>
            </div>

            {mixedRows.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                データがありません
              </div>
            ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse table-fixed" style={{ minWidth: '1600px' }}>
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[40px]">No.</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[90px]">日付</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[60px]">種別</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[50px]">画像</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">ジャンル</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[100px]">ブランド</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[180px]">商品名</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">仕入先</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">販売先</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">売値</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[70px]">手数料</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[70px]">送料</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[70px]">その他</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">正味<br/>仕入値</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">仕入<br/>総額</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">入金額</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">利益</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[60px]">利益率</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-white whitespace-nowrap w-[50px]">削除</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mixedRows.map((row, index) => {
                      const isPurchase = row.type === 'purchase'
                      const destColor = row.saleDestination ? platformColors[row.saleDestination] : null
                      const sale = row.saleData
                      const purchase = row.purchaseData

                      // 汎用編集セルレンダリング（tdごとクリック可能）
                      const renderCell = (
                        field: string,
                        displayValue: string,
                        dataType: 'sale' | 'purchase',
                        inputType: 'text' | 'number' | 'date' | 'select' = 'text',
                        extraClass: string = ''
                      ) => {
                        const targetId = dataType === 'sale' ? sale?.id : purchase?.id
                        const isEditing = editingCell?.id === targetId && editingCell?.field === field && editingCell?.type === dataType

                        const handleClick = () => {
                          if (dataType === 'sale' && sale) {
                            handleSaleCellClick(sale, field as keyof BulkSale)
                          } else if (dataType === 'purchase' && purchase) {
                            handlePurchaseCellClick(purchase, field as keyof BulkPurchase)
                          }
                        }

                        if (isEditing) {
                          if (inputType === 'select') {
                            return (
                              <td className={`px-2 py-1 border-r border-gray-100 ${extraClass}`}>
                                <div ref={editCellRef}>
                                  <select
                                    value={editValue}
                                    onChange={(e) => {
                                      setEditValue(e.target.value)
                                      setTimeout(() => saveEditingCell(), 0)
                                    }}
                                    onKeyDown={handleKeyDown}
                                    className="w-full px-1 py-0.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                  >
                                    <option value="">-</option>
                                    {platforms.map(p => (
                                      <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            )
                          }
                          return (
                            <td className={`px-2 py-1 border-r border-gray-100 ${extraClass}`}>
                              <div ref={editCellRef}>
                                <input
                                  type={inputType}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  className="w-full px-1 py-0.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  autoFocus
                                />
                              </div>
                            </td>
                          )
                        }

                        return (
                          <td
                            className={`px-2 py-1 border-r border-gray-100 cursor-pointer hover:bg-blue-50 ${extraClass}`}
                            onClick={handleClick}
                          >
                            {displayValue}
                          </td>
                        )
                      }

                      // 斜線スタイル
                      const stripeStyle = { background: 'repeating-linear-gradient(135deg, #e5e7eb, #e5e7eb 4px, #d1d5db 4px, #d1d5db 8px)' }

                      // 入金額計算
                      const depositAmount = sale ? (sale.deposit_amount ?? (sale.sale_amount - sale.commission - sale.shipping_cost)) : 0

                      // 利益率計算
                      const profitRate = sale && sale.purchase_price && sale.purchase_price > 0
                        ? Math.round((depositAmount - sale.purchase_price) / sale.purchase_price * 100)
                        : 0

                      return (
                        <tr key={row.id} className={`hover:bg-gray-50 ${isPurchase ? 'bg-red-50' : 'bg-green-50'}`}>
                          {/* No. */}
                          <td className="px-2 py-1 border-r border-gray-100 text-center text-gray-500">{index + 1}</td>
                          {/* 日付 */}
                          {isPurchase && purchase
                            ? renderCell('purchase_date', row.date, 'purchase', 'date', 'text-gray-900')
                            : sale ? renderCell('sale_date', row.date, 'sale', 'date', 'text-gray-900')
                            : <td className="px-2 py-1 border-r border-gray-100 text-gray-900">{row.date}</td>}
                          {/* 種別 */}
                          <td className="px-2 py-1 border-r border-gray-100 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full ${isPurchase ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {isPurchase ? '仕入' : '販売'}
                            </span>
                          </td>
                          {/* 画像 */}
                          {sale?.image_url ? (
                            <td className="px-2 py-1 border-r border-gray-100 text-center">
                              <img src={sale.image_url} alt="" className="w-8 h-8 object-cover rounded mx-auto cursor-pointer" onClick={() => setEnlargedImage(sale.image_url)} />
                            </td>
                          ) : (
                            <td className="px-2 py-1 border-r border-gray-100 text-center text-gray-400">-</td>
                          )}
                          {/* ジャンル */}
                          {isPurchase && purchase
                            ? renderCell('genre', row.genre || '-', 'purchase', 'text', 'text-gray-900')
                            : sale ? renderCell('category', row.genre || '-', 'sale', 'text', 'text-gray-900')
                            : <td className="px-2 py-1 border-r border-gray-100 text-gray-900">{row.genre}</td>}
                          {/* ブランド */}
                          {sale
                            ? renderCell('brand_name', row.brandName || '-', 'sale', 'text', 'text-gray-900 truncate')
                            : <td className="px-2 py-1 border-r border-gray-100 text-gray-400">-</td>}
                          {/* 商品名 */}
                          {sale
                            ? renderCell('product_name', row.productName || '-', 'sale', 'text', 'text-gray-900 truncate')
                            : isPurchase && purchase
                              ? renderCell('memo', row.productName || '-', 'purchase', 'text', 'text-gray-900 truncate')
                              : <td className="px-2 py-1 border-r border-gray-100">{row.productName || '-'}</td>}
                          {/* 仕入先 */}
                          {isPurchase && purchase?.purchase_source ? (
                            <td className="px-2 py-1 border-r border-gray-100 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full whitespace-nowrap ${platformColors[purchase.purchase_source] || 'bg-gray-100 text-gray-800'}`}>
                                {purchase.purchase_source}
                              </span>
                            </td>
                          ) : isPurchase ? (
                            <td className="px-2 py-1 border-r border-gray-100 text-center text-gray-400">-</td>
                          ) : (
                            <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>
                          )}
                          {/* 販売先 */}
                          {sale && row.saleDestination ? (
                            <td className="px-2 py-1 border-r border-gray-100 text-center cursor-pointer hover:bg-blue-50 overflow-hidden" onClick={() => handleSaleCellClick(sale, 'sale_destination')}>
                              {editingCell?.id === sale.id && editingCell?.field === 'sale_destination' && editingCell?.type === 'sale' ? (
                                <div ref={editCellRef}>
                                  <select value={editValue} onChange={(e) => handleSelectChange(sale.id, 'sale_destination', e.target.value)} onKeyDown={handleKeyDown} className="w-full px-1 py-0.5 text-xs border border-blue-400 rounded bg-white text-gray-900" autoFocus>
                                    <option value="">-</option>
                                    {platforms.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                  </select>
                                </div>
                              ) : (
                                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full max-w-full truncate ${destColor || 'bg-gray-100 text-gray-800'}`} title={row.saleDestination}>{row.saleDestination}</span>
                              )}
                            </td>
                          ) : sale ? (
                            <td className="px-2 py-1 border-r border-gray-100 text-center cursor-pointer hover:bg-blue-50 text-gray-400" onClick={() => handleSaleCellClick(sale, 'sale_destination')}>
                              {editingCell?.id === sale.id && editingCell?.field === 'sale_destination' && editingCell?.type === 'sale' ? (
                                <div ref={editCellRef}>
                                  <select value={editValue} onChange={(e) => handleSelectChange(sale.id, 'sale_destination', e.target.value)} onKeyDown={handleKeyDown} className="w-full px-1 py-0.5 text-xs border border-blue-400 rounded bg-white text-gray-900" autoFocus>
                                    <option value="">-</option>
                                    {platforms.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                  </select>
                                </div>
                              ) : '-'}
                            </td>
                          ) : (
                            <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>
                          )}
                          {/* 売値 */}
                          {sale
                            ? renderCell('sale_amount', sale.sale_amount ? `¥${sale.sale_amount.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-gray-900')
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 手数料 */}
                          {sale
                            ? renderCell('commission', sale.commission ? `¥${sale.commission.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-gray-600')
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 送料 */}
                          {sale
                            ? renderCell('shipping_cost', sale.shipping_cost ? `¥${sale.shipping_cost.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-gray-600')
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* その他 */}
                          {sale
                            ? renderCell('other_cost', sale.other_cost ? `¥${sale.other_cost.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-gray-600')
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 正味仕入値 */}
                          {sale
                            ? renderCell('purchase_price', sale.purchase_price ? `¥${sale.purchase_price.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-orange-600')
                            : isPurchase && purchase
                              ? renderCell('purchase_price', purchase.purchase_price ? `¥${purchase.purchase_price.toLocaleString()}` : '-', 'purchase', 'number', 'text-right text-orange-600')
                              : <td className="px-2 py-1 border-r border-gray-100 text-right text-gray-400">-</td>}
                          {/* 仕入総額 */}
                          {isPurchase && purchase
                            ? renderCell('total_amount', `¥${row.purchaseAmount.toLocaleString()}`, 'purchase', 'number', 'text-right text-red-600 font-medium')
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 入金額 */}
                          {sale
                            ? renderCell('deposit_amount', `¥${depositAmount.toLocaleString()}`, 'sale', 'number', 'text-right text-blue-600')
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 利益 */}
                          <td className={`px-2 py-1 border-r border-gray-100 text-right font-bold ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {row.profit >= 0 ? '+' : ''}¥{row.profit.toLocaleString()}
                          </td>
                          {/* 利益率 */}
                          {sale && sale.purchase_price ? (
                            <td className={`px-2 py-1 border-r border-gray-100 text-right font-bold ${profitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {profitRate >= 0 ? '+' : ''}{profitRate}%
                            </td>
                          ) : (
                            <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>
                          )}
                          {/* 削除 */}
                          <td className="px-2 py-1 text-center">
                            {isPurchase ? (
                              <button
                                onClick={async () => {
                                  if (!confirm('この仕入れを削除しますか？関連する売上も削除されます。')) return
                                  // まず関連する売上を削除
                                  await supabase
                                    .from('bulk_sales')
                                    .delete()
                                    .eq('bulk_purchase_id', row.purchaseData!.id)
                                  // 次に仕入れを削除
                                  const { error } = await supabase
                                    .from('bulk_purchases')
                                    .delete()
                                    .eq('id', row.purchaseData!.id)
                                  if (!error) fetchData()
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!confirm('この売上を削除しますか？')) return
                                  const { error } = await supabase
                                    .from('bulk_sales')
                                    .delete()
                                    .eq('id', row.saleData!.id)
                                  if (!error) fetchData()
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            該当するデータがありません
          </div>
        ) : (
          /* 仕入れごとモード */
          <div className="space-y-4">
            {filteredPurchases.map(purchase => {
              const stats = purchaseStats.get(purchase.id) || {
                soldQuantity: 0,
                totalSales: 0,
                totalCommission: 0,
                totalShipping: 0
              }
              const unitCost = purchase.total_quantity > 0 ? Math.round(purchase.total_amount / purchase.total_quantity) : 0
              const costRecovered = stats.soldQuantity * unitCost
              const remainingCost = Math.max(0, purchase.total_amount - costRecovered)
              const netProfit = stats.totalSales - stats.totalCommission - stats.totalShipping - Math.min(costRecovered, purchase.total_amount)
              const remainingQuantity = purchase.total_quantity - stats.soldQuantity
              const isFullyRecovered = costRecovered >= purchase.total_amount
              const isExpanded = expandedId === purchase.id

              return (
                <div key={purchase.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* ヘッダー */}
                  <div
                    className="px-6 py-4 bg-slate-600 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : purchase.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-white">{purchase.genre}</h2>
                        <span className="text-sm text-slate-300">
                          {formatDate(purchase.purchase_date)} 仕入
                        </span>
                        {purchase.purchase_source && (
                          <span className="text-sm text-slate-300">
                            ({purchase.purchase_source})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {isFullyRecovered ? (
                          <span className="px-3 py-1 bg-green-500 text-white text-sm rounded-full">
                            回収完了
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-yellow-500 text-white text-sm rounded-full">
                            残り {formatCurrency(remainingCost)}
                          </span>
                        )}
                        <svg
                          className={`w-5 h-5 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* サマリー */}
                  <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 border-b border-gray-100">
                    <div>
                      <div className="text-xs text-gray-500">仕入総額</div>
                      <div className="text-lg font-semibold text-gray-900">{formatCurrency(purchase.total_amount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">総数量</div>
                      <div className="text-lg font-semibold text-gray-900">{purchase.total_quantity}個</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">単価</div>
                      <div className="text-lg font-semibold text-gray-900">{formatCurrency(unitCost)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">販売済み</div>
                      <div className="text-lg font-semibold text-gray-900">{stats.soldQuantity}個</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">残り在庫</div>
                      <div className="text-lg font-semibold text-gray-900">{remainingQuantity}個</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">現時点利益</div>
                      <div className={`text-lg font-semibold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(netProfit)}
                      </div>
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div className="px-6 py-3 bg-gray-50 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPurchase(purchase)
                        setShowSaleModal(true)
                      }}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                    >
                      売上登録
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePurchase(purchase.id)
                      }}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      削除
                    </button>
                  </div>

                  {/* 展開時の売上履歴 */}
                  {isExpanded && (
                    <div className="px-6 py-4 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">売上履歴</h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPurchase(purchase)
                            setNewSale({
                              sale_date: new Date().toISOString().split('T')[0],
                              sale_destination: '',
                              quantity: '1',
                              sale_amount: '',
                              commission: '',
                              shipping_cost: '',
                              memo: '',
                              product_name: '',
                              brand_name: '',
                              category: '',
                              image_url: '',
                              purchase_price: '',
                              other_cost: '',
                              deposit_amount: '',
                              listing_date: ''
                            })
                            setShowSaleModal(true)
                          }}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          行を追加
                        </button>
                      </div>
                      {getSalesForPurchase(purchase.id).length === 0 ? (
                        <p className="text-sm text-gray-500">売上履歴がありません</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse table-fixed" style={{ minWidth: '1600px' }}>
                            <thead className="bg-slate-700">
                              <tr>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[40px]">No.</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[50px]">画像</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">ジャンル</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[100px]">ブランド</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[300px]">商品名</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">仕入先</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">販売先</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[70px]">売値</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[60px]">手数料</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[50px]">送料</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[50px]">その他</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[70px]">仕入値</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[70px]">入金額</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[70px]">利益</th>
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[60px]">利益率</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[90px]">出品日</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[90px]">売却日</th>
                                <th className="px-2 py-2 text-left text-xs font-semibold text-white whitespace-nowrap w-[120px]">メモ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {getSalesForPurchase(purchase.id).map((sale, index) => {
                                const purchasePriceVal = sale.purchase_price ?? unitCost * sale.quantity
                                const otherCostVal = sale.other_cost ?? 0
                                // 入金額は登録されていれば使用、なければ売値-手数料-送料
                                const depositAmountVal = sale.deposit_amount ?? (sale.sale_amount - sale.commission - sale.shipping_cost)
                                const saleProfit = depositAmountVal - purchasePriceVal - otherCostVal
                                const profitRate = sale.sale_amount > 0 ? Math.round((saleProfit / sale.sale_amount) * 100) : 0

                                // 仕入先の色取得
                                const sourceColor = purchase.purchase_source ? platformColors[purchase.purchase_source] : null
                                // 販売先の色取得
                                const destColor = sale.sale_destination ? platformColors[sale.sale_destination] : null

                                // 編集可能なセルをレンダリングするヘルパー
                                const renderEditableCell = (field: keyof BulkSale, displayValue: string, align: 'left' | 'right' = 'left', extraClass: string = '') => {
                                  const isEditing = editingCell?.id === sale.id && editingCell?.field === field && editingCell?.type === 'sale'
                                  const inputType = getInputType(field)

                                  return (
                                    <td
                                      className={`px-2 py-1 border-r border-gray-100 cursor-pointer hover:bg-blue-50 relative ${align === 'right' ? 'text-right' : 'text-left'} ${extraClass}`}
                                      onClick={() => handleSaleCellClick(sale, field)}
                                    >
                                      {isEditing ? (
                                        <div ref={editCellRef} className="absolute inset-0 z-50 bg-white p-0.5">
                                          {inputType === 'sale_destination' ? (
                                            <select
                                              value={editValue}
                                              onChange={(e) => {
                                                setEditValue(e.target.value)
                                                setTimeout(() => saveEditingCell(), 0)
                                              }}
                                              onKeyDown={handleKeyDown}
                                              className="w-full h-full px-1 py-0.5 text-sm border-2 border-blue-500 rounded focus:outline-none text-gray-900"
                                              autoFocus
                                            >
                                              <option value="">-</option>
                                              {platforms.map(p => (
                                                <option key={p.id} value={p.name}>{p.name}</option>
                                              ))}
                                            </select>
                                          ) : inputType === 'date' ? (
                                            <input
                                              type="date"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              onKeyDown={handleKeyDown}
                                              className="w-full h-full px-1 py-0.5 text-sm border-2 border-blue-500 rounded focus:outline-none text-gray-900"
                                              style={{ backgroundColor: '#ffffff', color: '#111827' }}
                                              autoFocus
                                              ref={(el) => {
                                                if (el) {
                                                  setTimeout(() => {
                                                    if (document.activeElement === el) {
                                                      try { el.showPicker() } catch {}
                                                    }
                                                  }, 100)
                                                }
                                              }}
                                            />
                                          ) : (
                                            <input
                                              type={inputType}
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              onKeyDown={handleKeyDown}
                                              className={`w-full h-full px-1 py-0.5 text-sm border-2 border-blue-500 rounded focus:outline-none text-gray-900 ${align === 'right' ? 'text-right' : 'text-left'}`}
                                              autoFocus
                                            />
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-900 truncate block">{displayValue}</span>
                                      )}
                                    </td>
                                  )
                                }

                                return (
                                  <tr key={sale.id} className="hover:bg-gray-50">
                                    {/* No. - 編集不可 */}
                                    <td className="px-2 py-1 text-gray-900 border-r border-gray-100">{index + 1}</td>

                                    {/* 画像 - クリックで拡大、ダブルクリックで編集 */}
                                    <td
                                      className="px-2 py-1 border-r border-gray-100 cursor-pointer"
                                      onDoubleClick={() => handleSaleCellClick(sale, 'image_url')}
                                    >
                                      {editingCell?.id === sale.id && editingCell?.field === 'image_url' && editingCell?.type === 'sale' ? (
                                        <div ref={editCellRef} className="absolute z-50 bg-white p-1 shadow-lg rounded border">
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="画像URL"
                                            className="w-48 px-2 py-1 text-sm border-2 border-blue-500 rounded focus:outline-none text-gray-900"
                                            autoFocus
                                          />
                                        </div>
                                      ) : sale.image_url ? (
                                        <img
                                          src={sale.image_url}
                                          alt=""
                                          className="w-10 h-10 object-cover rounded cursor-pointer"
                                          onClick={() => setEnlargedImage(sale.image_url)}
                                        />
                                      ) : (
                                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                                          -
                                        </div>
                                      )}
                                    </td>

                                    {/* ジャンル */}
                                    {renderEditableCell('category', sale.category || purchase.genre, 'left', 'max-w-[80px]')}

                                    {/* ブランド */}
                                    {renderEditableCell('brand_name', sale.brand_name || '-', 'left', 'max-w-[100px]')}

                                    {/* 商品名 */}
                                    {renderEditableCell('product_name', sale.product_name || '-', 'left', 'w-[300px]')}

                                    {/* 仕入先 - チップ表示 */}
                                    <td className="px-2 py-1 border-r border-gray-100">
                                      <div className="flex justify-center">
                                        {purchase.purchase_source ? (
                                          <span className={`inline-flex items-center px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${sourceColor || 'bg-gray-100 text-gray-800'}`}>
                                            {purchase.purchase_source}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 販売先 - チップ表示 */}
                                    <td
                                      className="px-2 py-1 border-r border-gray-100 cursor-pointer hover:bg-blue-50"
                                      onClick={() => handleSaleCellClick(sale, 'sale_destination')}
                                    >
                                      {editingCell?.id === sale.id && editingCell?.field === 'sale_destination' && editingCell?.type === 'sale' ? (
                                        <div ref={editCellRef} className="absolute inset-0 z-50 bg-white p-0.5">
                                          <select
                                            value={editValue}
                                            onChange={(e) => {
                                              setEditValue(e.target.value)
                                              setTimeout(() => saveEditingCell(), 0)
                                            }}
                                            onKeyDown={handleKeyDown}
                                            className="w-full h-full px-1 py-0.5 text-sm border-2 border-blue-500 rounded focus:outline-none text-gray-900"
                                            autoFocus
                                          >
                                            <option value="">-</option>
                                            {platforms.map(p => (
                                              <option key={p.id} value={p.name}>{p.name}</option>
                                            ))}
                                          </select>
                                        </div>
                                      ) : (
                                        <div className="flex justify-center">
                                          {sale.sale_destination ? (
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${destColor || 'bg-gray-100 text-gray-800'}`}>
                                              {sale.sale_destination}
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">-</span>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* 売値 */}
                                    {renderEditableCell('sale_amount', formatCurrency(sale.sale_amount), 'right')}

                                    {/* 手数料 */}
                                    {renderEditableCell('commission', formatCurrency(sale.commission), 'right')}

                                    {/* 送料 */}
                                    {renderEditableCell('shipping_cost', formatCurrency(sale.shipping_cost), 'right')}

                                    {/* その他 */}
                                    {renderEditableCell('other_cost', formatCurrency(otherCostVal), 'right')}

                                    {/* 仕入値 */}
                                    {renderEditableCell('purchase_price', formatCurrency(purchasePriceVal), 'right')}

                                    {/* 入金額 - 計算値を表示（編集可能） */}
                                    {renderEditableCell('deposit_amount', formatCurrency(depositAmountVal), 'right')}

                                    {/* 利益 - 計算値なので編集不可 */}
                                    <td className={`px-2 py-1 text-right font-medium border-r border-gray-100 ${saleProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(saleProfit)}
                                    </td>

                                    {/* 利益率 - 計算値なので編集不可 */}
                                    <td className={`px-2 py-1 text-right border-r border-gray-100 ${profitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {profitRate}%
                                    </td>

                                    {/* 出品日 */}
                                    {renderEditableCell('listing_date', sale.listing_date ? formatDate(sale.listing_date) : '-')}

                                    {/* 売却日 */}
                                    {renderEditableCell('sale_date', formatDate(sale.sale_date))}

                                    {/* メモ */}
                                    {renderEditableCell('memo', sale.memo || '-', 'left', 'max-w-[150px]')}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 新規まとめ仕入れモーダル */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-4">新規まとめ仕入れ登録</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ジャンル *</label>
                  <input
                    type="text"
                    value={newPurchase.genre}
                    onChange={(e) => setNewPurchase({ ...newPurchase, genre: e.target.value })}
                    placeholder="例: ネクタイ、スカーフ"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仕入日 *</label>
                  <input
                    type="date"
                    value={newPurchase.purchase_date}
                    onChange={(e) => setNewPurchase({ ...newPurchase, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仕入先</label>
                  <select
                    value={newPurchase.purchase_source}
                    onChange={(e) => setNewPurchase({ ...newPurchase, purchase_source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">選択してください</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">仕入総額 *</label>
                    <input
                      type="number"
                      value={newPurchase.total_amount}
                      onChange={(e) => setNewPurchase({ ...newPurchase, total_amount: e.target.value })}
                      placeholder="30000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">総数量 *</label>
                    <input
                      type="number"
                      value={newPurchase.total_quantity}
                      onChange={(e) => setNewPurchase({ ...newPurchase, total_quantity: e.target.value })}
                      placeholder="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                {newPurchase.total_amount && newPurchase.total_quantity && (
                  <div className="text-sm text-gray-600 bg-gray-100 p-3 rounded">
                    1個あたり原価: {formatCurrency(Math.round(parseInt(newPurchase.total_amount) / parseInt(newPurchase.total_quantity)))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                  <textarea
                    value={newPurchase.memo}
                    onChange={(e) => setNewPurchase({ ...newPurchase, memo: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddPurchase}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  登録
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 売上登録モーダル */}
        {showSaleModal && selectedPurchase && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-2">売上登録</h2>
              <p className="text-sm text-gray-600 mb-4">{selectedPurchase.genre}</p>

              <div className="space-y-4">
                {/* 商品詳細セクション */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">商品詳細</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">商品名</label>
                      <input
                        type="text"
                        value={newSale.product_name}
                        onChange={(e) => setNewSale({ ...newSale, product_name: e.target.value })}
                        placeholder="商品名を入力"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ブランド</label>
                        <input
                          type="text"
                          value={newSale.brand_name}
                          onChange={(e) => setNewSale({ ...newSale, brand_name: e.target.value })}
                          placeholder="ブランド名"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ジャンル</label>
                        <input
                          type="text"
                          value={newSale.category}
                          onChange={(e) => setNewSale({ ...newSale, category: e.target.value })}
                          placeholder="ジャンル"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">仕入値</label>
                        <input
                          type="number"
                          value={newSale.purchase_price}
                          onChange={(e) => setNewSale({ ...newSale, purchase_price: e.target.value })}
                          placeholder="1000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">その他経費</label>
                        <input
                          type="number"
                          value={newSale.other_cost}
                          onChange={(e) => setNewSale({ ...newSale, other_cost: e.target.value })}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">出品日</label>
                        <input
                          type="date"
                          value={newSale.listing_date}
                          onChange={(e) => setNewSale({ ...newSale, listing_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">入金額</label>
                        <input
                          type="number"
                          value={newSale.deposit_amount}
                          onChange={(e) => setNewSale({ ...newSale, deposit_amount: e.target.value })}
                          placeholder="売上額から自動計算"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">画像URL</label>
                      <input
                        type="text"
                        value={newSale.image_url}
                        onChange={(e) => setNewSale({ ...newSale, image_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                {/* 売上情報セクション */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">売上情報</h3>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">売却日 *</label>
                        <input
                          type="date"
                          value={newSale.sale_date}
                          onChange={(e) => setNewSale({ ...newSale, sale_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">販路</label>
                        <select
                          value={newSale.sale_destination}
                          onChange={(e) => setNewSale({ ...newSale, sale_destination: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                          <option value="">選択してください</option>
                          {platforms.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">販売数量 *</label>
                        <input
                          type="number"
                          value={newSale.quantity}
                          onChange={(e) => setNewSale({ ...newSale, quantity: e.target.value })}
                          placeholder="5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">売上額 *</label>
                        <input
                          type="number"
                          value={newSale.sale_amount}
                          onChange={(e) => setNewSale({ ...newSale, sale_amount: e.target.value })}
                          placeholder="5000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">手数料</label>
                        <input
                          type="number"
                          value={newSale.commission}
                          onChange={(e) => setNewSale({ ...newSale, commission: e.target.value })}
                          placeholder="500"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">送料</label>
                        <input
                          type="number"
                          value={newSale.shipping_cost}
                          onChange={(e) => setNewSale({ ...newSale, shipping_cost: e.target.value })}
                          placeholder="200"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                      <textarea
                        value={newSale.memo}
                        onChange={(e) => setNewSale({ ...newSale, memo: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowSaleModal(false)
                    setSelectedPurchase(null)
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddSale}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  登録
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 画像拡大モーダル */}
        {enlargedImage && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300] cursor-pointer"
            onClick={() => setEnlargedImage(null)}
          >
            <img
              src={enlargedImage}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
