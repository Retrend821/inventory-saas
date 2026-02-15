'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

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
  purchase_source: string | null
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
  const { user, isViewerUser, loading: authLoading } = useAuth()
  // 編集可能かどうか（認証読み込み中は編集不可）
  const canEdit = !authLoading && !isViewerUser
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
  const [isInitialized, setIsInitialized] = useState(false)
  const [rakumaCommissionSettings, setRakumaCommissionSettings] = useState<Record<string, number>>({})

  // 編集機能用ステート
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof BulkSale | keyof BulkPurchase; type: 'sale' | 'purchase'; mode?: 'text' | 'dropdown' } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const editCellRef = useRef<HTMLTableCellElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)

  // 複数選択用ステート
  type SelectedCell = { id: string; field: string; type: 'sale' | 'purchase'; rowIndex: number; colIndex: number }
  const [selectedCells, setSelectedCells] = useState<SelectedCell[]>([])
  const [selectionStart, setSelectionStart] = useState<SelectedCell | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<SelectedCell | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

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

  // localStorageから状態を復元
  useEffect(() => {
    const savedGenre = localStorage.getItem('bulk_selectedGenre')
    const savedViewMode = localStorage.getItem('bulk_viewMode')
    if (savedGenre) {
      setSelectedGenre(savedGenre)
    }
    if (savedViewMode === 'purchases' || savedViewMode === 'sales') {
      setViewMode(savedViewMode)
    }
    setIsInitialized(true)
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  // 状態をlocalStorageに保存（初期化完了後のみ）
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('bulk_selectedGenre', selectedGenre)
    }
  }, [selectedGenre, isInitialized])

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('bulk_viewMode', viewMode)
    }
  }, [viewMode, isInitialized])

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

    // ラクマ手数料設定を取得
    const { data: rakumaData } = await supabase
      .from('rakuma_commission_settings')
      .select('*')

    if (rakumaData) {
      const settings: Record<string, number> = {}
      rakumaData.forEach((row: { year_month: string; commission_rate: number }) => {
        settings[row.year_month] = row.commission_rate
      })
      setRakumaCommissionSettings(settings)
    }

    setLoading(false)
  }

  // 各まとめ仕入れの集計データを計算
  const purchaseStats = useMemo(() => {
    const stats = new Map<string, {
      soldQuantity: number
      totalQuantity: number
      totalSales: number
      totalCommission: number
      totalShipping: number
      totalDeposit: number
      totalItemPurchase: number
    }>()

    bulkSales.forEach(sale => {
      const current = stats.get(sale.bulk_purchase_id) || {
        soldQuantity: 0,
        totalQuantity: 0,
        totalSales: 0,
        totalCommission: 0,
        totalShipping: 0,
        totalDeposit: 0,
        totalItemPurchase: 0
      }

      const isSold = !!sale.sale_destination
      const depositAmount = sale.deposit_amount ?? (sale.sale_amount - sale.commission - sale.shipping_cost)
      const itemPurchase = sale.purchase_price || 0

      stats.set(sale.bulk_purchase_id, {
        soldQuantity: current.soldQuantity + (isSold ? sale.quantity : 0),
        totalQuantity: current.totalQuantity + sale.quantity,
        totalSales: current.totalSales + (isSold ? sale.sale_amount : 0),
        totalCommission: current.totalCommission + (isSold ? sale.commission : 0),
        totalShipping: current.totalShipping + (isSold ? sale.shipping_cost : 0),
        totalDeposit: current.totalDeposit + (isSold ? depositAmount : 0),
        totalItemPurchase: current.totalItemPurchase + itemPurchase
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
    let totalDeposit = 0

    targetPurchases.forEach(purchase => {
      totalPurchaseAmount += purchase.total_amount

      const stats = purchaseStats.get(purchase.id)
      if (stats) {
        // 個別アイテムの仕入額を加算
        totalPurchaseAmount += stats.totalItemPurchase
        // 数量はbulk_purchasesのtotal_quantityとbulk_salesの件数の大きい方を使用
        totalQuantity += Math.max(purchase.total_quantity, stats.totalQuantity)
        soldQuantity += stats.soldQuantity
        totalSales += stats.totalSales
        totalCommission += stats.totalCommission
        totalShipping += stats.totalShipping
        totalDeposit += stats.totalDeposit
      } else {
        totalQuantity += purchase.total_quantity
      }
    })

    const remainingQuantity = totalQuantity - soldQuantity
    // 利益は入金額から仕入額を引いた値
    const netProfit = totalDeposit - totalPurchaseAmount
    const profitRate = totalPurchaseAmount > 0 ? Math.round((netProfit / totalPurchaseAmount) * 100) : 0
    const recoveryRate = totalPurchaseAmount > 0 ? Math.round((totalDeposit / totalPurchaseAmount) * 100) : 0

    return {
      totalPurchaseAmount,
      totalQuantity,
      soldQuantity,
      remainingQuantity,
      totalSales,
      totalCommission,
      totalShipping,
      totalDeposit,
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
      const isSold = !!sale.sale_destination
      const depositAmount = sale.deposit_amount ?? (sale.sale_amount - sale.commission - sale.shipping_cost)
      const purchasePrice = sale.purchase_price || 0
      const otherCost = sale.other_cost || 0
      rows.push({
        id: `sale-${sale.id}`,
        type: 'sale',
        date: sale.sale_date,
        genre: sale.category || purchase?.genre || '',
        brandName: sale.brand_name,
        productName: sale.product_name,
        saleDestination: sale.sale_destination,
        purchaseAmount: isSold ? 0 : purchasePrice,
        saleAmount: isSold ? sale.sale_amount : 0,
        commission: isSold ? sale.commission : 0,
        shippingCost: isSold ? sale.shipping_cost : 0,
        profit: isSold ? depositAmount : -purchasePrice,
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

  // ジャンルを追加（仕入れと販売を空で1行ずつ作成）
  const handleAddGenre = async () => {
    const genreName = prompt('ジャンル名を入力してください')
    if (!genreName || genreName.trim() === '') {
      return
    }

    const trimmedName = genreName.trim()
    // 既存のジャンルと重複チェック
    if (genres.includes(trimmedName)) {
      alert('同じ名前のジャンルが既に存在します')
      return
    }

    // 仕入れデータを作成（デフォルト値）
    const { data: newPurchaseData, error: purchaseError } = await supabase
      .from('bulk_purchases')
      .insert({
        genre: trimmedName,
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_source: null,
        total_amount: 0,
        total_quantity: 0,
        memo: null,
        user_id: user?.id
      })
      .select()
      .single()

    if (purchaseError) {
      console.error('Error adding genre:', purchaseError)
      alert('追加に失敗しました: ' + purchaseError.message)
      return
    }

    // 売上行を追加（デフォルト値）
    const { error: saleError } = await supabase
      .from('bulk_sales')
      .insert({
        bulk_purchase_id: newPurchaseData.id,
        sale_date: new Date().toISOString().split('T')[0],
        sale_destination: null,
        quantity: 0,
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
        deposit_amount: 0,
        listing_date: null,
        user_id: user?.id
      })

    if (saleError) {
      console.error('Error adding sale:', saleError)
      alert('売上行の追加に失敗しました: ' + saleError.message)
    }

    fetchData()
    setSelectedGenre(trimmedName)
  }

  // 新規まとめ仕入れ登録（既存のモーダル用）
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
        memo: newPurchase.memo || null,
        user_id: user?.id
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

    const saleAmount = parseInt(newSale.sale_amount)
    const commission = parseInt(newSale.commission) || 0
    const shippingCost = parseInt(newSale.shipping_cost) || 0
    // 入金額が入力されていなければ自動計算（売上 - 手数料 - 送料）
    const depositAmount = newSale.deposit_amount
      ? parseInt(newSale.deposit_amount)
      : saleAmount - commission - shippingCost

    const { error } = await supabase
      .from('bulk_sales')
      .insert({
        bulk_purchase_id: selectedPurchase.id,
        sale_date: newSale.sale_date,
        sale_destination: newSale.sale_destination || null,
        quantity: parseInt(newSale.quantity),
        sale_amount: saleAmount,
        commission: commission,
        shipping_cost: shippingCost,
        memo: newSale.memo || null,
        // 商品詳細
        product_name: newSale.product_name || null,
        brand_name: newSale.brand_name || null,
        category: newSale.category || null,
        image_url: newSale.image_url || null,
        purchase_price: newSale.purchase_price ? parseInt(newSale.purchase_price) : null,
        other_cost: newSale.other_cost ? parseInt(newSale.other_cost) : 0,
        deposit_amount: depositAmount,
        listing_date: newSale.listing_date || null,
        user_id: user?.id
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
    // 編集不可
    if (!canEdit) return
    if (editingCell?.id === sale.id && editingCell?.field === field && editingCell?.type === 'sale') return

    // 先に現在の編集を保存
    if (editingCell) {
      saveEditingCell()
    }

    const value = sale[field]
    // 数値フィールドでnull/undefinedの場合は空として扱う
    const shouldBeEmpty = value === null || value === undefined
    setEditValue(shouldBeEmpty ? '' : String(value))
    setEditingCell({ id: sale.id, field, type: 'sale' })
  }

  // セルクリックで編集開始（仕入れ用）
  const handlePurchaseCellClick = (purchase: BulkPurchase, field: keyof BulkPurchase) => {
    // 編集不可
    if (!canEdit) return
    if (editingCell?.id === purchase.id && editingCell?.field === field && editingCell?.type === 'purchase') return

    // 先に現在の編集を保存
    if (editingCell) {
      saveEditingCell()
    }

    const value = purchase[field]
    // 数値フィールドで0の場合は空として扱う（表示が-になるため）
    const numericFields = ['total_amount', 'total_quantity', 'purchase_price']
    const isNumericField = numericFields.includes(field)
    const shouldBeEmpty = value === null || value === undefined || (isNumericField && value === 0)
    setEditValue(shouldBeEmpty ? '' : String(value))
    setEditingCell({ id: purchase.id, field: field as keyof BulkSale | keyof BulkPurchase, type: 'purchase' })
  }

  // 販売先に応じた手数料計算（正の数で返す）
  const calculateCommission = (destination: string | null, salePrice: number | null, saleDate?: string | null): number | null => {
    if (!destination || !salePrice) return null
    const price = salePrice

    switch (destination) {
      case 'エコオク':
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
      case 'オークネット': {
        // 3% + 330円（最低770円+330円=1,100円）
        const base = price * 0.03
        if (base >= 700) return Math.round(base + 330)
        return Math.round(770 + 330) // 最低1,100円
      }
      case 'エコトレ':
        // 10%
        return Math.round(price * 0.1)
      case 'JBA':
        // 3% + 550円
        return Math.round(price * 0.03 + 550)
      case '仲卸':
        // 手数料なし
        return 0
      default:
        return null
    }
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
      // NOT NULL制約があるフィールドは0をデフォルトに
      const notNullFields = ['sale_amount', 'commission', 'shipping_cost', 'quantity']
      if (numericFields.includes(field)) {
        if (editValue) {
          newValue = parseInt(editValue)
        } else if (notNullFields.includes(field)) {
          newValue = 0
        } else {
          newValue = null
        }
      }

      // 変更がない場合はスキップ
      const currentValue = sale[field as keyof BulkSale]
      if (String(currentValue ?? '') === String(newValue ?? '')) {
        setEditingCell(null)
        return
      }

      // 売上額を変更した場合、販売先が設定されていれば手数料も再計算
      let updateData: Record<string, string | number | null> = { [field]: newValue }
      if (field === 'sale_amount' && sale.sale_destination && typeof newValue === 'number') {
        const newCommission = calculateCommission(sale.sale_destination, newValue, sale.sale_date)
        if (newCommission !== null) {
          updateData.commission = newCommission
          // 入金額も再計算
          updateData.deposit_amount = newValue - newCommission - sale.shipping_cost
        }
      }
      // 売上・手数料・送料が変更された場合は入金額を再計算
      if (['sale_amount', 'commission', 'shipping_cost'].includes(field)) {
        const saleAmount = field === 'sale_amount' ? (newValue as number) : sale.sale_amount
        const commission = field === 'commission' ? (newValue as number) : (updateData.commission as number ?? sale.commission)
        const shippingCost = field === 'shipping_cost' ? (newValue as number) : sale.shipping_cost
        updateData.deposit_amount = saleAmount - commission - shippingCost
      }

      console.log('Updating sale:', id, 'field:', field, 'updateData:', updateData)
      const { error, data } = await supabase
        .from('bulk_sales')
        .update(updateData)
        .eq('id', id)
        .select()

      console.log('Update result - error:', error, 'data:', data)
      if (error) {
        console.error('Error updating sale:', error, error.message, error.details)
      } else {
        setBulkSales(prev => prev.map(s =>
          s.id === id ? { ...s, ...updateData } : s
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
        console.error('Error updating purchase:', error, 'field:', field, 'value:', newValue)
      } else {
        setBulkPurchases(prev => prev.map(p =>
          p.id === id ? { ...p, [field]: newValue } : p
        ))
      }
    }

    setEditingCell(null)
  }, [editingCell, editValue, bulkSales, bulkPurchases])

  // セレクトボックス専用の即時保存（販売先など）+ 手数料自動計算
  const handleSelectChange = async (saleId: string, field: keyof BulkSale, value: string) => {
    const newValue = value || null
    const sale = bulkSales.find(s => s.id === saleId)

    // 販売先変更時は手数料も自動計算
    let updateData: Record<string, string | number | null> = { [field]: newValue }
    if (field === 'sale_destination' && sale) {
      const newCommission = calculateCommission(newValue, sale.sale_amount, sale.sale_date)
      if (newCommission !== null) {
        updateData.commission = newCommission
        // 入金額も再計算
        updateData.deposit_amount = sale.sale_amount - newCommission - sale.shipping_cost
      }
    }

    const { error } = await supabase
      .from('bulk_sales')
      .update(updateData)
      .eq('id', saleId)

    if (error) {
      console.error('Error updating sale:', error)
    } else {
      setBulkSales(prev => prev.map(s =>
        s.id === saleId ? { ...s, ...updateData } : s
      ))
    }
    setEditingCell(null)
  }

  // 仕入先セレクトボックス専用の即時保存
  const handlePurchaseSelectChange = async (purchaseId: string, field: keyof BulkPurchase, value: string) => {
    const newValue = value || null

    const { error } = await supabase
      .from('bulk_purchases')
      .update({ [field]: newValue })
      .eq('id', purchaseId)

    if (error) {
      console.error('Error updating purchase:', error)
    } else {
      setBulkPurchases(prev => prev.map(p =>
        p.id === purchaseId ? { ...p, [field]: newValue } : p
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
      setSelectedCells([])
    } else if (e.key === 'Tab') {
      e.preventDefault()
      saveEditingCell()
    } else if (e.key === 'Delete') {
      // Deleteキーで中身を一括削除
      setEditValue('')
    }
  }

  // セルが選択されているかチェック
  const isCellSelected = (id: string, field: string, type: 'sale' | 'purchase') => {
    return selectedCells.some(cell => cell.id === id && cell.field === field && cell.type === type)
  }

  // セルのマウスダウン（ドラッグ開始）
  const handleCellMouseDown = (
    e: React.MouseEvent,
    cell: SelectedCell,
    onEdit: () => void
  ) => {
    // ダブルクリックは編集モードへ
    if (e.detail === 2) {
      setSelectedCells([])
      setIsDragging(false)
      setDragStart(null)
      onEdit()
      return
    }

    // 編集中は選択モードに入らない
    if (editingCell) return

    // 既に選択中のセルをクリックしたら編集モードへ
    const isAlreadySelected = selectedCells.some(c => c.id === cell.id && c.field === cell.field && c.type === cell.type)
    if (isAlreadySelected && selectedCells.length === 1) {
      setSelectedCells([])
      onEdit()
      return
    }

    // Cmd/Ctrl+クリックで追加選択
    if (e.metaKey || e.ctrlKey) {
      setSelectedCells(prev => {
        const exists = prev.some(c => c.id === cell.id && c.field === cell.field && c.type === cell.type)
        if (exists) {
          return prev.filter(c => !(c.id === cell.id && c.field === cell.field && c.type === cell.type))
        }
        return [...prev, cell]
      })
      return
    }

    // ドラッグ開始
    setIsDragging(true)
    setDragStart(cell)
    setSelectedCells([cell])
    setSelectionStart(cell)
  }

  // セルのマウスエンター（ドラッグ中）
  const handleCellMouseEnter = (cell: SelectedCell) => {
    if (!isDragging || !dragStart) return

    // dragStartからcellまでの範囲を選択
    const minRow = Math.min(dragStart.rowIndex, cell.rowIndex)
    const maxRow = Math.max(dragStart.rowIndex, cell.rowIndex)
    const minCol = Math.min(dragStart.colIndex, cell.colIndex)
    const maxCol = Math.max(dragStart.colIndex, cell.colIndex)

    // 範囲内のセルを全て選択するために、allCellsMapを使う
    // 簡易実装: dragStartとcellの2点を保持し、renderCell側で範囲判定
    setSelectedCells(prev => {
      // 一旦dragStartのみ保持して、範囲はrowIndex/colIndexで判定
      return [{ ...dragStart, minRow, maxRow, minCol, maxCol } as SelectedCell]
    })
    // 範囲選択用に開始と終了を保持
    setSelectionStart(dragStart)
  }

  // マウスアップ（ドラッグ終了）
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [isDragging])

  // 範囲内かどうかをチェック（ドラッグ中も終了後も機能）
  const isCellInRange = (rowIndex: number, colIndex: number): boolean => {
    if (selectedCells.length === 0) return false

    const cell = selectedCells[0] as SelectedCell & { minRow?: number; maxRow?: number; minCol?: number; maxCol?: number }
    if (cell.minRow !== undefined && cell.maxRow !== undefined && cell.minCol !== undefined && cell.maxCol !== undefined) {
      return rowIndex >= cell.minRow && rowIndex <= cell.maxRow && colIndex >= cell.minCol && colIndex <= cell.maxCol
    }
    return false
  }

  // セルの値を取得
  const getCellValue = (id: string, field: string, type: 'sale' | 'purchase'): string => {
    if (type === 'sale') {
      const sale = bulkSales.find(s => s.id === id)
      if (!sale) return ''
      const value = sale[field as keyof BulkSale]
      return value !== null && value !== undefined ? String(value) : ''
    } else {
      const purchase = bulkPurchases.find(p => p.id === id)
      if (!purchase) return ''
      const value = purchase[field as keyof BulkPurchase]
      return value !== null && value !== undefined ? String(value) : ''
    }
  }

  // 列インデックスからフィールド名を取得
  const getFieldByColIndex = (colIndex: number, type: 'sale' | 'purchase'): string => {
    const saleFields: Record<number, string> = {
      1: 'sale_date',
      4: 'category',
      5: 'brand_name',
      6: 'product_name',
      8: 'sale_destination',
      9: 'sale_amount',
      10: 'commission',
      11: 'shipping_cost',
      12: 'other_cost',
      13: 'purchase_price',
      15: 'deposit_amount',
    }
    const purchaseFields: Record<number, string> = {
      1: 'purchase_date',
      4: 'genre',
      6: 'memo',
      13: 'purchase_price',
      14: 'total_amount',
    }
    return type === 'sale' ? saleFields[colIndex] || '' : purchaseFields[colIndex] || ''
  }

  // Ctrl+Cでコピー
  useEffect(() => {
    const handleCopy = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedCells.length > 0 && !editingCell) {
        e.preventDefault()

        const cell = selectedCells[0] as SelectedCell & { minRow?: number; maxRow?: number; minCol?: number; maxCol?: number }

        // 範囲選択の場合
        if (cell.minRow !== undefined && cell.maxRow !== undefined && cell.minCol !== undefined && cell.maxCol !== undefined) {
          const rows: string[][] = []

          for (let rowIdx = cell.minRow; rowIdx <= cell.maxRow; rowIdx++) {
            const row = mixedRows[rowIdx]
            if (!row) continue

            const rowValues: string[] = []
            const sale = row.saleData
            const purchase = row.purchaseData
            const isSale = row.type === 'sale'

            for (let colIdx = cell.minCol; colIdx <= cell.maxCol; colIdx++) {
              let value = ''
              if (isSale && sale) {
                const field = getFieldByColIndex(colIdx, 'sale')
                if (field) {
                  value = getCellValue(sale.id, field, 'sale')
                }
              } else if (!isSale && purchase) {
                const field = getFieldByColIndex(colIdx, 'purchase')
                if (field) {
                  value = getCellValue(purchase.id, field, 'purchase')
                }
              }
              rowValues.push(value)
            }
            rows.push(rowValues)
          }

          // 行は改行、列はタブで区切る
          const text = rows.map(r => r.join('\t')).join('\n')
          navigator.clipboard.writeText(text).then(() => {
            console.log('Copied:', text)
          }).catch(err => {
            console.error('Copy failed:', err)
          })
        } else {
          // 単一セルまたは複数の個別セル選択の場合
          const values = selectedCells.map(c => getCellValue(c.id, c.field, c.type))
          const text = values.join('\t')
          navigator.clipboard.writeText(text).then(() => {
            console.log('Copied:', text)
          }).catch(err => {
            console.error('Copy failed:', err)
          })
        }
      }
    }

    document.addEventListener('keydown', handleCopy)
    return () => document.removeEventListener('keydown', handleCopy)
  }, [selectedCells, editingCell, bulkSales, bulkPurchases, mixedRows])

  // 外側クリックで保存
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingCell && editCellRef.current && !editCellRef.current.contains(e.target as Node)) {
        // Portalでレンダリングしたドロップダウン内のクリックは無視
        const target = e.target as HTMLElement
        if (target.closest('.fixed.z-\\[9999\\]')) {
          return
        }
        // ドロップダウンモードの場合は単に閉じる
        if (editingCell.mode === 'dropdown') {
          setEditingCell(null)
          setDropdownPosition(null)
        } else {
          saveEditingCell()
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCell, saveEditingCell])

  // 編集モードになったらinputにフォーカス
  useEffect(() => {
    if (editingCell && editingCell.mode !== 'dropdown') {
      // DOMレンダリング後にフォーカスを当てる
      setTimeout(() => {
        // editInputRefがある場合（仕入先・販売先のテキストモード）
        if (editInputRef.current) {
          editInputRef.current.focus()
          const len = editInputRef.current.value.length
          editInputRef.current.setSelectionRange(len, len)
        } else {
          // 一般的な編集セル内のinput要素を探す
          const editCell = editCellRef.current
          if (editCell) {
            const input = editCell.querySelector('input') as HTMLInputElement
            if (input) {
              input.focus()
              const len = input.value.length
              input.setSelectionRange(len, len)
            }
          }
        }
      }, 10)
    }
  }, [editingCell])

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
      <div className="w-full px-2 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">まとめ仕入れ在庫一覧</h1>
          <button
            onClick={handleAddGenre}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base touch-target"
          >
            ジャンルを追加
          </button>
        </div>

        {/* 表示モード切替 */}
        {!loading && bulkPurchases.length > 0 && (
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-medium text-gray-600">原価回収モード:</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('sales')}
                className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors touch-target ${
                  viewMode === 'sales'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                通算で計算
              </button>
              <button
                onClick={() => setViewMode('purchases')}
                className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors touch-target ${
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
          <div className="mb-4 flex flex-wrap gap-1.5 sm:gap-2 overflow-x-auto mobile-hide-scrollbar pb-1">
            <button
              onClick={() => setSelectedGenre('all')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap touch-target ${
                selectedGenre === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              すべて ({bulkPurchases.length})
            </button>
            {genres.map(genre => {
              const count = bulkPurchases.filter(p => p.genre === genre).length
              const genrePurchases = bulkPurchases.filter(p => p.genre === genre)
              return (
                <div key={genre} className="relative group">
                  <button
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 pr-7 sm:pr-8 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap touch-target ${
                      selectedGenre === genre
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {genre} ({count})
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (!confirm(`「${genre}」のジャンルを削除しますか？\n関連する${count}件の仕入れと売上データも全て削除されます。`)) return
                      // ジャンルに紐づく全ての仕入れを削除（関連売上も自動削除）
                      for (const purchase of genrePurchases) {
                        await supabase.from('bulk_sales').delete().eq('bulk_purchase_id', purchase.id)
                        await supabase.from('bulk_purchases').delete().eq('id', purchase.id)
                      }
                      if (selectedGenre === genre) setSelectedGenre('all')
                      fetchData()
                    }}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-500 hover:text-white transition-colors touch-target ${
                      selectedGenre === genre ? 'text-white/70' : 'text-gray-400'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ジャンルサマリー */}
        {!loading && filteredPurchases.length > 0 && (
          <div className="mb-4 bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700">
                {selectedGenre === 'all' ? '全体' : selectedGenre} サマリー
              </h3>
              <span className={`text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded-full self-start sm:self-auto ${
                genreSummary.recoveryRate >= 100
                  ? 'bg-green-100 text-green-700'
                  : genreSummary.recoveryRate >= 50
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}>
                回収率 {genreSummary.recoveryRate}%
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="text-gray-500 text-[10px] sm:text-xs">仕入総額</div>
                <div className="font-bold text-gray-900 text-sm sm:text-base">¥{genreSummary.totalPurchaseAmount.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="text-gray-500 text-[10px] sm:text-xs">総数量</div>
                <div className="font-bold text-gray-900 text-sm sm:text-base">{genreSummary.totalQuantity}点</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="text-gray-500 text-[10px] sm:text-xs">販売済</div>
                <div className="font-bold text-blue-600 text-sm sm:text-base">{genreSummary.soldQuantity}点</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="text-gray-500 text-[10px] sm:text-xs">売上総額</div>
                <div className="font-bold text-gray-900 text-sm sm:text-base">¥{genreSummary.totalSales.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="text-gray-500 text-[10px] sm:text-xs">出金総額</div>
                <div className="font-bold text-red-600 text-sm sm:text-base">¥{genreSummary.totalPurchaseAmount.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="text-gray-500 text-[10px] sm:text-xs">入金総額</div>
                <div className="font-bold text-blue-600 text-sm sm:text-base">¥{genreSummary.totalDeposit.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="text-gray-500 text-[10px] sm:text-xs">未回収額</div>
                <div className={`font-bold text-sm sm:text-base ${(mixedRows.length > 0 ? -mixedRows[mixedRows.length - 1].cumulativeProfit : 0) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{(mixedRows.length > 0 ? -mixedRows[mixedRows.length - 1].cumulativeProfit : 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="text-gray-500 text-[10px] sm:text-xs">利益率</div>
                <div className={`font-bold text-sm sm:text-base ${genreSummary.profitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                      listing_date: null,
                      user_id: user?.id
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
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">正味<br/>仕入額</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">仕入<br/>総額</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">入金額</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[80px]">収支</th>
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
                        extraClass: string = '',
                        colIndex: number = 0
                      ) => {
                        const targetId = dataType === 'sale' ? sale?.id : purchase?.id
                        const isEditing = editingCell?.id === targetId && editingCell?.field === field && editingCell?.type === dataType
                        const isSelected = targetId ? isCellSelected(targetId, field, dataType) : false
                        const isInRange = isCellInRange(index, colIndex)

                        const handleEdit = () => {
                          if (dataType === 'sale' && sale) {
                            handleSaleCellClick(sale, field as keyof BulkSale)
                          } else if (dataType === 'purchase' && purchase) {
                            handlePurchaseCellClick(purchase, field as keyof BulkPurchase)
                          }
                        }

                        const handleMouseDown = (e: React.MouseEvent) => {
                          if (!targetId) return
                          handleCellMouseDown(
                            e,
                            { id: targetId, field, type: dataType, rowIndex: index, colIndex },
                            handleEdit
                          )
                        }

                        const handleMouseEnter = () => {
                          if (!targetId) return
                          handleCellMouseEnter({ id: targetId, field, type: dataType, rowIndex: index, colIndex })
                        }

                        if (isEditing) {
                          if (inputType === 'select') {
                            return (
                              <td className={`px-2 py-1 border-r border-gray-100 ring-2 ring-blue-500 ring-inset ${extraClass}`} ref={editCellRef}>
                                <select
                                  value={editValue}
                                  onChange={(e) => {
                                    setEditValue(e.target.value)
                                    setTimeout(() => saveEditingCell(), 0)
                                  }}
                                  onKeyDown={handleKeyDown}
                                  className="w-full h-full px-0 py-0 text-xs border-none outline-none bg-transparent text-gray-900 font-medium"
                                  autoFocus
                                >
                                  <option value="">-</option>
                                  {platforms.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                  ))}
                                </select>
                              </td>
                            )
                          }
                          return (
                            <td className={`px-2 py-1 border-r border-gray-100 ring-2 ring-blue-500 ring-inset ${extraClass}`} ref={editCellRef}>
                              <input
                                type={inputType === 'number' ? 'text' : inputType}
                                inputMode={inputType === 'number' ? 'numeric' : undefined}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full h-full px-0 py-0 text-xs border-none outline-none bg-transparent text-gray-900 font-medium"
                                autoFocus
                              />
                            </td>
                          )
                        }

                        return (
                          <td
                            className={`px-2 py-1 border-r border-gray-100 cursor-pointer select-none ${isSelected || isInRange ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50'} ${extraClass}`}
                            onMouseDown={handleMouseDown}
                            onMouseEnter={handleMouseEnter}
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
                            ? renderCell('purchase_date', row.date, 'purchase', 'date', 'text-gray-900', 1)
                            : sale ? renderCell('sale_date', row.date, 'sale', 'date', 'text-gray-900', 1)
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
                              <img src={`/api/image-proxy?url=${encodeURIComponent(sale.image_url)}`} alt="" className="w-8 h-8 object-cover rounded mx-auto cursor-pointer" onClick={() => setEnlargedImage(sale.image_url)} />
                            </td>
                          ) : (
                            <td className="px-2 py-1 border-r border-gray-100 text-center text-gray-400">-</td>
                          )}
                          {/* ジャンル */}
                          {isPurchase && purchase
                            ? renderCell('genre', row.genre || '-', 'purchase', 'text', 'text-gray-900', 4)
                            : sale ? renderCell('category', row.genre || '-', 'sale', 'text', 'text-gray-900', 4)
                            : <td className="px-2 py-1 border-r border-gray-100 text-gray-900">{row.genre}</td>}
                          {/* ブランド */}
                          {sale
                            ? renderCell('brand_name', row.brandName || '-', 'sale', 'text', 'text-gray-900 truncate', 5)
                            : <td className="px-2 py-1 border-r border-gray-100 text-gray-400">-</td>}
                          {/* 商品名 */}
                          {sale
                            ? renderCell('product_name', row.productName || '-', 'sale', 'text', 'text-gray-900 truncate', 6)
                            : isPurchase && purchase
                              ? renderCell('memo', row.productName || '-', 'purchase', 'text', 'text-gray-900 truncate', 6)
                              : <td className="px-2 py-1 border-r border-gray-100">{row.productName || '-'}</td>}
                          {/* 仕入先 */}
                          {row.type === 'purchase' && purchase ? (() => {
                            const isEditing = editingCell?.id === purchase.id && editingCell?.field === 'purchase_source' && editingCell?.type === 'purchase'
                            const isDropdownMode = isEditing && editingCell?.mode === 'dropdown'
                            const isTextMode = isEditing && editingCell?.mode === 'text'
                            const isSelected = isCellSelected(purchase.id, 'purchase_source', 'purchase') || isCellInRange(index, 7)
                            const sourceColor = platformColors[purchase.purchase_source || ''] || 'bg-gray-100 text-gray-800'

                            const handleDropdownClick = (e: React.MouseEvent) => {
                              e.stopPropagation()
                              e.preventDefault()
                              const target = e.currentTarget as HTMLElement
                              const rect = target.closest('td')?.getBoundingClientRect()
                              if (rect) {
                                setDropdownPosition({ top: rect.bottom + 2, left: rect.left })
                              }
                              setTimeout(() => {
                                setEditingCell({ id: purchase.id, field: 'purchase_source', type: 'purchase', mode: 'dropdown' })
                                setEditValue(purchase.purchase_source || '')
                              }, 0)
                            }

                            const handleTextEdit = () => {
                              setEditingCell({ id: purchase.id, field: 'purchase_source', type: 'purchase', mode: 'text' })
                              setEditValue(purchase.purchase_source || '')
                            }

                            return (
                              <td
                                className={`px-1 py-1 border-r border-gray-100 cursor-pointer select-none relative ${isDropdownMode ? 'overflow-visible' : 'overflow-hidden'} ${isEditing ? 'ring-2 ring-blue-500 ring-inset' : isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50'}`}
                                onMouseDown={(e) => {
                                  if (!(e.target as HTMLElement).closest('.dropdown-trigger')) {
                                    handleCellMouseDown(e, { id: purchase.id, field: 'purchase_source', type: 'purchase', rowIndex: index, colIndex: 7 }, handleTextEdit)
                                  }
                                }}
                                onMouseEnter={() => handleCellMouseEnter({ id: purchase.id, field: 'purchase_source', type: 'purchase', rowIndex: index, colIndex: 7 })}
                                ref={isEditing ? editCellRef : null}
                              >
                                {isDropdownMode ? (
                                  <>
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex-1 text-center overflow-hidden">
                                        {purchase.purchase_source ? (
                                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full max-w-full truncate ${sourceColor}`}>{purchase.purchase_source}</span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </div>
                                      <div className="dropdown-trigger flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </div>
                                    </div>
                                    {dropdownPosition && createPortal(
                                      <div
                                        className="fixed z-[9999] w-32 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-auto"
                                        style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                      >
                                        {[{ name: '' }, ...suppliers].map((s) => (
                                          <div
                                            key={s.name || 'empty'}
                                            className={`px-3 py-1.5 text-xs text-gray-900 cursor-pointer hover:bg-blue-100 ${editValue === s.name ? 'bg-blue-50 font-medium' : ''}`}
                                            onMouseDown={(e) => {
                                              e.preventDefault()
                                              handlePurchaseSelectChange(purchase.id, 'purchase_source', s.name)
                                            }}
                                          >
                                            {s.name || '-'}
                                          </div>
                                        ))}
                                      </div>,
                                      document.body
                                    )}
                                  </>
                                ) : isTextMode ? (
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full h-full px-0 py-0 text-xs border-none outline-none bg-transparent text-gray-900 font-medium text-center"
                                  />
                                ) : (
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex-1 text-center overflow-hidden cursor-pointer">
                                      {purchase.purchase_source ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full max-w-full truncate ${sourceColor}`}>{purchase.purchase_source}</span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </div>
                                    <div
                                      className="dropdown-trigger flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded cursor-pointer"
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleDropdownClick(e)
                                      }}
                                    >
                                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                              </td>
                            )
                          })() : sale ? (() => {
                            const saleSource = sale.purchase_source || purchase?.purchase_source || null
                            const isEditing = editingCell?.id === sale.id && editingCell?.field === 'purchase_source' && editingCell?.type === 'sale'
                            const isDropdownMode = isEditing && editingCell?.mode === 'dropdown'
                            const isTextMode = isEditing && editingCell?.mode === 'text'
                            const isSelected = isCellSelected(sale.id, 'purchase_source', 'sale') || isCellInRange(index, 7)
                            const sourceColor = saleSource ? (platformColors[saleSource] || 'bg-gray-100 text-gray-800') : ''

                            const handleDropdownClick = (e: React.MouseEvent) => {
                              e.stopPropagation()
                              e.preventDefault()
                              const target = e.currentTarget as HTMLElement
                              const rect = target.closest('td')?.getBoundingClientRect()
                              if (rect) {
                                setDropdownPosition({ top: rect.bottom + 2, left: rect.left })
                              }
                              setTimeout(() => {
                                setEditingCell({ id: sale.id, field: 'purchase_source', type: 'sale', mode: 'dropdown' })
                                setEditValue(saleSource || '')
                              }, 0)
                            }

                            const handleTextEdit = () => {
                              setEditingCell({ id: sale.id, field: 'purchase_source', type: 'sale', mode: 'text' })
                              setEditValue(saleSource || '')
                            }

                            return (
                              <td
                                className={`px-1 py-1 border-r border-gray-100 cursor-pointer select-none relative ${isDropdownMode ? 'overflow-visible' : 'overflow-hidden'} ${isEditing ? 'ring-2 ring-blue-500 ring-inset' : isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50'}`}
                                onMouseDown={(e) => {
                                  if (!(e.target as HTMLElement).closest('.dropdown-trigger')) {
                                    handleCellMouseDown(e, { id: sale.id, field: 'purchase_source', type: 'sale', rowIndex: index, colIndex: 7 }, handleTextEdit)
                                  }
                                }}
                                onMouseEnter={() => handleCellMouseEnter({ id: sale.id, field: 'purchase_source', type: 'sale', rowIndex: index, colIndex: 7 })}
                                ref={isEditing ? editCellRef : null}
                              >
                                {isDropdownMode ? (
                                  <>
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex-1 text-center overflow-hidden">
                                        {saleSource ? (
                                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full max-w-full truncate ${sourceColor}`}>{saleSource}</span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </div>
                                      <div className="dropdown-trigger flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </div>
                                    </div>
                                    {dropdownPosition && createPortal(
                                      <div
                                        className="fixed z-[9999] w-32 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-auto"
                                        style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {suppliers.map(s => (
                                          <div
                                            key={s.id}
                                            className="px-2 py-1 text-xs cursor-pointer hover:bg-blue-50"
                                            onClick={() => {
                                              handleSelectChange(sale.id, 'purchase_source' as keyof BulkSale, s.name)
                                              setEditingCell(null)
                                              setDropdownPosition(null)
                                            }}
                                          >
                                            {s.name}
                                          </div>
                                        ))}
                                      </div>,
                                      document.body
                                    )}
                                  </>
                                ) : isTextMode ? (
                                  <input
                                    type="text"
                                    className="w-full text-xs text-center border-none outline-none bg-transparent"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => { handleSelectChange(sale.id, 'purchase_source' as keyof BulkSale, editValue); setEditingCell(null) }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { handleSelectChange(sale.id, 'purchase_source' as keyof BulkSale, editValue); setEditingCell(null) } if (e.key === 'Escape') setEditingCell(null) }}
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="flex-1 text-center overflow-hidden">
                                      {saleSource ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full max-w-full truncate ${sourceColor}`}>{saleSource}</span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </div>
                                    <div
                                      className="dropdown-trigger flex-shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer hover:bg-gray-200 rounded"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDropdownClick(e)
                                      }}
                                    >
                                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                              </td>
                            )
                          })() : (
                            <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>
                          )}
                          {/* 販売先 */}
                          {sale && !isPurchase ? (() => {
                            const isEditing = editingCell?.id === sale.id && editingCell?.field === 'sale_destination' && editingCell?.type === 'sale'
                            const isDropdownMode = isEditing && editingCell?.mode === 'dropdown'
                            const isTextMode = isEditing && editingCell?.mode === 'text'
                            const isSelected = isCellSelected(sale.id, 'sale_destination', 'sale') || isCellInRange(index, 8)

                            const handleDropdownClick = (e: React.MouseEvent) => {
                              e.stopPropagation()
                              e.preventDefault()
                              const target = e.currentTarget as HTMLElement
                              const rect = target.closest('td')?.getBoundingClientRect()
                              if (rect) {
                                setDropdownPosition({ top: rect.bottom + 2, left: rect.left })
                              }
                              setTimeout(() => {
                                setEditingCell({ id: sale.id, field: 'sale_destination', type: 'sale', mode: 'dropdown' })
                                setEditValue(sale.sale_destination || '')
                              }, 0)
                            }

                            const handleTextEdit = () => {
                              setEditingCell({ id: sale.id, field: 'sale_destination', type: 'sale', mode: 'text' })
                              setEditValue(sale.sale_destination || '')
                            }

                            return (
                              <td
                                className={`px-1 py-1 border-r border-gray-100 cursor-pointer select-none relative ${isDropdownMode ? 'overflow-visible' : 'overflow-hidden'} ${isEditing ? 'ring-2 ring-blue-500 ring-inset' : isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50'}`}
                                onMouseDown={(e) => {
                                  if (!(e.target as HTMLElement).closest('.dropdown-trigger')) {
                                    handleCellMouseDown(e, { id: sale.id, field: 'sale_destination', type: 'sale', rowIndex: index, colIndex: 8 }, handleTextEdit)
                                  }
                                }}
                                onMouseEnter={() => handleCellMouseEnter({ id: sale.id, field: 'sale_destination', type: 'sale', rowIndex: index, colIndex: 8 })}
                                ref={isEditing ? editCellRef : null}
                              >
                                {isDropdownMode ? (
                                  <>
                                    <div className="relative w-full h-full">
                                      <div className="text-center overflow-hidden pr-4">
                                        {row.saleDestination ? (
                                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full max-w-full truncate ${destColor || 'bg-gray-100 text-gray-800'}`}>{row.saleDestination}</span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </div>
                                      <div className="dropdown-trigger absolute top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center" style={{ right: '-2px' }}>
                                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </div>
                                    </div>
                                    {dropdownPosition && createPortal(
                                      <div
                                        className="fixed z-[9999] w-32 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-auto"
                                        style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                      >
                                        {[{ name: '' }, ...platforms].map((p) => (
                                          <div
                                            key={p.name || 'empty'}
                                            className={`px-3 py-1.5 text-xs text-gray-900 cursor-pointer hover:bg-blue-100 ${editValue === p.name ? 'bg-blue-50 font-medium' : ''}`}
                                            onMouseDown={(e) => {
                                              e.preventDefault()
                                              handleSelectChange(sale.id, 'sale_destination', p.name)
                                            }}
                                          >
                                            {p.name || '-'}
                                          </div>
                                        ))}
                                      </div>,
                                      document.body
                                    )}
                                  </>
                                ) : isTextMode ? (
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full h-full px-0 py-0 text-xs border-none outline-none bg-transparent text-gray-900 font-medium text-center"
                                  />
                                ) : (
                                  <div className="relative w-full h-full">
                                    <div className="text-center overflow-hidden cursor-pointer pr-4">
                                      {row.saleDestination ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full max-w-full truncate ${destColor || 'bg-gray-100 text-gray-800'}`}>{row.saleDestination}</span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </div>
                                    <div
                                      className="dropdown-trigger absolute top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded cursor-pointer"
                                      style={{ right: '-2px' }}
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleDropdownClick(e)
                                      }}
                                    >
                                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                              </td>
                            )
                          })() : (
                            <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>
                          )}
                          {/* 売値 */}
                          {sale && !isPurchase
                            ? renderCell('sale_amount', sale.sale_amount ? `¥${sale.sale_amount.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-gray-900', 9)
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 手数料 */}
                          {sale && !isPurchase
                            ? renderCell('commission', sale.commission != null ? `¥${sale.commission.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-gray-600', 10)
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 送料 */}
                          {sale && !isPurchase
                            ? renderCell('shipping_cost', sale.shipping_cost ? `¥${sale.shipping_cost.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-gray-600', 11)
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* その他 */}
                          {sale && !isPurchase
                            ? renderCell('other_cost', sale.other_cost ? `¥${sale.other_cost.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-gray-600', 12)
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 正味仕入額 */}
                          {sale
                            ? renderCell('purchase_price', sale.purchase_price ? `¥${sale.purchase_price.toLocaleString()}` : '-', 'sale', 'number', 'text-right text-red-600', 13)
                            : row.type === 'purchase' && purchase
                              ? renderCell('purchase_price', purchase.purchase_price ? `¥${purchase.purchase_price.toLocaleString()}` : '-', 'purchase', 'number', 'text-right text-red-600', 13)
                              : <td className="px-2 py-1 border-r border-gray-100 text-right text-gray-400">-</td>}
                          {/* 仕入総額（原価のみ、修理費は含まない） */}
                          {row.type === 'purchase' && purchase
                            ? renderCell('total_amount', `¥${row.purchaseAmount.toLocaleString()}`, 'purchase', 'number', 'text-right text-red-600 font-medium', 14)
                            : isPurchase && sale
                              ? <td className="px-2 py-1 border-r border-gray-100 text-right text-red-600 font-medium">¥{(sale.purchase_price || 0).toLocaleString()}</td>
                              : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 入金額 */}
                          {sale && !isPurchase
                            ? renderCell('deposit_amount', `¥${depositAmount.toLocaleString()}`, 'sale', 'number', 'text-right text-blue-600', 15)
                            : <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>}
                          {/* 利益 */}
                          <td className={`px-2 py-1 border-r border-gray-100 text-right font-bold ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {row.profit >= 0 ? '+' : ''}¥{row.profit.toLocaleString()}
                          </td>
                          {/* 利益率 */}
                          {sale && !isPurchase && sale.purchase_price ? (
                            <td className={`px-2 py-1 border-r border-gray-100 text-right font-bold ${profitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {profitRate >= 0 ? '+' : ''}{profitRate}%
                            </td>
                          ) : (
                            <td className="px-2 py-1 border-r border-gray-100" style={stripeStyle}></td>
                          )}
                          {/* 削除 */}
                          <td className="px-2 py-1 text-center">
                            {row.type === 'purchase' ? (
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
                totalQuantity: 0,
                totalSales: 0,
                totalCommission: 0,
                totalShipping: 0,
                totalDeposit: 0,
                totalItemPurchase: 0
              }
              const totalAmount = purchase.total_amount + stats.totalItemPurchase
              const actualQuantity = Math.max(purchase.total_quantity, stats.totalQuantity)
              const unitCost = actualQuantity > 0 ? Math.round(totalAmount / actualQuantity) : 0
              const costRecovered = stats.soldQuantity * unitCost
              // 残り金額は仕入額から入金額を引いた値
              const remainingCost = Math.max(0, totalAmount - stats.totalDeposit)
              // 利益は入金額から回収済みコストを引いた値
              const netProfit = stats.totalDeposit - Math.min(costRecovered, totalAmount)
              const remainingQuantity = actualQuantity - stats.soldQuantity
              // 回収完了は入金額が仕入額を超えたかで判定
              const isFullyRecovered = stats.totalDeposit >= totalAmount
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
                      <div className="text-lg font-semibold text-gray-900">{formatCurrency(totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">総数量</div>
                      <div className="text-lg font-semibold text-gray-900">{actualQuantity}個</div>
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
                      <div className="text-xs text-gray-500">現時点収支</div>
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
                                <th className="px-2 py-2 text-right text-xs font-semibold text-white border-r border-slate-600 whitespace-nowrap w-[70px]">収支</th>
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
                                      className={`px-2 py-1 border-r border-gray-100 cursor-pointer relative ${align === 'right' ? 'text-right' : 'text-left'} ${extraClass} ${isEditing ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : 'hover:bg-blue-50'}`}
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
                                    <td className="px-2 py-1 border-r border-gray-100 overflow-hidden">
                                      <div className="flex justify-center">
                                        {purchase.purchase_source ? (
                                          <span className={`inline-flex items-center px-2 py-1 text-xs font-bold rounded-full max-w-full truncate ${sourceColor || 'bg-gray-100 text-gray-800'}`}>
                                            {purchase.purchase_source}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 販売先 - チップ表示 */}
                                    <td
                                      className={`px-2 py-1 border-r border-gray-100 cursor-pointer ${editingCell?.id === sale.id && editingCell?.field === 'sale_destination' && editingCell?.type === 'sale' ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : 'hover:bg-blue-50'}`}
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
                                        <div className="flex justify-center overflow-hidden">
                                          {sale.sale_destination ? (
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-bold rounded-full max-w-full truncate ${destColor || 'bg-gray-100 text-gray-800'}`}>
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

                                    {/* 入出金 - 計算値なので編集不可 */}
                                    <td className={`px-2 py-1 text-right font-medium border-r border-gray-100 ${saleProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(saleProfit)}
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
                          onChange={(e) => {
                            const destination = e.target.value
                            const saleAmount = newSale.sale_amount ? parseInt(newSale.sale_amount, 10) : null
                            const commission = calculateCommission(destination || null, saleAmount, newSale.sale_date || null)
                            setNewSale({
                              ...newSale,
                              sale_destination: destination,
                              commission: commission !== null ? String(commission) : newSale.commission
                            })
                          }}
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
                          onChange={(e) => {
                            const saleAmount = e.target.value ? parseInt(e.target.value, 10) : null
                            const commission = calculateCommission(newSale.sale_destination || null, saleAmount, newSale.sale_date || null)
                            setNewSale({
                              ...newSale,
                              sale_amount: e.target.value,
                              commission: commission !== null ? String(commission) : newSale.commission
                            })
                          }}
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
              src={`/api/image-proxy?url=${encodeURIComponent(enlargedImage)}`}
              alt=""
              className="max-w-[90vw] max-h-[90vh] object-contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
