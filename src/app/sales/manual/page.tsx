'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Papa from 'papaparse'
// import { useVirtualizer } from '@tanstack/react-virtual' // 仮想スクロール無効化
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Navigation from '@/components/Navigation'

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
  sales_type: 'toB' | 'toC'
}

type Supplier = {
  id: string
  name: string
  color_class: string
}

// テーブルのカラム定義
const columns: { key: keyof ManualSale | 'no' | 'checkbox'; label: string; editable: boolean; type: 'text' | 'number' | 'date' | 'select' | 'readonly' }[] = [
  { key: 'checkbox', label: '', editable: false, type: 'readonly' },
  { key: 'no', label: 'No', editable: false, type: 'readonly' },
  { key: 'inventory_number', label: '管理番号', editable: true, type: 'text' },
  { key: 'image_url', label: '画像', editable: false, type: 'readonly' },
  { key: 'category', label: 'ジャンル', editable: true, type: 'select' },
  { key: 'brand_name', label: 'ブランド名', editable: true, type: 'text' },
  { key: 'product_name', label: '商品名', editable: true, type: 'text' },
  { key: 'purchase_source', label: '仕入先', editable: true, type: 'select' },
  { key: 'sale_destination', label: '販売先', editable: true, type: 'select' },
  { key: 'sale_price', label: '売価', editable: true, type: 'number' },
  { key: 'commission', label: '手数料', editable: true, type: 'number' },
  { key: 'shipping_cost', label: '送料', editable: true, type: 'number' },
  { key: 'other_cost', label: 'その他', editable: true, type: 'number' },
  { key: 'purchase_price', label: '原価', editable: true, type: 'number' },
  { key: 'purchase_total', label: '仕入総額', editable: true, type: 'number' },
  { key: 'deposit_amount', label: '入金額', editable: true, type: 'number' },
  { key: 'profit', label: '利益', editable: false, type: 'readonly' },
  { key: 'profit_rate', label: '利益率', editable: false, type: 'readonly' },
  { key: 'purchase_date', label: '仕入日', editable: true, type: 'date' },
  { key: 'listing_date', label: '出品日', editable: true, type: 'date' },
  { key: 'sale_date', label: '売却日', editable: true, type: 'date' },
  { key: 'turnover_days', label: '回転日数', editable: false, type: 'readonly' },
  { key: 'cost_recovered', label: '原価回収', editable: true, type: 'readonly' },
]

// ジャンル（カテゴリ）の色設定
const categoryColors: Record<string, string> = {
  'ネクタイ': 'bg-blue-100 text-blue-800',
  'スカーフ': 'bg-purple-100 text-purple-800',
  'ベルト': 'bg-orange-100 text-orange-800',
  'バッグ': 'bg-pink-100 text-pink-800',
  '財布': 'bg-green-100 text-green-800',
  'アクセサリー': 'bg-yellow-100 text-yellow-800',
  'その他': 'bg-gray-100 text-gray-800',
}

export default function ManualSalesPage() {
  const { user, loading: authLoading, isViewerUser } = useAuth()
  // 編集可能かどうか（認証読み込み中は編集不可）
  const canEdit = !authLoading && !isViewerUser
  const [sales, setSales] = useState<ManualSale[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  // セル選択用の状態
  const [selectedCell, setSelectedCell] = useState<{ id: string; field: keyof ManualSale } | null>(null)
  // セル編集用の状態
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof ManualSale } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const editCellRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  // ドロップダウン位置
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  // 商品名モーダル編集用の状態
  const [modalEdit, setModalEdit] = useState<{ id: string; field: keyof ManualSale; value: string } | null>(null)
  // 画像編集モーダル用の状態
  const [imageEditModal, setImageEditModal] = useState<{ id: string; currentUrl: string | null } | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'main' | 'bulk'>('all')
  const [sortByImage, setSortByImage] = useState<'none' | 'hasImage' | 'noImage'>('none')
  // 列の表示/非表示（localStorageから復元）
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('manual-sales-hidden-columns')
      if (saved) {
        try {
          return new Set(JSON.parse(saved))
        } catch {
          return new Set()
        }
      }
    }
    return new Set()
  })
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  // 転記先選択モーダル用の状態
  const [transferModal, setTransferModal] = useState<{ sale: ManualSale; bulkPurchases: { id: string; genre: string; purchase_date: string }[] } | null>(null)
  // Undo履歴
  const [undoHistory, setUndoHistory] = useState<{ id: string; field: keyof ManualSale; oldValue: unknown; newValue: unknown }[]>([])

  // 新規追加モーダル用の状態
  const [addModal, setAddModal] = useState<{
    product_name: string
    brand_name: string
    category: string
    purchase_source: string
    sale_destination: string
    sale_price: string
    purchase_price: string
    purchase_date: string
    listing_date: string
    sale_date: string
    memo: string
  } | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)

  // 一括選択用
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // ラクマ手数料設定
  const [rakumaCommissionSettings, setRakumaCommissionSettings] = useState<Record<string, number>>({})

  // ヘッダー絞り込みフィルター用state
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [selectedPurchaseSources, setSelectedPurchaseSources] = useState<Set<string>>(new Set())
  const [selectedSaleDestinations, setSelectedSaleDestinations] = useState<Set<string>>(new Set())
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filterDropdownPosition, setFilterDropdownPosition] = useState<{ top: number; right: number } | null>(null)

  // CSVインポート用state
  const [csvImportModal, setCsvImportModal] = useState<{
    step: 'header-select' | 'mapping' | 'preview' | 'importing'
    csvHeaders: string[]
    csvData: Record<string, string>[]
    mapping: Record<string, string>
    progress: number
    rawText: string
    headerRow: number // 何行目をヘッダーとして使うか（1始まり）
    previewRows: string[][] // 最初の数行のプレビュー
    isAucnet?: boolean // オークネットCSV形式かどうか
  } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // 固定横スクロールバー用
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const fixedScrollbarRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState(1560)
  const [isMounted, setIsMounted] = useState(false)

  // マウント状態を追跡（Portal用）
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 列の表示/非表示設定をlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('manual-sales-hidden-columns', JSON.stringify(Array.from(hiddenColumns)))
  }, [hiddenColumns])

  // セル範囲選択用
  const [selectionRange, setSelectionRange] = useState<{
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // 表示する列をフィルタリング
  const visibleColumns = columns.filter(col => !hiddenColumns.has(col.key))

  // 固定横スクロールバーの同期
  useEffect(() => {
    if (!isMounted) return

    const tableContainer = tableContainerRef.current
    const fixedScrollbar = fixedScrollbarRef.current
    if (!tableContainer) return

    const updateScrollWidth = () => {
      const width = tableContainer.scrollWidth
      if (width > 0) {
        setScrollWidth(width)
      }
    }

    // 初期表示時に少し遅延させて確実にテーブルがレンダリングされた後に計算
    const timeoutId = setTimeout(updateScrollWidth, 200)

    // さらにrequestAnimationFrameでも確認
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(updateScrollWidth)
    })

    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(tableContainer)

    const handleTableScroll = () => {
      const scrollbar = fixedScrollbarRef.current
      if (scrollbar) {
        scrollbar.scrollLeft = tableContainer.scrollLeft
      }
    }

    const handleFixedScroll = () => {
      const scrollbar = fixedScrollbarRef.current
      if (tableContainer && scrollbar) {
        tableContainer.scrollLeft = scrollbar.scrollLeft
      }
    }

    tableContainer.addEventListener('scroll', handleTableScroll)

    // fixedScrollbarが存在する場合のみイベント登録
    const setupFixedScrollbar = () => {
      const scrollbar = fixedScrollbarRef.current
      if (scrollbar) {
        scrollbar.addEventListener('scroll', handleFixedScroll)
      }
    }

    // Portalのレンダリング後にイベント登録
    setTimeout(setupFixedScrollbar, 100)

    return () => {
      clearTimeout(timeoutId)
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      tableContainer.removeEventListener('scroll', handleTableScroll)
      const scrollbar = fixedScrollbarRef.current
      if (scrollbar) {
        scrollbar.removeEventListener('scroll', handleFixedScroll)
      }
    }
  }, [sales, loading, isMounted])

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      // 手入力売上データ取得
      let allSales: ManualSale[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('manual_sales')
          .select('*')
          .order('sale_date', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error fetching manual sales:', error)
          break
        }

        if (data && data.length > 0) {
          allSales = [...allSales, ...data]
          from += pageSize
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }
      setSales(allSales)

      // プラットフォーム（販路）取得
      const { data: platformData } = await supabase
        .from('platforms')
        .select('id, name, color_class, sales_type')
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

  // 日付の正規化
  const normalizeDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null
    return dateStr.replace(/\//g, '-')
  }

  // 日付を年と月日で改行して表示
  const formatDateWithBreak = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const match = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (match) {
      const year = match[1]
      const month = match[2].padStart(2, '0')
      const day = match[3].padStart(2, '0')
      return (
        <>
          <span className="text-[10px] text-gray-400">{year}</span>
          <br />
          <span className="text-xs">{month}/{day}</span>
        </>
      )
    }
    return dateStr
  }

  // 日付が有効かチェック
  const isValidDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false
    const normalized = normalizeDate(dateStr)
    if (!normalized) return false
    const date = new Date(normalized)
    return !isNaN(date.getTime())
  }

  // 年を抽出
  const extractYear = (dateStr: string | null): number | null => {
    if (!isValidDate(dateStr)) return null
    const normalized = normalizeDate(dateStr)
    if (!normalized) return null
    const date = new Date(normalized)
    return date.getFullYear()
  }

  // 月を抽出
  const extractMonth = (dateStr: string | null): number | null => {
    if (!isValidDate(dateStr)) return null
    const normalized = normalizeDate(dateStr)
    if (!normalized) return null
    const date = new Date(normalized)
    return date.getMonth() + 1
  }

  // 利用可能な年のリスト
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    // 現在の年を必ず追加
    years.add(new Date().getFullYear())
    sales.forEach(sale => {
      const year = extractYear(sale.sale_date)
      if (year) years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [sales])

  // フィルタリング
  const filteredSales = useMemo(() => {
    let result = sales.filter(sale => {
      // 年フィルター
      if (selectedYear && selectedYear !== '') {
        const saleYear = extractYear(sale.sale_date)
        if (saleYear !== parseInt(selectedYear)) return false
      }
      // 月フィルター
      if (selectedMonth && selectedMonth !== '') {
        const saleMonth = extractMonth(sale.sale_date)
        if (saleMonth !== parseInt(selectedMonth)) return false
      }
      // タイプフィルター
      if (saleTypeFilter !== 'all' && sale.sale_type !== saleTypeFilter) {
        return false
      }
      // ブランドフィルター
      if (selectedBrands.size > 0) {
        if (!sale.brand_name || !selectedBrands.has(sale.brand_name)) return false
      }
      // カテゴリフィルター
      if (selectedCategories.size > 0) {
        if (!sale.category || !selectedCategories.has(sale.category)) return false
      }
      // 仕入先フィルター
      if (selectedPurchaseSources.size > 0) {
        if (!sale.purchase_source || !selectedPurchaseSources.has(sale.purchase_source)) return false
      }
      // 販売先フィルター
      if (selectedSaleDestinations.size > 0) {
        if (!sale.sale_destination || !selectedSaleDestinations.has(sale.sale_destination)) return false
      }
      return true
    })

    // 画像有無でソート
    if (sortByImage === 'hasImage') {
      result = result.sort((a, b) => {
        const aHas = a.image_url ? 1 : 0
        const bHas = b.image_url ? 1 : 0
        return bHas - aHas // 画像ありが上
      })
    } else if (sortByImage === 'noImage') {
      result = result.sort((a, b) => {
        const aHas = a.image_url ? 1 : 0
        const bHas = b.image_url ? 1 : 0
        return aHas - bHas // 画像なしが上
      })
    }

    return result
  }, [sales, selectedYear, selectedMonth, saleTypeFilter, selectedBrands, selectedCategories, selectedPurchaseSources, selectedSaleDestinations, sortByImage])

  // 仮想スクロールは無効化（慣性スクロールのため）
  // const rowVirtualizer = useVirtualizer({
  //   count: filteredSales.length,
  //   getScrollElement: () => tableContainerRef.current,
  //   estimateSize: () => 41,
  //   overscan: 20,
  // })

  // カテゴリオプション（既存データから動的に生成）
  const categoryOptions = useMemo(() => {
    const uniqueCategories = new Set<string>()
    sales.forEach(sale => {
      if (sale.category) {
        uniqueCategories.add(sale.category)
      }
    })
    return Array.from(uniqueCategories)
      .sort((a, b) => a.localeCompare(b, 'ja'))
      .map((name, idx) => ({
        id: String(idx + 1),
        name,
        color_class: categoryColors[name] || 'bg-gray-100 text-gray-800'
      }))
  }, [sales])

  // フィルター用の選択肢を動的に生成
  const availableBrands = useMemo(() => {
    const brands = new Set<string>()
    sales.forEach(sale => {
      if (sale.brand_name) brands.add(sale.brand_name)
    })
    return Array.from(brands).sort((a, b) => a.localeCompare(b, 'ja'))
  }, [sales])

  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    sales.forEach(sale => {
      if (sale.category) categories.add(sale.category)
    })
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ja'))
  }, [sales])

  const availablePurchaseSources = useMemo(() => {
    const sources = new Set<string>()
    sales.forEach(sale => {
      if (sale.purchase_source) sources.add(sale.purchase_source)
    })
    return Array.from(sources).sort((a, b) => a.localeCompare(b, 'ja'))
  }, [sales])

  const availableSaleDestinations = useMemo(() => {
    const destinations = new Set<string>()
    sales.forEach(sale => {
      if (sale.sale_destination) destinations.add(sale.sale_destination)
    })
    return Array.from(destinations).sort((a, b) => a.localeCompare(b, 'ja'))
  }, [sales])

  // 利益計算
  const calculateProfit = (sale: Partial<ManualSale>): number => {
    const salePrice = sale.sale_price || 0
    const purchasePrice = sale.purchase_price || 0
    const otherCost = sale.other_cost || 0
    // 仕入総額がある場合はそれを使用、なければ原価のみ（修理費は別途引く）
    const purchaseTotal = sale.purchase_total ?? purchasePrice
    const commission = sale.commission || 0
    const shippingCost = sale.shipping_cost || 0
    // 修理費は別途引く
    return salePrice - purchaseTotal - commission - shippingCost - otherCost
  }

  // 利益率計算
  const calculateProfitRate = (sale: Partial<ManualSale>): number => {
    const salePrice = sale.sale_price || 0
    if (salePrice === 0) return 0
    const profit = calculateProfit(sale)
    let profitRate = Math.round((profit / salePrice) * 100 * 10) / 10
    // NaN/Infinityチェックとクランプ（NUMERIC(5,1)制限: -9999.9〜9999.9）
    if (!Number.isFinite(profitRate)) return 0
    return Math.max(-9999.9, Math.min(9999.9, profitRate))
  }

  // 回転日数計算
  const calculateTurnoverDays = (sale: Partial<ManualSale>): number | null => {
    if (!sale.listing_date || !sale.sale_date) return null
    if (!isValidDate(sale.listing_date) || !isValidDate(sale.sale_date)) return null
    const listingDate = new Date(normalizeDate(sale.listing_date)!)
    const saleDate = new Date(normalizeDate(sale.sale_date)!)
    const diffTime = saleDate.getTime() - listingDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= 0 ? diffDays : null
  }

  // 手数料自動計算（販売先と売価から）
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
      case 'オークネット':
        // 5%
        return Math.round(price * 0.05)
      case 'エコトレ':
        // 10% + 440円
        return Math.round(price * 0.1) + 440
      default:
        return null
    }
  }

  // セルクリックで選択 (ダブルクリックで編集開始)
  const handleCellClick = (sale: ManualSale, field: keyof ManualSale) => {
    // 編集不可
    if (!canEdit) return
    // 編集不可のフィールドはスキップ
    const readonlyFields: (keyof ManualSale)[] = ['id', 'profit', 'profit_rate', 'turnover_days', 'created_at']
    if (readonlyFields.includes(field)) return

    // 既に同じセルが選択されていて、編集中でなく、範囲選択がなければ編集開始
    if (selectedCell?.id === sale.id && selectedCell?.field === field && !editingCell && !selectionRange) {
      // 商品名はモーダルで編集
      if (field === 'product_name') {
        setModalEdit({ id: sale.id, field, value: sale.product_name || '' })
        return
      }
      const value = sale[field]
      setEditingCell({ id: sale.id, field })
      setEditValue(value != null ? String(value) : '')
      return
    }

    // 他のセルを編集中なら先に保存
    if (editingCell) {
      saveEditingCell()
    }

    // セルを選択
    // 注意: selectionRangeはhandleCellMouseDownで設定されるのでここではリセットしない
    setSelectedCell({ id: sale.id, field })
  }

  // ダブルクリックで編集開始
  const handleCellDoubleClick = (sale: ManualSale, field: keyof ManualSale) => {
    // 編集不可
    if (!canEdit) return
    const readonlyFields: (keyof ManualSale)[] = ['id', 'profit', 'profit_rate', 'turnover_days', 'created_at']
    if (readonlyFields.includes(field)) return

    if (editingCell) {
      saveEditingCell()
    }

    // 商品名はモーダルで編集
    if (field === 'product_name') {
      setModalEdit({ id: sale.id, field, value: sale.product_name || '' })
      setSelectionRange(null)
      return
    }

    const value = sale[field]
    setSelectedCell({ id: sale.id, field })
    setSelectionRange(null)
    setEditingCell({ id: sale.id, field })
    setEditValue(value != null ? String(value) : '')
  }

  // 選択中のセルかどうか
  const isSelectedCell = (id: string, field: keyof ManualSale) => {
    return selectedCell?.id === id && selectedCell?.field === field
  }

  // 編集可能なカラムのみ取得
  const editableColumns = columns.filter(col => col.editable && col.key !== 'no' && col.key !== 'checkbox' && col.key !== 'image_url')

  // セル編集の保存
  const saveEditingCell = useCallback(async () => {
    if (!editingCell) return

    const { id, field } = editingCell
    const sale = sales.find(s => s.id === id)
    if (!sale) {
      setEditingCell(null)
      return
    }

    const currentValue = sale[field]
    const currentValueStr = currentValue != null ? String(currentValue) : ''

    // 値が変わっていなければ何もしない
    if (editValue === currentValueStr) {
      setEditingCell(null)
      return
    }

    // 値の変換
    let newValue: string | number | null = editValue
    const numericFields: (keyof ManualSale)[] = ['purchase_price', 'purchase_total', 'sale_price', 'commission', 'shipping_cost', 'other_cost', 'deposit_amount']

    if (numericFields.includes(field)) {
      newValue = editValue === '' ? null : parseInt(editValue) || 0
    } else if (editValue === '') {
      newValue = null
    }

    // 売価入力時：業販（toB）の場合は税抜き価格を税込み価格に自動変換（×1.1）
    if (field === 'sale_price' && typeof newValue === 'number' && newValue > 0) {
      const destination = sale.sale_destination
      if (destination) {
        const platform = platforms.find(p => p.name === destination)
        if (platform?.sales_type === 'toB') {
          newValue = Math.round(newValue * 1.1)
        }
      }
    }

    // 日付フィールドの正規化
    const dateFields: (keyof ManualSale)[] = ['purchase_date', 'listing_date', 'sale_date']
    if (dateFields.includes(field) && newValue) {
      newValue = normalizeDate(String(newValue))
    }

    // ローカル状態を更新
    const updatedSale = { ...sale, [field]: newValue }

    // 原価が変更された場合、仕入総額を更新（修理費は含めない）
    if (field === 'purchase_price') {
      const newPurchasePrice = newValue as number || 0
      updatedSale.purchase_total = newPurchasePrice
    }

    // 販売先または売価が変更された場合、手数料を自動計算
    let autoCommission: number | null = updatedSale.commission
    if (field === 'sale_destination' || field === 'sale_price') {
      const newCommission = calculateCommission(
        field === 'sale_destination' ? (newValue as string) : updatedSale.sale_destination,
        field === 'sale_price' ? (newValue as number) : updatedSale.sale_price,
        updatedSale.sale_date
      )
      if (newCommission !== null) {
        autoCommission = newCommission
        updatedSale.commission = newCommission
      }
    }

    // 利益・利益率・回転日数を再計算
    const profit = calculateProfit(updatedSale)
    const profitRate = calculateProfitRate(updatedSale)
    const turnoverDays = calculateTurnoverDays(updatedSale)

    // Undo履歴に追加
    setUndoHistory(prev => [...prev, { id, field, oldValue: currentValue, newValue }])

    const updateData: Record<string, unknown> = {
      [field]: newValue,
      profit,
      profit_rate: profitRate,
      turnover_days: turnoverDays,
    }
    // 手数料が自動計算された場合は一緒に更新
    if (field === 'sale_destination' || field === 'sale_price') {
      updateData.commission = autoCommission
    }
    // 原価が変更された場合は仕入総額も更新
    if (field === 'purchase_price') {
      updateData.purchase_total = updatedSale.purchase_total
    }

    setSales(sales.map(s => s.id === id ? { ...s, ...updateData } as ManualSale : s))
    setEditingCell(null)

    // DBに保存
    const { error } = await supabase
      .from('manual_sales')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating cell:', error)
      // エラー時は元に戻す
      setSales(sales.map(s => s.id === id ? sale : s))
    }
  }, [editingCell, editValue, sales])

  // モーダル編集の保存
  const saveModalEdit = async () => {
    if (!modalEdit) return

    const { id, field, value } = modalEdit
    const sale = sales.find(s => s.id === id)
    if (!sale) {
      setModalEdit(null)
      return
    }

    // 変更がなければ何もしない
    if (sale[field] === value) {
      setModalEdit(null)
      return
    }

    // Undo履歴に追加
    setUndoHistory(prev => [...prev, { id, field, oldValue: sale[field], newValue: value }])

    // ローカル状態を更新
    setSales(sales.map(s => s.id === id ? { ...s, [field]: value } : s))
    setModalEdit(null)

    // DBに保存
    const { error } = await supabase
      .from('manual_sales')
      .update({ [field]: value })
      .eq('id', id)

    if (error) {
      console.error('Error updating modal edit:', error)
      // エラー時は元に戻す
      setSales(sales.map(s => s.id === id ? sale : s))
    }
  }

  // Undo機能
  const handleUndo = useCallback(async () => {
    if (undoHistory.length === 0) return

    const lastAction = undoHistory[undoHistory.length - 1]
    const { id, field, oldValue } = lastAction

    // 履歴から削除
    setUndoHistory(prev => prev.slice(0, -1))

    // ローカル状態を元に戻す
    const sale = sales.find(s => s.id === id)
    if (!sale) return

    const updatedSale = { ...sale, [field]: oldValue }
    const profit = calculateProfit(updatedSale)
    const profitRate = calculateProfitRate(updatedSale)
    const turnoverDays = calculateTurnoverDays(updatedSale)

    setSales(sales.map(s => s.id === id ? { ...s, [field]: oldValue, profit, profit_rate: profitRate, turnover_days: turnoverDays } : s))

    // DBに保存
    await supabase
      .from('manual_sales')
      .update({
        [field]: oldValue,
        profit,
        profit_rate: profitRate,
        turnover_days: turnoverDays,
      })
      .eq('id', id)
  }, [undoHistory, sales])

  // Cmd+Z / Ctrl+Z でUndo
  useEffect(() => {
    const handleUndoKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }

    document.addEventListener('keydown', handleUndoKeyDown)
    return () => document.removeEventListener('keydown', handleUndoKeyDown)
  }, [handleUndo])

  // 外側クリックで保存 & フィルタードロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingCell && editCellRef.current && !editCellRef.current.contains(e.target as Node)) {
        saveEditingCell()
      }
      // フィルタードロップダウンを閉じる
      const target = e.target as HTMLElement
      if (openFilter && !target.closest('.filter-dropdown') && !target.closest('button')) {
        setOpenFilter(null)
        setFilterDropdownPosition(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCell, saveEditingCell, openFilter])

  // キーボード操作（編集中）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell) return

    // IME入力中（変換確定のEnter）は無視
    if (e.nativeEvent.isComposing) return

    if (e.key === 'Enter') {
      e.preventDefault()
      saveEditingCell()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingCell(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      saveEditingCell()
    }
  }

  // グローバルキーボード操作（選択状態）
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // モーダルが開いている場合は無視
      if (imageEditModal || modalEdit) return

      // 編集中の場合は無視
      if (editingCell) return

      // 選択中のセルがない場合は無視
      if (!selectedCell) return

      const { id, field } = selectedCell
      const sale = filteredSales.find(s => s.id === id)
      if (!sale) return

      const currentRowIndex = filteredSales.findIndex(s => s.id === id)
      const currentColIndex = editableColumns.findIndex(col => col.key === field)

      // 矢印キーでセル移動
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        let newRowIndex = currentRowIndex
        let newColIndex = currentColIndex

        if (e.key === 'ArrowUp' && currentRowIndex > 0) {
          newRowIndex = currentRowIndex - 1
        } else if (e.key === 'ArrowDown' && currentRowIndex < filteredSales.length - 1) {
          newRowIndex = currentRowIndex + 1
        } else if (e.key === 'ArrowLeft' && currentColIndex > 0) {
          newColIndex = currentColIndex - 1
        } else if (e.key === 'ArrowRight' && currentColIndex < editableColumns.length - 1) {
          newColIndex = currentColIndex + 1
        }

        if (newRowIndex !== currentRowIndex || newColIndex !== currentColIndex) {
          const newSaleItem = filteredSales[newRowIndex]
          const newField = editableColumns[newColIndex].key as keyof ManualSale
          setSelectedCell({ id: newSaleItem.id, field: newField })
        }
        return
      }

      // Enterで編集開始
      if (e.key === 'Enter') {
        e.preventDefault()
        const value = sale[field]
        setEditingCell({ id, field })
        setEditValue(value != null ? String(value) : '')
        return
      }

      // Escapeで選択解除
      if (e.key === 'Escape') {
        e.preventDefault()
        setSelectedCell(null)
        return
      }

      // Ctrl+C / Cmd+C でコピー
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const value = sale[field]
        if (value != null) {
          navigator.clipboard.writeText(String(value))
        }
        return
      }

      // 数字や文字を入力したら編集開始
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const readonlyFields: (keyof ManualSale)[] = ['id', 'profit', 'profit_rate', 'turnover_days', 'created_at']
        if (readonlyFields.includes(field)) return

        // select系のフィールドは文字入力で編集開始しない
        if (field === 'purchase_source' || field === 'sale_destination') return

        e.preventDefault()
        setEditingCell({ id, field })
        setEditValue(e.key)
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [selectedCell, editingCell, filteredSales, editableColumns, imageEditModal, modalEdit])

  // 新規追加モーダルを開く
  const handleOpenAddModal = () => {
    // 今日の日付をデフォルト値に
    const today = new Date().toISOString().split('T')[0]
    setAddModal({
      product_name: '',
      brand_name: '',
      category: '',
      purchase_source: '',
      sale_destination: '',
      sale_price: '',
      purchase_price: '',
      purchase_date: '',
      listing_date: '',
      sale_date: today,
      memo: '',
    })
  }

  // 新規追加モーダルからデータを保存
  const handleSaveNewSale = async () => {
    if (!addModal) return
    if (!addModal.product_name.trim()) {
      alert('商品名を入力してください')
      return
    }

    setIsAddingNew(true)

    // 数値変換
    const salePrice = addModal.sale_price ? parseInt(addModal.sale_price) || 0 : null
    const purchasePrice = addModal.purchase_price ? parseInt(addModal.purchase_price) || 0 : null

    // 手数料自動計算
    const commission = calculateCommission(
      addModal.sale_destination || null,
      salePrice,
      addModal.sale_date || null
    )

    // 売価入力時：業販（toB）の場合は税抜き価格を税込み価格に自動変換（×1.1）
    let finalSalePrice = salePrice
    if (salePrice && addModal.sale_destination) {
      const platform = platforms.find(p => p.name === addModal.sale_destination)
      if (platform?.sales_type === 'toB') {
        finalSalePrice = Math.round(salePrice * 1.1)
      }
    }

    // 仕入総額（原価のみ、その他費用は後で編集）
    const purchaseTotal = purchasePrice || 0

    // 利益計算用のデータ
    const saleData = {
      sale_price: finalSalePrice,
      purchase_price: purchasePrice,
      purchase_total: purchaseTotal,
      commission: commission,
      shipping_cost: null,
      other_cost: null,
      listing_date: addModal.listing_date || null,
      sale_date: addModal.sale_date || null,
    }
    const profit = calculateProfit(saleData)
    const profitRate = calculateProfitRate(saleData)
    const turnoverDays = calculateTurnoverDays(saleData)

    const { data, error } = await supabase
      .from('manual_sales')
      .insert([{
        product_name: addModal.product_name.trim(),
        brand_name: addModal.brand_name.trim() || null,
        category: addModal.category || null,
        purchase_source: addModal.purchase_source || null,
        sale_destination: addModal.sale_destination || null,
        sale_price: finalSalePrice,
        purchase_price: purchasePrice,
        purchase_total: purchaseTotal,
        commission: commission,
        purchase_date: addModal.purchase_date || null,
        listing_date: addModal.listing_date || null,
        sale_date: addModal.sale_date || null,
        memo: addModal.memo.trim() || null,
        sale_type: 'main',
        profit: profit,
        profit_rate: profitRate,
        turnover_days: turnoverDays,
      }])
      .select()

    setIsAddingNew(false)

    if (error) {
      console.error('Error adding new row:', error)
      alert('追加に失敗しました: ' + error.message)
      return
    }

    if (data && data.length > 0) {
      setSales(prev => [data[0], ...prev])
      setAddModal(null)
    }
  }

  // 画像モーダルを開く
  const openImageModal = (sale: ManualSale) => {
    setImageEditModal({ id: sale.id, currentUrl: sale.image_url })
    setImageUrlInput(sale.image_url || '')
  }


  // ファイルアップロード処理（ドラッグ&ドロップ対応）
  const handleImageDrop = async (id: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください')
      return
    }

    setIsUploadingImage(true)

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string

        const response = await fetch('/api/save-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            fileName: file.name,
          }),
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const { url } = await response.json()

        const { error } = await supabase
          .from('manual_sales')
          .update({ image_url: url })
          .eq('id', id)

        if (error) {
          console.error('Error updating image:', error)
          alert('画像の保存に失敗しました')
          setIsUploadingImage(false)
          return
        }

        setSales(sales.map(s =>
          s.id === id ? { ...s, image_url: url } : s
        ))
        setImageEditModal(null)
        setImageUrlInput('')
        setIsUploadingImage(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Upload error:', error)
      alert('アップロードに失敗しました')
      setIsUploadingImage(false)
    }
  }

  // URL保存処理
  const handleSaveImageUrl = async (id: string, url: string) => {
    if (!url.trim()) return

    const { error } = await supabase
      .from('manual_sales')
      .update({ image_url: url.trim() })
      .eq('id', id)

    if (error) {
      console.error('Error updating image:', error)
      alert('画像の保存に失敗しました')
      return
    }

    setSales(sales.map(s =>
      s.id === id ? { ...s, image_url: url.trim() } : s
    ))
    setImageEditModal(null)
    setImageUrlInput('')
  }

  // チェックボックス選択
  const isItemSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const handleSelectItem = useCallback((id: string, index: number, shiftKey: boolean) => {
    setSelectedIds(prevSelectedIds => {
      const newSet = new Set(prevSelectedIds)
      if (shiftKey && lastSelectedIndex !== null) {
        // Shift+クリック: 範囲選択
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (let i = start; i <= end; i++) {
          newSet.add(filteredSales[i].id)
        }
      } else {
        // 通常クリック: トグル
        if (newSet.has(id)) {
          newSet.delete(id)
        } else {
          newSet.add(id)
        }
      }
      return newSet
    })
    if (!shiftKey) {
      setLastSelectedIndex(index)
    }
  }, [lastSelectedIndex, filteredSales])

  // 全選択/全解除
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredSales.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSales.map(s => s.id)))
    }
  }, [selectedIds.size, filteredSales])

  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('削除するデータを選択してください')
      return
    }
    if (!confirm(`${selectedIds.size}件のデータを削除しますか？`)) return

    const ids = Array.from(selectedIds)
    const batchSize = 100
    let hasError = false

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const { error } = await supabase.from('manual_sales').delete().in('id', batch)
      if (error) {
        console.error('削除エラー:', error)
        hasError = true
        break
      }
    }

    if (hasError) {
      alert('削除に失敗しました')
    } else {
      setSales(sales.filter(s => !selectedIds.has(s.id)))
      setSelectedIds(new Set())
    }
  }

  // 原価回収チェック時にモーダルを表示
  const handleCostRecoveredChange = async (sale: ManualSale, checked: boolean) => {
    if (!checked) {
      // チェックを外す場合、bulk_salesから転記データを削除
      const { error: deleteError } = await supabase
        .from('bulk_sales')
        .delete()
        .like('memo', `%手入力売上から転記 (ID: ${sale.id})%`)

      if (deleteError) {
        console.error('Error deleting from bulk_sales:', deleteError)
        alert('まとめ在庫からの削除に失敗しました')
        return
      }

      // 元の仕入総額と利益を再計算（仕入総額は原価のみ、修理費は別途引く）
      const purchasePrice = sale.purchase_price || 0
      const otherCost = sale.other_cost || 0
      const originalPurchaseTotal = purchasePrice
      const salePrice = sale.sale_price || 0
      const commission = sale.commission || 0
      const shippingCost = sale.shipping_cost || 0
      const profit = salePrice - originalPurchaseTotal - commission - shippingCost - otherCost
      let profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100 * 10) / 10 : 0
      // NaN/Infinityチェックとクランプ（NUMERIC(5,1)制限: -9999.9〜9999.9）
      if (!Number.isFinite(profitRate)) profitRate = 0
      profitRate = Math.max(-9999.9, Math.min(9999.9, profitRate))
      const safeProfit = Number.isFinite(profit) ? profit : 0

      // manual_salesを更新（仕入総額・利益を元に戻す）
      setSales(sales.map(s => s.id === sale.id ? {
        ...s,
        cost_recovered: false,
        purchase_total: originalPurchaseTotal,
        profit: safeProfit,
        profit_rate: profitRate
      } : s))
      await supabase.from('manual_sales').update({
        cost_recovered: false,
        purchase_total: originalPurchaseTotal,
        profit: safeProfit,
        profit_rate: profitRate
      }).eq('id', sale.id)
      return
    }

    // チェックを入れる場合、まとめ仕入れ一覧を取得してモーダルを表示
    const { data: bulkPurchases, error: fetchError } = await supabase
      .from('bulk_purchases')
      .select('id, genre, purchase_date')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching bulk_purchases:', fetchError)
      alert('まとめ仕入れの取得に失敗しました')
      return
    }

    // ジャンルごとに1つだけ表示（最新のものを使用）
    const genreMap = new Map<string, { id: string; genre: string; purchase_date: string }>()
    for (const bp of bulkPurchases || []) {
      if (!genreMap.has(bp.genre)) {
        genreMap.set(bp.genre, bp)
      }
    }
    const uniqueBulkPurchases = Array.from(genreMap.values())

    setTransferModal({ sale, bulkPurchases: uniqueBulkPurchases })
  }

  // 転記実行
  const executeTransfer = async (targetPurchaseId: string | null) => {
    if (!transferModal) return

    const sale = transferModal.sale

    // 入金額を取得（仕入総額として設定し、利益を0にする）
    const depositAmount = sale.deposit_amount || (sale.sale_price || 0) - (sale.commission || 0) - (sale.shipping_cost || 0) - (sale.other_cost || 0)

    // ローカル状態を更新（仕入総額=入金額、利益=0、利益率=0）
    setSales(sales.map(s => s.id === sale.id ? {
      ...s,
      cost_recovered: true,
      purchase_total: depositAmount,
      profit: 0,
      profit_rate: 0
    } : s))

    // DBに保存（仕入総額=入金額、利益=0、利益率=0）
    const { error: updateError } = await supabase
      .from('manual_sales')
      .update({
        cost_recovered: true,
        purchase_total: depositAmount,
        profit: 0,
        profit_rate: 0
      })
      .eq('id', sale.id)

    if (updateError) {
      console.error('Error updating cost_recovered:', updateError)
      setSales(sales.map(s => s.id === sale.id ? { ...s, cost_recovered: false } : s))
      setTransferModal(null)
      return
    }

    // bulk_salesに転記（原価回収なので、purchase_price = 入金額にして利益を0にする）
    const insertData: Record<string, unknown> = {
      product_name: sale.product_name,
      brand_name: sale.brand_name,
      category: sale.category,
      image_url: sale.image_url,
      purchase_price: depositAmount,
      sale_date: sale.sale_date || new Date().toISOString().split('T')[0],
      sale_destination: sale.sale_destination,
      quantity: 1,
      sale_amount: sale.sale_price,
      commission: sale.commission || 0,
      shipping_cost: sale.shipping_cost || 0,
      other_cost: sale.other_cost || 0,
      deposit_amount: depositAmount,
      listing_date: sale.listing_date,
      memo: `手入力売上から転記 (ID: ${sale.id})`,
    }

    // 仕入別の場合はbulk_purchase_idを追加
    if (targetPurchaseId) {
      insertData.bulk_purchase_id = targetPurchaseId
    }

    const { error: insertError } = await supabase
      .from('bulk_sales')
      .insert(insertData)

    if (insertError) {
      console.error('Error inserting to bulk_sales:', JSON.stringify(insertError, null, 2))
      alert('売上明細への転記に失敗しました: ' + (insertError.message || JSON.stringify(insertError)))
      // チェックを戻す
      setSales(sales.map(s => s.id === sale.id ? { ...s, cost_recovered: false } : s))
      await supabase.from('manual_sales').update({ cost_recovered: false }).eq('id', sale.id)
    } else {
      alert(targetPurchaseId ? '仕入別の売上明細に転記しました' : '通算の売上明細に転記しました')
    }

    setTransferModal(null)
  }

  // 集計
  const summary = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + (s.sale_price || 0), 0)
    const totalPurchase = filteredSales.reduce((sum, s) => sum + (s.purchase_total || s.purchase_price || 0), 0)
    const totalProfit = filteredSales.reduce((sum, s) => sum + (s.profit || 0), 0)
    const avgProfitRate = filteredSales.length > 0
      ? Math.round(filteredSales.reduce((sum, s) => sum + (s.profit_rate || 0), 0) / filteredSales.length * 10) / 10
      : 0
    return { totalSales, totalPurchase, totalProfit, avgProfitRate, count: filteredSales.length }
  }, [filteredSales])

  // 仕入先はsuppliersテーブルから、販路はplatformsテーブルから
  const purchasePlatforms = suppliers
  const salePlatforms = platforms

  // 仕入先列の幅を最長の名前に基づいて計算
  const purchaseSourceWidth = useMemo(() => {
    if (suppliers.length === 0) return 90
    const maxLength = Math.max(...suppliers.map(s => s.name.length))
    // 日本語1文字あたり約14px + パディング(20px) + 矢印(16px)
    const calculatedWidth = maxLength * 14 + 36
    return Math.max(80, Math.min(180, calculatedWidth))
  }, [suppliers])

  // 販売先列の幅を最長の名前に基づいて計算
  const saleDestinationWidth = useMemo(() => {
    if (platforms.length === 0) return 90
    const maxLength = Math.max(...platforms.map(p => p.name.length))
    // 日本語1文字あたり約14px + パディング(20px) + 矢印(16px)
    const calculatedWidth = maxLength * 14 + 36
    return Math.max(80, Math.min(180, calculatedWidth))
  }, [platforms])

  // 列幅の定義
  const colWidths = useMemo(() => ({
    checkbox: 35,
    no: 40,
    inventory_number: 70,
    image_url: 50,
    category: 95,
    brand_name: 85,
    product_name: 240,
    purchase_source: purchaseSourceWidth,
    sale_destination: saleDestinationWidth,
    sale_price: 50,
    commission: 60,
    shipping_cost: 50,
    other_cost: 60,
    purchase_price: 50,
    purchase_total: 70,
    deposit_amount: 60,
    profit: 70,
    profit_rate: 65,
    purchase_date: 70,
    listing_date: 70,
    sale_date: 80,
    memo: 60,
    turnover_days: 70,
    cost_recovered: 70,
  }), [purchaseSourceWidth, saleDestinationWidth])

  // 可視列の合計幅を計算
  const tableWidth = useMemo(() => {
    return visibleColumns.reduce((sum, col) => {
      return sum + (colWidths[col.key as keyof typeof colWidths] || 80)
    }, 0)
  }, [visibleColumns, colWidths])

  // CSVインポート用の列定義
  const CSV_IMPORT_COLUMNS = [
    { key: 'product_name', label: '商品名' },
    { key: 'brand_name', label: 'ブランド' },
    { key: 'category', label: 'ジャンル' },
    { key: 'purchase_source', label: '仕入先' },
    { key: 'sale_destination', label: '販路' },
    { key: 'sale_price', label: '売価' },
    { key: 'commission', label: '手数料' },
    { key: 'shipping_cost', label: '送料' },
    { key: 'other_cost', label: 'その他経費' },
    { key: 'purchase_price', label: '原価' },
    { key: 'purchase_total', label: '仕入総額' },
    { key: 'deposit_amount', label: '入金額' },
    { key: 'purchase_date', label: '仕入日' },
    { key: 'listing_date', label: '出品日' },
    { key: 'sale_date', label: '売却日' },
    { key: 'memo', label: 'メモ' },
    { key: 'image_url', label: '画像URL' },
    { key: 'inventory_number', label: '管理番号' },
  ]

  const CSV_MAPPING_KEYWORDS: Record<string, string[]> = {
    product_name: ['商品名', '品名', 'アイテム名', 'item_name', 'name', '商品', '品目'],
    brand_name: ['ブランド', 'brand', 'メーカー', 'maker', 'ブランド名'],
    category: ['カテゴリ', 'category', '種類', '分類', 'ジャンル', '商品区分', '区分'],
    image_url: ['画像', 'image', 'photo', '写真', 'url'],
    purchase_price: ['原価', '仕入値', '仕入れ値', '請求商品代'],
    purchase_total: ['仕入総額', '総額', 'total', '支払/請求税込合計'],
    sale_price: ['販売価格', '売価', '売値', '出品価格', 'selling_price'],
    commission: ['手数料', 'commission', 'fee', '請求手数料'],
    shipping_cost: ['送料', 'shipping', '配送料'],
    other_cost: ['経費', 'その他', 'other', '諸経費'],
    deposit_amount: ['入金', '入金額', 'deposit'],
    purchase_date: ['仕入日', '購入日', 'purchase_date', '取引日'],
    listing_date: ['出品日', 'listing_date'],
    sale_date: ['売却日', '販売日', 'sale_date', '売上日'],
    purchase_source: ['仕入先', '仕入れ先', 'source', '出品者'],
    sale_destination: ['販路', '販売先', '出品先', 'destination'],
    memo: ['メモ', 'memo', 'note', '備考', 'コメント'],
    inventory_number: ['管理番号', '番号', 'number', 'id', '受付番号'],
  }

  // オークネットCSV形式かどうかを判定
  const isAucnetCSV = (headers: string[]): boolean => {
    const aucnetHeaders = ['受付番号', 'せり順', 'ジャンル', 'ブランド名', '商品名', '請求商品代', '支払/請求税込合計']
    // ヘッダーから引用符と空白を除去して比較
    const cleanHeaders = headers.map(h => h.replace(/^["']|["']$/g, '').trim())
    const matchCount = aucnetHeaders.filter(h => cleanHeaders.includes(h)).length
    console.log('isAucnetCSV check:', { headers: cleanHeaders.slice(0, 7), matchCount })
    return matchCount >= 4
  }

  // オークネットCSV用の自動マッピング
  const autoMappingAucnetCSV = (headers: string[]): Record<string, string> => {
    const result: Record<string, string> = {}
    headers.forEach(header => {
      switch (header) {
        case '受付番号': result[header] = 'inventory_number'; break
        case 'ジャンル': result[header] = 'category'; break
        case 'ブランド名': result[header] = 'brand_name'; break
        case '商品名': result[header] = 'product_name'; break
        case '請求商品代': result[header] = 'purchase_price'; break
        case '支払/請求税込合計': result[header] = 'purchase_total'; break
        case '請求手数料税込': result[header] = 'commission'; break
        case '備考': result[header] = 'memo'; break
      }
    })
    return result
  }

  // オークネット画像CSVをパース: 受付番号 → URL のマップを作成
  // URLパターン: https://image.brand-auc.com/.../J847_844-31577_01L.jpg → 受付番号: 844-31577
  const parseAucnetImageCSV = (file: File): Promise<Map<string, string>> => {
    return new Promise((resolve) => {
      const imageMap = new Map<string, string>()
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          for (const row of results.data as string[][]) {
            // 最初の列からURLを取得（引用符を除去）
            const url = (row[0] || '').replace(/^"/, '').replace(/"$/, '').trim()
            if (url && url.startsWith('http')) {
              // URLから受付番号を抽出: J847_844-31577_01L.jpg → 844-31577
              const match = url.match(/J\d+_(\d+-\d+)_/)
              if (match) {
                const receiptNum = match[1]
                imageMap.set(receiptNum, url)
              }
            }
          }
          console.log(`オークネット画像CSV: ${imageMap.size}件の画像URLを取得`)
          resolve(imageMap)
        },
        error: () => resolve(imageMap)
      })
    })
  }

  // ファイル名から日付を抽出（yyyy/mm/dd または yyyy-mm-dd 形式）
  const extractDateFromFileName = (fileName: string): string | null => {
    // yyyy/mm/dd 形式
    const slashMatch = fileName.match(/(\d{4})\/(\d{2})\/(\d{2})/)
    if (slashMatch) {
      return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`
    }
    // yyyy-mm-dd 形式
    const dashMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (dashMatch) {
      return `${dashMatch[1]}-${dashMatch[2]}-${dashMatch[3]}`
    }
    // yyyymmdd 形式（8桁連続）
    const numMatch = fileName.match(/(\d{4})(\d{2})(\d{2})/)
    if (numMatch) {
      const year = parseInt(numMatch[1])
      const month = parseInt(numMatch[2])
      const day = parseInt(numMatch[3])
      if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${numMatch[1]}-${numMatch[2]}-${numMatch[3]}`
      }
    }
    return null
  }

  // オークネットCSVを直接インポート
  const executeAucnetImport = async (csvData: Record<string, string>[], imageMap: Map<string, string> | null, purchaseDate: string | null = null) => {
    // 列名からデータを取得（引用符付き/なし両対応）
    const getCol = (row: Record<string, string>, colName: string): string => {
      return row[colName] || row[`"${colName}"`] || ''
    }

    // 無効な行をフィルタリング
    const filteredData = csvData.filter(row => {
      const receiptNum = getCol(row, '受付番号').trim()
      if (!receiptNum) return false
      const purchasePrice = parseFloat((getCol(row, '請求商品代') || '0').replace(/,/g, ''))
      if (purchasePrice <= 0) return false
      return true
    })

    if (filteredData.length === 0) {
      alert('インポート対象のデータがありません')
      return
    }

    let success = 0
    let failed = 0
    const batchSize = 50

    for (let i = 0; i < filteredData.length; i += batchSize) {
      const batch = filteredData.slice(i, i + batchSize)

      const records = batch.map(row => {
        const receiptNum = getCol(row, '受付番号').trim()

        // ブランド名をクリーンアップ
        let brandName = getCol(row, 'ブランド名')
        brandName = brandName.replace(/\s+/g, ' ').trim()
        brandName = brandName.replace(/[（\(][^）\)]*[）\)]$/, '').trim()
        brandName = brandName.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
        )

        const purchasePrice = parseCSVNumber(getCol(row, '請求商品代')) || 0
        const purchaseTotal = parseCSVNumber(getCol(row, '支払/請求税込合計')) || 0

        // 画像URLを取得
        const imageUrl = imageMap?.get(receiptNum) || null

        return {
          sale_type: 'main',
          inventory_number: receiptNum || null,
          category: getCol(row, 'ジャンル').trim() || null,
          brand_name: brandName || null,
          product_name: getCol(row, '商品名').trim() || null,
          purchase_price: purchasePrice,
          purchase_total: purchaseTotal,
          purchase_source: 'オークネット',
          purchase_date: purchaseDate,
          image_url: imageUrl,
          profit: 0 - purchaseTotal,
          profit_rate: 0,
        }
      }).filter(r => r.product_name || r.brand_name)

      if (records.length === 0) continue

      const { error } = await supabase.from('manual_sales').insert(records)
      if (error) {
        console.error('インポートエラー:', error)
        failed += batch.length
      } else {
        success += records.length
      }
    }

    alert(`オークネットCSVインポート完了\n成功: ${success}件\n失敗: ${failed}件`)

    // データを再取得
    let allNewSales: ManualSale[] = []
    let fromIdx = 0
    const pgSize = 1000
    let moreData = true
    while (moreData) {
      const { data: pageData } = await supabase
        .from('manual_sales')
        .select('*')
        .order('sale_date', { ascending: false })
        .range(fromIdx, fromIdx + pgSize - 1)
      if (pageData && pageData.length > 0) {
        allNewSales = [...allNewSales, ...pageData]
        fromIdx += pgSize
        moreData = pageData.length === pgSize
      } else {
        moreData = false
      }
    }
    setSales(allNewSales)
  }

  const autoMappingCSV = (headers: string[]): Record<string, string> => {
    const result: Record<string, string> = {}
    headers.forEach(header => {
      // 全角スペースも除去
      const lowerHeader = header.toLowerCase().trim().replace(/[\s　]+/g, '')
      for (const [column, keywords] of Object.entries(CSV_MAPPING_KEYWORDS)) {
        const exactMatch = keywords.some(keyword => lowerHeader === keyword.toLowerCase())
        if (exactMatch && !Object.values(result).includes(column)) {
          result[header] = column
          break
        }
      }
    })
    headers.forEach(header => {
      if (result[header]) return
      // 全角スペースも除去
      const lowerHeader = header.toLowerCase().trim().replace(/[\s　]+/g, '')
      for (const [column, keywords] of Object.entries(CSV_MAPPING_KEYWORDS)) {
        if (Object.values(result).includes(column)) continue
        for (const keyword of keywords) {
          const cleanKeyword = keyword.toLowerCase().replace(/[\s　]+/g, '')
          if (lowerHeader.includes(cleanKeyword) || cleanKeyword.includes(lowerHeader)) {
            result[header] = column
            break
          }
        }
        if (result[header]) break
      }
    })
    return result
  }

  const parseCSVDate = (value: string): string | null => {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    const formats = [
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})/,
      /^(\d{4})年(\d{1,2})月(\d{1,2})日/,
    ]
    for (const format of formats) {
      const match = trimmed.match(format)
      if (match) {
        const year = parseInt(match[1])
        const month = parseInt(match[2])
        const day = parseInt(match[3])
        if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
      }
    }
    return trimmed
  }

  const parseCSVNumber = (value: string): number | null => {
    if (!value) return null
    // 括弧、円マーク、カンマ、パーセントを除去し、絶対値で返す
    const cleaned = value.replace(/[\(（\)）,￥¥円$%％]/g, '').trim()
    const num = parseFloat(cleaned)
    if (isNaN(num)) return null
    return Math.abs(num)
  }

  // 複数ファイル対応: オークネットの場合は計算書CSVと画像CSVを同時選択可能
  const handleCSVFilesSelect = async (files: FileList) => {
    const fileArray = Array.from(files)

    // ファイルを読み込んでテキストとして返す（エンコード自動判定）
    const readFileAsText = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const text = event.target?.result as string
          const hasJapanese = /[あ-んア-ン一-龯]/.test(text)
          const hasGarbage = /[\ufffd\u0000-\u001f]/.test(text) && !hasJapanese
          if (hasGarbage || (!hasJapanese && text.includes('�'))) {
            const sjisReader = new FileReader()
            sjisReader.onload = (e) => resolve(e.target?.result as string)
            sjisReader.readAsText(file, 'Shift_JIS')
          } else {
            resolve(text)
          }
        }
        reader.readAsText(file, 'UTF-8')
      })
    }

    // ファイルがオークネット計算書CSVかチェック
    const checkAucnetCSV = async (file: File): Promise<{ isAucnet: boolean; data: Record<string, string>[] }> => {
      const text = await readFileAsText(file)
      console.log('checkAucnetCSV:', file.name, 'first 200 chars:', text.substring(0, 200))
      return new Promise((resolve) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as Record<string, string>[]
            console.log('checkAucnetCSV parsed:', file.name, 'rows:', data.length)
            if (data.length === 0) {
              resolve({ isAucnet: false, data: [] })
              return
            }
            const headers = Object.keys(data[0] || {})
            console.log('checkAucnetCSV headers:', headers.slice(0, 5))
            const result = isAucnetCSV(headers)
            console.log('checkAucnetCSV isAucnet:', result)
            resolve({ isAucnet: result, data })
          }
        })
      })
    }

    // ファイルがオークネット画像CSVかチェック（URLのみ含むファイル）
    const checkImageCSV = async (file: File): Promise<boolean> => {
      const text = await readFileAsText(file)
      const lines = text.trim().split('\n').slice(0, 5)
      const isImage = lines.some(line => line.includes('image.brand-auc.com'))
      console.log('checkImageCSV:', { fileName: file.name, firstLine: lines[0]?.substring(0, 80), isImage })
      return isImage
    }

    // 1ファイルの場合
    if (fileArray.length === 1) {
      const file = fileArray[0]

      // まず画像CSVかどうかをチェック（1行目からURLの場合）
      const isImage = await checkImageCSV(file)
      if (isImage) {
        alert('オークネット画像CSVだけでは取り込めません。計算書CSVも一緒に選択してください。')
        return
      }

      // オークネット計算書CSVかチェック
      const { isAucnet, data } = await checkAucnetCSV(file)
      if (isAucnet) {
        // ファイル名から仕入日を抽出
        const purchaseDate = extractDateFromFileName(file.name)
        console.log('オークネットCSV形式を検出、直接インポート', { fileName: file.name, purchaseDate })
        executeAucnetImport(data, null, purchaseDate)
        return
      }

      // 通常のCSVはヘッダー選択フローへ
      const text = await readFileAsText(file)
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        preview: 10,
        complete: (previewResults) => {
          const rows = previewResults.data as string[][]
          if (rows.length === 0) {
            alert('データがありません')
            return
          }
          setCsvImportModal({
            step: 'header-select',
            csvHeaders: [],
            csvData: [],
            mapping: {},
            progress: 0,
            rawText: text,
            headerRow: 1,
            previewRows: rows,
          })
        }
      })
      return
    }

    // 2ファイル以上の場合: オークネット計算書CSVと画像CSVを探す
    let aucnetData: Record<string, string>[] | null = null
    let aucnetFileName: string | null = null
    let imageFile: File | null = null

    for (const file of fileArray) {
      const { isAucnet, data } = await checkAucnetCSV(file)
      if (isAucnet) {
        aucnetData = data
        aucnetFileName = file.name
        continue
      }
      const isImage = await checkImageCSV(file)
      if (isImage) {
        imageFile = file
      }
    }

    if (aucnetData) {
      // オークネットCSVが見つかった
      let imageMap: Map<string, string> | null = null
      if (imageFile) {
        imageMap = await parseAucnetImageCSV(imageFile)
      }
      // ファイル名から仕入日を抽出（計算書または画像CSVのどちらか）
      let purchaseDate = aucnetFileName ? extractDateFromFileName(aucnetFileName) : null
      if (!purchaseDate && imageFile) {
        purchaseDate = extractDateFromFileName(imageFile.name)
      }
      console.log(`オークネットCSV形式を検出、${imageMap ? '画像CSV付きで' : ''}直接インポート`, { purchaseDate })
      executeAucnetImport(aucnetData, imageMap, purchaseDate)
    } else {
      alert('認識できるCSVファイルがありませんでした')
    }
  }

  // ヘッダー行を確定してマッピングステップへ進む
  const confirmHeaderRow = () => {
    if (!csvImportModal) return
    const { rawText, headerRow } = csvImportModal

    // 選択したヘッダー行より前の行をスキップしてパース
    const lines = rawText.split('\n')
    const textWithoutSkipped = lines.slice(headerRow - 1).join('\n')

    Papa.parse(textWithoutSkipped, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[]
        if (data.length === 0) {
          alert('データがありません')
          return
        }
        const headers = Object.keys(data[0] || {})

        // オークネットCSV形式を検出
        const isAucnet = isAucnetCSV(headers)
        const autoMapped = isAucnet ? autoMappingAucnetCSV(headers) : autoMappingCSV(headers)

        if (isAucnet) {
          console.log('オークネットCSV形式を検出しました')
        }

        setCsvImportModal({
          ...csvImportModal,
          step: 'mapping',
          csvHeaders: headers,
          csvData: data,
          mapping: autoMapped,
          isAucnet,
        })
      }
    })
  }

  const executeCSVImport = async () => {
    if (!csvImportModal) return
    const { csvData, mapping, isAucnet } = csvImportModal

    const mappedValues = Object.values(mapping).filter(v => v !== '')
    const duplicates = mappedValues.filter((v, i, arr) => arr.indexOf(v) !== i)
    if (duplicates.length > 0) {
      const duplicateLabels = [...new Set(duplicates)].map(key =>
        CSV_IMPORT_COLUMNS.find(col => col.key === key)?.label || key
      )
      alert(`マッピングが重複しています: ${duplicateLabels.join(', ')}`)
      return
    }

    setCsvImportModal({ ...csvImportModal, step: 'importing', progress: 0 })

    // オークネットCSVの場合、無効な行をフィルタリング
    let filteredData = csvData
    if (isAucnet) {
      filteredData = csvData.filter(row => {
        // 受付番号がない行（写真代、配送費など）をスキップ
        const receiptNum = row['受付番号']?.trim()
        if (!receiptNum) {
          console.log('スキップ（受付番号なし）:', row['ブランド名'] || row['商品名'])
          return false
        }
        // 請求商品代がマイナスまたは0の行（返品）をスキップ
        const purchasePrice = parseFloat((row['請求商品代'] || '0').replace(/,/g, ''))
        if (purchasePrice <= 0) {
          console.log('スキップ（返品/マイナス）:', receiptNum, row['商品名'])
          return false
        }
        return true
      })
      console.log(`オークネットCSV: ${csvData.length}件中 ${filteredData.length}件をインポート対象`)
    }

    let success = 0
    let failed = 0
    const batchSize = 50
    const totalRows = filteredData.length
    console.log(`CSVインポート開始: 全${totalRows}件`)

    for (let i = 0; i < totalRows; i += batchSize) {
      const batch = filteredData.slice(i, i + batchSize)

      // データベースに確実に存在するカラムのみ許可
      const allowedColumns = [
        'product_name', 'brand_name', 'category', 'purchase_source', 'sale_destination',
        'sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price',
        'purchase_total', 'deposit_amount', 'purchase_date', 'listing_date', 'sale_date',
        'memo', 'inventory_number'
      ]

      const records = batch.map(row => {
        const record: Record<string, string | number | null> = {
          sale_type: 'main',
        }

        // オークネットCSVの場合、仕入先を自動設定
        if (isAucnet) {
          record.purchase_source = 'オークネット'
        }

        Object.entries(mapping).forEach(([csvHeader, column]) => {
          // 許可されたカラムのみ処理（image_urlなどスキップ）
          if (!allowedColumns.includes(column)) return

          let value = row[csvHeader]

          // オークネットCSVの場合、ブランド名をクリーンアップ
          if (isAucnet && column === 'brand_name' && value) {
            // 全角スペースを正規化
            value = value.replace(/\s+/g, ' ').trim()
            // 末尾の（バッグ）などを削除
            value = value.replace(/[（\(][^）\)]*[）\)]$/, '').trim()
            // 全角英数字を半角に変換
            value = value.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
              String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
            )
          }

          if (['purchase_price', 'purchase_total', 'sale_price', 'commission', 'shipping_cost', 'other_cost', 'deposit_amount'].includes(column)) {
            record[column] = parseCSVNumber(value)
          } else if (['purchase_date', 'listing_date', 'sale_date'].includes(column)) {
            record[column] = parseCSVDate(value)
          } else {
            record[column] = value || null
          }
        })

        // 手数料が空の場合、販売先と売価から自動計算
        let commission = (record.commission as number) || 0
        if (!record.commission && record.sale_destination && record.sale_price) {
          const autoCommission = calculateCommission(
            record.sale_destination as string,
            record.sale_price as number,
            record.sale_date as string | null
          )
          if (autoCommission !== null) {
            commission = autoCommission
            record.commission = autoCommission
          }
        }

        // 利益と利益率を計算
        const salePrice = (record.sale_price as number) || 0
        const purchasePrice = (record.purchase_price as number) || 0
        const otherCost = (record.other_cost as number) || 0
        const shippingCost = (record.shipping_cost as number) || 0
        // 仕入総額がある場合はそれを使用、なければ原価のみ（修理費は別途引く）
        const purchaseTotal = (record.purchase_total as number) ?? purchasePrice
        // 仕入総額がない場合はpurchase_totalを設定
        if (record.purchase_total == null) {
          record.purchase_total = purchaseTotal
        }
        // 修理費は別途引く
        const profit = salePrice - purchaseTotal - commission - shippingCost - otherCost
        let profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100 * 10) / 10 : 0
        // NaN, Infinity, -Infinity をチェックして0にする
        if (!Number.isFinite(profitRate)) {
          profitRate = 0
        }
        // データベースのNUMERIC(5,1)制限に合わせてクランプ (-9999.9〜9999.9)
        profitRate = Math.max(-9999.9, Math.min(9999.9, profitRate))

        // profitもNaN/Infinityチェック
        const safeProfit = Number.isFinite(profit) ? profit : 0
        record.profit = safeProfit
        record.profit_rate = profitRate

        return record
      }).filter(record => record.product_name)

      if (records.length === 0) continue

      const { error } = await supabase.from('manual_sales').insert(records)
      if (error) {
        // エラー詳細をコンソールに文字列として出力（コピーしやすい）
        const errorInfo = `
=== CSVインポートエラー ===
メッセージ: ${error.message}
コード: ${error.code || 'なし'}
ヒント: ${error.hint || 'なし'}
詳細: ${error.details || 'なし'}
サンプルレコード: ${JSON.stringify(records[0], null, 2)}
===========================`
        console.error(errorInfo)
        // 最初のエラーでアラート
        if (failed === 0) {
          alert(`インポートエラー: ${error.message}\nコード: ${error.code || 'なし'}\nヒント: ${error.hint || 'なし'}\n詳細: ${error.details || 'なし'}`)
        }
        failed += records.length
      } else {
        success += records.length
      }

      setCsvImportModal(prev => prev ? { ...prev, progress: Math.round(((i + batch.length) / csvData.length) * 100) } : null)
    }

    setCsvImportModal(null)
    const skipped = totalRows - success - failed
    console.log(`CSVインポート完了: 成功${success}件、失敗${failed}件、スキップ${skipped}件（全${totalRows}件中）`)
    alert(`インポート完了: ${success}件成功${failed > 0 ? `、${failed}件失敗` : ''}${skipped > 0 ? `、${skipped}件スキップ` : ''}（全${totalRows}件中）`)

    // データを再取得（ページネーションで全件取得）
    let allNewSales: ManualSale[] = []
    let fromIdx = 0
    const pgSize = 1000
    let moreData = true
    while (moreData) {
      const { data: pageData } = await supabase
        .from('manual_sales')
        .select('*')
        .order('sale_date', { ascending: false })
        .range(fromIdx, fromIdx + pgSize - 1)
      if (pageData && pageData.length > 0) {
        allNewSales = [...allNewSales, ...pageData]
        fromIdx += pgSize
        moreData = pageData.length === pgSize
      } else {
        moreData = false
      }
    }
    console.log(`データ再取得完了: ${allNewSales.length}件`)
    setSales(allNewSales)
  }

  // コピペ機能 - visibleColumnsを使用（colIndexは表示列のインデックス）
  const handleCellMouseDown = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    console.log('handleCellMouseDown:', { rowIndex, colIndex, button: e.button, editingCell })
    if (e.button !== 0) return // 左クリックのみ
    if (editingCell) return // 編集中は無視

    setIsDragging(true)
    setSelectionRange({
      startRow: rowIndex,
      startCol: colIndex,
      endRow: rowIndex,
      endCol: colIndex,
    })
    console.log('selectionRange set:', { startRow: rowIndex, startCol: colIndex, endRow: rowIndex, endCol: colIndex })
  }

  const handleCellMouseEnter = (rowIndex: number, colIndex: number) => {
    console.log('handleCellMouseEnter:', { rowIndex, colIndex, isDragging, selectionRange })
    if (!isDragging || !selectionRange) return

    setSelectionRange(prev => prev ? {
      ...prev,
      endRow: rowIndex,
      endCol: colIndex,
    } : null)
    console.log('selectionRange updated to:', { startRow: selectionRange.startRow, startCol: selectionRange.startCol, endRow: rowIndex, endCol: colIndex })
  }

  // ドラッグ終了
  useEffect(() => {
    const handleMouseUp = () => {
      console.log('handleMouseUp:', { isDragging, selectionRange })
      if (isDragging) {
        setIsDragging(false)
        console.log('isDragging set to false, selectionRange preserved:', selectionRange)
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [isDragging, selectionRange])

  // 範囲内のセルかどうかチェック
  const isCellInRange = (rowIndex: number, colIndex: number): boolean => {
    if (!selectionRange) return false
    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)
    return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol
  }

  // ペースト処理
  const pasteToSelectedCells = useCallback(async (clipboardText: string) => {
    if (!selectionRange) return

    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)

    const pasteRows = clipboardText.split('\n').filter(row => row.trim() !== '')
    const pasteData = pasteRows.map(row => row.split('\t'))
    const pasteRowCount = pasteData.length
    const pasteColCount = pasteData[0]?.length || 1

    const updates: { id: string; field: string; value: string | number | null }[] = []

    // UIを先に更新
    const newSales = [...sales]
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const pasteRowIndex = (r - minRow) % pasteRowCount
        const pasteColIndex = (c - minCol) % pasteColCount
        const pasteValue = pasteData[pasteRowIndex]?.[pasteColIndex] || ''
        const col = visibleColumns[c]
        const sale = filteredSales[r]
        if (!sale || !col || !col.editable) continue

        const colKey = col.key
        const saleIndex = newSales.findIndex(s => s.id === sale.id)
        if (saleIndex === -1) continue

        const numericFields = ['purchase_price', 'purchase_total', 'sale_price', 'commission', 'shipping_cost', 'other_cost', 'deposit_amount']
        let parsedValue: string | number | null = pasteValue
        if (numericFields.includes(colKey)) {
          parsedValue = parseCSVNumber(pasteValue)
        } else if (pasteValue === '') {
          parsedValue = null
        }

        (newSales[saleIndex] as Record<string, unknown>)[colKey] = parsedValue
        updates.push({ id: sale.id, field: colKey, value: parsedValue })
      }
    }
    setSales(newSales)

    // バッチでDB更新
    const batchSize = 50
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      await Promise.all(batch.map(({ id, field, value }) =>
        supabase.from('manual_sales').update({ [field]: value }).eq('id', id)
      ))
    }
  }, [selectionRange, sales, filteredSales, visibleColumns])

  // ペーストイベントリスナー
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (editingCell) return
      const activeElement = document.activeElement
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'SELECT') {
        return
      }
      if (selectionRange) {
        e.preventDefault()
        const clipboardText = e.clipboardData?.getData('text')
        if (clipboardText) {
          pasteToSelectedCells(clipboardText)
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [selectionRange, editingCell, pasteToSelectedCells])

  // 選択セルをコピー
  const copySelectedCells = useCallback(() => {
    if (!selectionRange) {
      console.log('copySelectedCells: no selectionRange')
      return
    }

    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)

    console.log('copySelectedCells:', { minRow, maxRow, minCol, maxCol })

    const rows: string[] = []
    for (let r = minRow; r <= maxRow; r++) {
      const sale = filteredSales[r]
      if (!sale) continue

      const cols: string[] = []
      for (let c = minCol; c <= maxCol; c++) {
        const col = visibleColumns[c]
        if (!col) continue

        const field = col.key
        let value = ''

        // 計算列の処理
        if (field === 'profit') {
          const profit = calculateProfit(sale)
          value = String(profit)
        } else if (field === 'profit_rate') {
          const profitRate = calculateProfitRate(sale)
          value = `${profitRate}%`
        } else if (field === 'turnover_days') {
          const turnoverDays = calculateTurnoverDays(sale)
          value = turnoverDays !== null ? String(turnoverDays) : ''
        } else if (field === 'no') {
          value = String(r + 1)
        } else if (field === 'cost_recovered') {
          const profit = calculateProfit(sale)
          const purchaseTotal = sale.purchase_total || sale.purchase_price || 0
          const costRecovered = purchaseTotal > 0 ? profit >= purchaseTotal : false
          value = costRecovered ? '〇' : '✕'
        } else if (field in sale) {
          const cellValue = sale[field as keyof ManualSale]
          value = cellValue !== null && cellValue !== undefined ? String(cellValue) : ''
        }
        cols.push(value)
        console.log(`copySelectedCells: field=${field}, value=${value}`)
      }
      rows.push(cols.join('\t'))
    }

    const text = rows.join('\n')
    console.log('copySelectedCells: copying text:', text)
    navigator.clipboard.writeText(text).then(() => {
      console.log('copySelectedCells: copy success!')
    }).catch(err => {
      console.error('Copy failed:', err)
    })
  }, [selectionRange, filteredSales, visibleColumns])

  // Ctrl+C でコピー
  useEffect(() => {
    const handleCopyKey = (e: KeyboardEvent) => {
      console.log('Copy key pressed', { selectionRange, ctrlKey: e.ctrlKey, metaKey: e.metaKey, key: e.key })
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectionRange) {
        // 編集中は無視
        if (editingCell) return
        const activeElement = document.activeElement
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'SELECT') {
          return
        }
        e.preventDefault()
        console.log('Copying selected cells...')
        copySelectedCells()
      }
    }
    document.addEventListener('keydown', handleCopyKey)
    return () => document.removeEventListener('keydown', handleCopyKey)
  }, [selectionRange, editingCell, copySelectedCells])

  // 選択セルの削除
  const deleteSelectedCells = useCallback(async () => {
    if (!selectionRange) return

    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)

    // 編集不可フィールド
    const nonEditableFields = ['id', 'created_at', 'no', 'checkbox', 'image_url', 'profit', 'profit_rate', 'turnover_days', 'cost_recovered']

    // 更新対象を収集
    const updates: { id: string; field: string; value: null }[] = []
    // 履歴用の変更記録
    const historyChanges: { id: string; field: keyof ManualSale; oldValue: unknown; newValue: unknown }[] = []

    // UIを先に更新
    const newSales = [...sales]
    for (let r = minRow; r <= maxRow; r++) {
      const sale = filteredSales[r]
      if (!sale) continue

      for (let c = minCol; c <= maxCol; c++) {
        const col = visibleColumns[c]
        if (!col || !col.editable) continue

        const field = col.key
        if (nonEditableFields.includes(field)) continue

        const saleIndex = newSales.findIndex(s => s.id === sale.id)
        if (saleIndex === -1) continue

        const oldValue = sale[field as keyof ManualSale]
        if (oldValue !== null) {
          historyChanges.push({ id: sale.id, field: field as keyof ManualSale, oldValue, newValue: null })
        }

        (newSales[saleIndex] as Record<string, unknown>)[field] = null
        updates.push({ id: sale.id, field, value: null })
      }
    }

    if (updates.length === 0) return

    // UIを更新
    setSales(newSales)

    // 履歴に追加
    if (historyChanges.length > 0) {
      setUndoHistory(prev => [...prev, ...historyChanges])
    }

    // バッチでDB更新
    const batchSize = 50
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      await Promise.all(batch.map(({ id, field }) =>
        supabase.from('manual_sales').update({ [field]: null }).eq('id', id)
      ))
    }
  }, [selectionRange, sales, filteredSales, visibleColumns])

  // Delete/Backspaceで選択セルを削除
  useEffect(() => {
    const handleDeleteKey = (e: KeyboardEvent) => {
      // 編集中は無視
      if (editingCell) return
      // 入力フィールドにフォーカスがある場合は無視
      const activeElement = document.activeElement
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'SELECT') {
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRange) {
        e.preventDefault()
        deleteSelectedCells()
      }
    }
    document.addEventListener('keydown', handleDeleteKey)
    return () => document.removeEventListener('keydown', handleDeleteKey)
  }, [selectionRange, editingCell, deleteSelectedCells])

  // テーマに応じたクラス
  const themeClasses = {
    light: {
      bg: 'bg-gray-50',
      headerBg: 'bg-white',
      cardBg: 'bg-white',
      text: 'text-gray-900',
      textMuted: 'text-gray-500',
      border: 'border-gray-200',
      tableBg: 'bg-white',
      tableHeaderBg: 'bg-gray-100',
      tableRowHover: 'hover:bg-gray-50',
      input: 'bg-white text-gray-900 border-gray-300',
    },
    dark: {
      bg: 'bg-slate-900',
      headerBg: 'bg-slate-800',
      cardBg: 'bg-slate-800',
      text: 'text-white',
      textMuted: 'text-slate-400',
      border: 'border-slate-600',
      tableBg: 'bg-slate-800',
      tableHeaderBg: 'bg-slate-700',
      tableRowHover: 'hover:bg-slate-700',
      input: 'bg-slate-700 text-white border-slate-600',
    },
  }

  const t = themeClasses['light']

  if (authLoading || loading) {
    return (
      <div className={`min-h-screen ${t.bg}`}>
        <Navigation />
        <div className="pt-14 flex items-center justify-center min-h-screen">
          <div className={t.text}>読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${t.bg}`}>
        <Navigation />
        <div className="pt-14 flex items-center justify-center min-h-screen">
          <div className={t.text}>ログインしてください</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${t.bg}`} style={{ paddingBottom: modalEdit ? '128px' : '20px' }}>
      <Navigation />
      <div className="pt-14 px-2 sm:px-4 py-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">手入力売上表</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* 列の編集ボタン */}
            <div className="relative">
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors touch-target"
              >
                <span className="hidden sm:inline">列の編集</span><span className="sm:hidden">列</span>
              </button>
              {showColumnSettings && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowColumnSettings(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[200px] max-h-[400px] overflow-y-auto">
                    <div className="text-xs font-medium text-gray-500 mb-2">表示する列</div>
                    {columns.filter(col => col.key !== 'no' && col.key !== 'checkbox').map(col => (
                      <label key={col.key} className="flex items-center gap-2 py-1 hover:bg-gray-50 px-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!hiddenColumns.has(col.key)}
                          onChange={() => {
                            const newHidden = new Set(hiddenColumns)
                            if (newHidden.has(col.key)) {
                              newHidden.delete(col.key)
                            } else {
                              newHidden.add(col.key)
                            }
                            setHiddenColumns(newHidden)
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* CSVインポートボタン（複数ファイル選択可能）- モバイルでは非表示 */}
            <input
              type="file"
              accept=".csv"
              multiple
              ref={csvInputRef}
              className="hidden"
              onChange={(e) => {
                const files = e.target.files
                if (files && files.length > 0) {
                  handleCSVFilesSelect(files)
                }
                e.target.value = ''
              }}
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              className="hidden sm:block px-2 sm:px-3 py-2 text-xs sm:text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors touch-target"
            >
              CSVインポート
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className={`px-2 sm:px-3 py-2 text-xs sm:text-sm rounded transition-colors touch-target ${
                selectedIds.size > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {selectedIds.size > 0 ? `${selectedIds.size}件削除` : '削除'}
            </button>
            <button
              onClick={handleOpenAddModal}
              className="px-2 sm:px-4 py-2 text-xs sm:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 touch-target"
            >
              <span className="hidden sm:inline">新規</span>追加
            </button>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className={`px-2 sm:px-3 py-2 ${t.input} border rounded text-sm touch-target`}
          >
            <option value="">全年</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={`px-2 sm:px-3 py-2 ${t.input} border rounded text-sm touch-target`}
          >
            <option value="">全月</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
              <option key={month} value={month}>{month}月</option>
            ))}
          </select>
          <select
            value={sortByImage}
            onChange={(e) => setSortByImage(e.target.value as 'none' | 'hasImage' | 'noImage')}
            className={`px-2 sm:px-3 py-2 ${t.input} border rounded text-sm touch-target hidden sm:block`}
          >
            <option value="none">画像：指定なし</option>
            <option value="hasImage">画像あり優先</option>
            <option value="noImage">画像なし優先</option>
          </select>
        </div>

        {/* 集計 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className={`${t.cardBg} p-3 sm:p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-xs sm:text-sm`}>件数</div>
            <div className={`${t.text} text-lg sm:text-xl font-bold`}>{summary.count}件</div>
          </div>
          <div className={`${t.cardBg} p-3 sm:p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-xs sm:text-sm`}>売上合計</div>
            <div className={`${t.text} text-lg sm:text-xl font-bold`}>¥{summary.totalSales.toLocaleString()}</div>
          </div>
          <div className={`${t.cardBg} p-3 sm:p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-xs sm:text-sm`}>仕入合計</div>
            <div className={`${t.text} text-lg sm:text-xl font-bold`}>¥{summary.totalPurchase.toLocaleString()}</div>
          </div>
          <div className={`${t.cardBg} p-3 sm:p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-xs sm:text-sm`}>利益合計</div>
            <div className={`text-lg sm:text-xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ¥{summary.totalProfit.toLocaleString()}
            </div>
          </div>
          <div className={`${t.cardBg} p-3 sm:p-4 rounded-lg shadow-sm border ${t.border} col-span-2 sm:col-span-1`}>
            <div className={`${t.textMuted} text-xs sm:text-sm`}>平均利益率</div>
            <div className={`text-lg sm:text-xl font-bold ${summary.avgProfitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.avgProfitRate}%
            </div>
          </div>
        </div>


        {/* テーブル */}
        <div
          ref={tableContainerRef}
          className={`overflow-x-auto overflow-y-auto max-h-[calc(100vh-240px)] sm:max-h-[calc(100vh-180px)] ${t.cardBg} rounded-lg shadow-sm border ${t.border} responsive-table`}
        >
          <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: `${tableWidth}px` }}>
            <thead className="sticky top-0 z-10" style={{ backgroundColor: '#334155' }}>
              <tr>
                {visibleColumns.map(col => {
                  // チェックボックス列は特別な処理
                  if (col.key === 'checkbox') {
                    return (
                      <th
                        key={col.key}
                        style={{
                          backgroundColor: '#334155',
                          width: `${colWidths[col.key as keyof typeof colWidths] || 35}px`,
                        }}
                        className="px-1 py-2 text-center border border-slate-600"
                      >
                        <input
                          type="checkbox"
                          checked={filteredSales.length > 0 && selectedIds.size === filteredSales.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                    )
                  }
                  // フィルター可能な列を判定
                  const isBrandColumn = col.key === 'brand_name'
                  const isCategoryColumn = col.key === 'category'
                  const isPurchaseSourceColumn = col.key === 'purchase_source'
                  const isSaleDestinationColumn = col.key === 'sale_destination'
                  const hasFilter = isBrandColumn || isCategoryColumn || isPurchaseSourceColumn || isSaleDestinationColumn

                  return (
                    <th
                      key={col.key}
                      style={{
                        backgroundColor: '#334155',
                        color: '#ffffff',
                        width: `${colWidths[col.key as keyof typeof colWidths] || 80}px`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      className="px-1 py-2 text-center text-xs font-medium border border-slate-600 whitespace-nowrap"
                    >
                      <span className="flex items-center justify-center gap-0.5">
                        {col.label}
                        {isBrandColumn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (openFilter === 'brand') {
                                setOpenFilter(null)
                                setFilterDropdownPosition(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setFilterDropdownPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                setOpenFilter('brand')
                              }
                            }}
                            className={`ml-1 text-[10px] ${selectedBrands.size > 0 ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                          >
                            ▼
                          </button>
                        )}
                        {isCategoryColumn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (openFilter === 'category') {
                                setOpenFilter(null)
                                setFilterDropdownPosition(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setFilterDropdownPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                setOpenFilter('category')
                              }
                            }}
                            className={`ml-1 text-[10px] ${selectedCategories.size > 0 ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                          >
                            ▼
                          </button>
                        )}
                        {isPurchaseSourceColumn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (openFilter === 'purchase_source') {
                                setOpenFilter(null)
                                setFilterDropdownPosition(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setFilterDropdownPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                setOpenFilter('purchase_source')
                              }
                            }}
                            className={`ml-1 text-[10px] ${selectedPurchaseSources.size > 0 ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                          >
                            ▼
                          </button>
                        )}
                        {isSaleDestinationColumn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (openFilter === 'sale_destination') {
                                setOpenFilter(null)
                                setFilterDropdownPosition(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setFilterDropdownPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                setOpenFilter('sale_destination')
                              }
                            }}
                            className={`ml-1 text-[10px] ${selectedSaleDestinations.size > 0 ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                          >
                            ▼
                          </button>
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale, rowIndex) => {
                // セルのレンダリング用ヘルパー関数
                const renderEditableCell = (field: keyof ManualSale, colIndex: number, value: React.ReactNode, inputType: 'text' | 'number' | 'date' = 'text') => {
                  const isEditing = editingCell?.id === sale.id && editingCell?.field === field
                  const isSelected = isSelectedCell(sale.id, field)
                  const inRange = isCellInRange(rowIndex, colIndex)
                  const rangeClass = inRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''
                  const cellClass = `px-1 py-1 text-center text-xs ${t.text} border ${t.border} cursor-pointer ${t.tableRowHover} ${isSelected && !isEditing ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${isEditing && inputType !== 'date' ? 'ring-2 ring-blue-500 ring-inset' : ''} ${rangeClass} select-none`

                  // 日付フィールドの場合は非表示のinputでカレンダーだけ開く
                  if (inputType === 'date') {
                    return (
                      <td
                        className={cellClass}
                        style={{ overflow: 'hidden', position: 'relative' }}
                        onClick={() => handleCellClick(sale, field)}
                        onDoubleClick={() => handleCellDoubleClick(sale, field)}
                        onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                        onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                      >
                        <span className="block leading-tight">{formatDateWithBreak(value as string)}</span>
                        {isEditing && (
                          <input
                            ref={(el) => {
                              editCellRef.current = el
                              if (el) {
                                setTimeout(() => {
                                  try {
                                    (el as HTMLInputElement).showPicker?.()
                                  } catch {}
                                }, 50)
                              }
                            }}
                            type="date"
                            value={editValue}
                            onChange={async (e) => {
                              const newValue = e.target.value
                              if (newValue) {
                                const { error } = await supabase
                                  .from('manual_sales')
                                  .update({ [field]: newValue })
                                  .eq('id', sale.id)
                                if (!error) {
                                  setSales(prev => prev.map(s => s.id === sale.id ? { ...s, [field]: newValue } : s))
                                }
                              }
                              setEditingCell(null)
                              setEditValue('')
                            }}
                            onBlur={() => {
                              setEditingCell(null)
                              setEditValue('')
                            }}
                            className="absolute opacity-0 w-0 h-0"
                            style={{ top: 0, left: 0 }}
                          />
                        )}
                      </td>
                    )
                  }

                  return (
                    <td
                      className={cellClass}
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}
                      onClick={() => handleCellClick(sale, field)}
                      onDoubleClick={() => handleCellDoubleClick(sale, field)}
                      onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                    >
                      {isEditing ? (
                        <input
                          ref={(el) => { editCellRef.current = el }}
                          type={inputType}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className={`w-full px-1 py-0.5 ${t.input} border border-blue-500 rounded text-xs`}
                          autoFocus
                        />
                      ) : (
                        <span className="block truncate">{value}</span>
                      )}
                    </td>
                  )
                }

                const renderSelectCell = (field: keyof ManualSale, colIndex: number, value: string | null, options: (Platform | Supplier)[], align: 'left' | 'center' | 'right' = 'center') => {
                  const isDropdownOpen = editingCell?.id === sale.id && editingCell?.field === field && dropdownPosition
                  const isSelected = isSelectedCell(sale.id, field)
                  const inRange = isCellInRange(rowIndex, colIndex)
                  const rangeClass = inRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''
                  const alignClass = align === 'right' ? 'text-right' : align === 'left' ? 'text-left' : 'text-center'
                  const flexAlignClass = align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center'
                  const cellClass = `px-1 py-1 ${alignClass} text-xs ${t.text} border ${t.border} cursor-pointer ${t.tableRowHover} ${isSelected && !isDropdownOpen ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${rangeClass} select-none relative`

                  // 色を取得
                  const colorClass = value ? options.find(p => p.name === value)?.color_class : null

                  const openDropdown = (e: React.MouseEvent) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setDropdownPosition({ top: rect.bottom + 4, left: rect.left })
                    setEditingCell({ id: sale.id, field })
                    setEditValue(value || '')
                  }

                  const closeDropdown = () => {
                    setEditingCell(null)
                    setEditValue('')
                    setDropdownPosition(null)
                  }

                  const selectOption = async (newValue: string | null) => {
                    // 直接DBに保存
                    const { error } = await supabase
                      .from('manual_sales')
                      .update({ [field]: newValue })
                      .eq('id', sale.id)
                    if (!error) {
                      setSales(prev => prev.map(s => s.id === sale.id ? { ...s, [field]: newValue } : s))
                    }
                    closeDropdown()
                  }

                  return (
                    <td
                      className={cellClass}
                      style={{ overflow: 'hidden' }}
                      onClick={(e) => {
                        // 同じセルが選択されている場合はドロップダウンを開く
                        if (selectedCell?.id === sale.id && selectedCell?.field === field) {
                          openDropdown(e)
                        } else {
                          // 別のセルをクリックした場合は選択状態にする
                          setSelectedCell({ id: sale.id, field })
                          // selectionRangeはhandleCellMouseDownで設定されるのでクリアしない
                          if (editingCell) {
                            closeDropdown()
                          }
                        }
                      }}
                      onDoubleClick={(e) => {
                        setSelectedCell({ id: sale.id, field })
                        openDropdown(e)
                      }}
                      onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                      onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                    >
                      <div className={`flex ${flexAlignClass} w-full overflow-hidden`}>
                        {value ? (
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full max-w-full overflow-hidden ${colorClass || 'bg-gray-100 text-gray-800'}`}
                          >
                            <span className="truncate min-w-0">{value}</span>
                            <span
                              className="ml-1 cursor-pointer hover:opacity-70 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                openDropdown(e)
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                <path d="M2 3.5L5 7L8 3.5H2Z" />
                              </svg>
                            </span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center text-sm text-gray-400 cursor-pointer hover:text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDropdown(e)
                            }}
                          >
                            -
                            <svg className="ml-0.5" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                              <path d="M2 3.5L5 7L8 3.5H2Z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {isDropdownOpen && createPortal(
                        <>
                          <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); closeDropdown() }} />
                          <div
                            className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto"
                            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              placeholder="入力またはペースト..."
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                // IME入力中（変換確定のEnter）は無視
                                if (e.nativeEvent.isComposing) return
                                if (e.key === 'Enter') {
                                  const inputValue = (e.target as HTMLInputElement).value.trim()
                                  if (inputValue) {
                                    selectOption(inputValue)
                                  }
                                } else if (e.key === 'Escape') {
                                  closeDropdown()
                                }
                              }}
                              onPaste={(e) => {
                                e.stopPropagation()
                                // ペースト後にEnterで確定できるようにする
                              }}
                            />
                            <button
                              className="inline-flex px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap bg-gray-100 text-gray-800 hover:bg-gray-200"
                              onClick={() => selectOption(null)}
                            >
                              -
                            </button>
                            {options.map((option) => (
                              <div
                                key={option.id}
                                className={`flex items-center w-full px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${option.color_class || 'bg-gray-100 text-gray-800'} hover:opacity-80 cursor-pointer`}
                                onClick={() => selectOption(option.name)}
                              >
                                {option.name}
                              </div>
                            ))}
                          </div>
                        </>,
                        document.body
                      )}
                    </td>
                  )
                }

                // 各列をレンダリングする関数
                const renderColumnCell = (colKey: string, colIndex: number) => {
                  const inRange = isCellInRange(rowIndex, colIndex)
                  const rangeClass = inRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''

                  switch (colKey) {
                    case 'checkbox':
                      return (
                        <td
                          key={colKey}
                          className={`px-2 py-1 text-center border ${t.border}`}
                        >
                          <input
                            type="checkbox"
                            checked={isItemSelected(sale.id)}
                            onClick={(e) => handleSelectItem(sale.id, rowIndex, e.shiftKey)}
                            onChange={() => {}}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                      )
                    case 'no':
                      return (
                        <td
                          key={colKey}
                          className={`px-2 py-1 text-center text-xs ${t.text} border ${t.border} ${rangeClass} select-none overflow-hidden`}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          {rowIndex + 1}
                        </td>
                      )
                    case 'inventory_number':
                      const invNum = sale.inventory_number || '-'
                      const isInvSelected = isSelectedCell(sale.id, 'inventory_number')
                      const isInvEditing = editingCell?.id === sale.id && editingCell?.field === 'inventory_number'
                      const invCellClass = `px-1 py-1 text-center text-xs ${t.text} border ${t.border} cursor-pointer ${t.tableRowHover} ${isInvSelected && !isInvEditing ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${isInvEditing ? 'ring-2 ring-blue-500 ring-inset' : ''} ${rangeClass} select-none`
                      return (
                        <td
                          key={colKey}
                          className={invCellClass}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}
                          onClick={() => {
                            handleCellClick(sale, 'inventory_number')
                            if (invNum !== '-' && !isInvEditing) {
                              setModalEdit({ id: sale.id, field: 'inventory_number', value: invNum })
                            }
                          }}
                          onDoubleClick={() => handleCellDoubleClick(sale, 'inventory_number')}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          {isInvEditing ? (
                            <input
                              ref={(el) => { editCellRef.current = el }}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleKeyDown}
                              className={`w-full px-1 py-0.5 ${t.input} border border-blue-500 rounded text-xs`}
                              autoFocus
                            />
                          ) : (
                            <span className="block truncate">{invNum}</span>
                          )}
                        </td>
                      )
                    case 'image_url':
                      return (
                        <td
                          key={colKey}
                          className={`px-2 py-1 text-center text-xs ${t.text} border ${t.border} cursor-pointer ${t.tableRowHover} ${rangeClass} select-none overflow-hidden`}
                          onClick={() => openImageModal(sale)}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          {sale.image_url ? (
                            <img
                              src={sale.image_url}
                              alt=""
                              className="w-10 h-10 object-cover mx-auto rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <span className={t.textMuted}>+</span>
                          )}
                        </td>
                      )
                    case 'category':
                      return <React.Fragment key={colKey}>{renderSelectCell('category', colIndex, sale.category, categoryOptions, 'left')}</React.Fragment>
                    case 'brand_name':
                      const brandName = sale.brand_name || '-'
                      const isBrandSelected = isSelectedCell(sale.id, 'brand_name')
                      const isBrandEditing = editingCell?.id === sale.id && editingCell?.field === 'brand_name'
                      const brandCellClass = `px-2 py-1 text-center text-xs ${t.text} border ${t.border} cursor-pointer ${t.tableRowHover} ${isBrandSelected && !isBrandEditing ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${isBrandEditing ? 'ring-2 ring-blue-500 ring-inset' : ''} ${rangeClass} select-none overflow-hidden`
                      return (
                        <td
                          key={colKey}
                          className={brandCellClass}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}
                          onClick={() => {
                            handleCellClick(sale, 'brand_name')
                            if (brandName !== '-' && !isBrandEditing) {
                              setModalEdit({ id: sale.id, field: 'brand_name', value: brandName })
                            }
                          }}
                          onDoubleClick={() => handleCellDoubleClick(sale, 'brand_name')}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          {isBrandEditing ? (
                            <input
                              ref={(el) => { editCellRef.current = el }}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleKeyDown}
                              className={`w-full px-1 py-0.5 ${t.input} border border-blue-500 rounded text-xs`}
                              autoFocus
                            />
                          ) : (
                            <span className="block truncate">{brandName}</span>
                          )}
                        </td>
                      )
                    case 'product_name':
                      const isProdSelected = isSelectedCell(sale.id, 'product_name')
                      const productName = sale.product_name || '-'
                      const productCellClass = `px-2 py-1 text-left text-xs ${t.text} border ${t.border} cursor-pointer ${t.tableRowHover} ${isProdSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${rangeClass} select-none overflow-hidden`
                      return (
                        <td
                          key={colKey}
                          className={productCellClass}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}
                          onClick={() => {
                            handleCellClick(sale, 'product_name')
                            if (productName !== '-') {
                              setModalEdit({ id: sale.id, field: 'product_name', value: productName })
                            }
                          }}
                          onDoubleClick={() => handleCellDoubleClick(sale, 'product_name')}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                          title={productName !== '-' ? productName : undefined}
                        >
                          <span className="block truncate">{productName}</span>
                        </td>
                      )
                    case 'purchase_source':
                      return <React.Fragment key={colKey}>{renderSelectCell('purchase_source', colIndex, sale.purchase_source, purchasePlatforms)}</React.Fragment>
                    case 'sale_destination':
                      return <React.Fragment key={colKey}>{renderSelectCell('sale_destination', colIndex, sale.sale_destination, salePlatforms, 'left')}</React.Fragment>
                    case 'sale_price':
                      return <React.Fragment key={colKey}>{renderEditableCell('sale_price', colIndex, sale.sale_price?.toLocaleString() || '-', 'number')}</React.Fragment>
                    case 'commission':
                      return <React.Fragment key={colKey}>{renderEditableCell('commission', colIndex, sale.commission?.toLocaleString() || '-', 'number')}</React.Fragment>
                    case 'shipping_cost':
                      return <React.Fragment key={colKey}>{renderEditableCell('shipping_cost', colIndex, sale.shipping_cost?.toLocaleString() || '-', 'number')}</React.Fragment>
                    case 'other_cost':
                      return <React.Fragment key={colKey}>{renderEditableCell('other_cost', colIndex, sale.other_cost?.toLocaleString() || '-', 'number')}</React.Fragment>
                    case 'purchase_price':
                      return <React.Fragment key={colKey}>{renderEditableCell('purchase_price', colIndex, sale.purchase_price?.toLocaleString() || '-', 'number')}</React.Fragment>
                    case 'purchase_total':
                      return <React.Fragment key={colKey}>{renderEditableCell('purchase_total', colIndex, sale.purchase_total?.toLocaleString() || '-', 'number')}</React.Fragment>
                    case 'deposit_amount':
                      return <React.Fragment key={colKey}>{renderEditableCell('deposit_amount', colIndex, sale.deposit_amount?.toLocaleString() || '-', 'number')}</React.Fragment>
                    case 'profit':
                      return (
                        <td
                          key={colKey}
                          className={`px-1 py-1 text-center text-xs border ${t.border} ${(sale.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} ${rangeClass} select-none`}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          {sale.profit?.toLocaleString() || '-'}
                        </td>
                      )
                    case 'profit_rate':
                      return (
                        <td
                          key={colKey}
                          className={`px-1 py-1 text-center text-xs border ${t.border} ${(sale.profit_rate || 0) >= 0 ? 'text-green-600' : 'text-red-600'} ${rangeClass} select-none`}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          {sale.profit_rate != null ? `${sale.profit_rate}%` : '-'}
                        </td>
                      )
                    case 'purchase_date':
                      return <React.Fragment key={colKey}>{renderEditableCell('purchase_date', colIndex, sale.purchase_date || '-', 'date')}</React.Fragment>
                    case 'listing_date':
                      return <React.Fragment key={colKey}>{renderEditableCell('listing_date', colIndex, sale.listing_date || '-', 'date')}</React.Fragment>
                    case 'sale_date':
                      return <React.Fragment key={colKey}>{renderEditableCell('sale_date', colIndex, sale.sale_date || '-', 'date')}</React.Fragment>
                    case 'memo':
                      return <React.Fragment key={colKey}>{renderEditableCell('memo', colIndex, sale.memo || '-')}</React.Fragment>
                    case 'turnover_days':
                      return (
                        <td
                          key={colKey}
                          className={`px-2 py-1 text-center text-xs ${t.text} border ${t.border} ${rangeClass} select-none overflow-hidden`}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          <span className="block truncate">{sale.turnover_days ?? '-'}</span>
                        </td>
                      )
                    case 'cost_recovered':
                      return (
                        <td
                          key={colKey}
                          className={`px-2 py-1 text-center text-xs ${t.text} border ${t.border} ${rangeClass} select-none overflow-hidden`}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          <input
                            type="checkbox"
                            checked={sale.cost_recovered || false}
                            onChange={(e) => handleCostRecoveredChange(sale, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      )
                    default:
                      return null
                  }
                }

                return (
                  <tr key={sale.id} className={t.tableRowHover}>
                    {visibleColumns.map((col, colIndex) => renderColumnCell(col.key, colIndex))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className={`text-center ${t.textMuted} py-8`}>
            データがありません
          </div>
        )}
      </div>

      {/* 画像編集モーダル */}
      {imageEditModal && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => {
            setImageEditModal(null)
            setImageUrlInput('')
            setIsDraggingImage(false)
          }}
        >
          <div
            className={`bg-white rounded-lg shadow-xl p-6 w-full max-w-md ${isDraggingImage ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDraggingImage(true)
            }}
            onDragLeave={() => setIsDraggingImage(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDraggingImage(false)
              const file = e.dataTransfer.files[0]
              if (file) {
                handleImageDrop(imageEditModal.id, file)
              }
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {imageEditModal.currentUrl ? '画像を編集' : '画像を追加'}
              </h3>
              <button
                onClick={() => {
                  setImageEditModal(null)
                  setImageUrlInput('')
                  setIsDraggingImage(false)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* 現在の画像プレビュー */}
            {imageEditModal.currentUrl && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">現在の画像:</p>
                <img
                  src={imageEditModal.currentUrl}
                  alt=""
                  className="w-20 h-20 object-cover rounded border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}

            {/* ドラッグ&ドロップエリア */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-colors ${
                isDraggingImage ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="image-upload-manual"
                ref={imageInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleImageDrop(imageEditModal.id, file)
                  }
                }}
              />
              <label htmlFor="image-upload-manual" className="cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-600">
                  {isUploadingImage ? 'アップロード中...' : (
                    <>
                      画像をドラッグ&ドロップ<br />
                      <span className="text-blue-600 hover:text-blue-700">またはクリックして選択</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">最大5MB</p>
              </label>
            </div>

            {/* URL入力 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">または画像URLを入力</label>
              <input
                type="text"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-sm"
                onKeyDown={(e) => {
                  // IME入力中（変換確定のEnter）は無視
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Enter' && imageUrlInput.trim()) {
                    handleSaveImageUrl(imageEditModal.id, imageUrlInput)
                  }
                }}
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setImageEditModal(null)
                  setImageUrlInput('')
                  setIsDraggingImage(false)
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSaveImageUrl(imageEditModal.id, imageUrlInput)}
                disabled={!imageUrlInput.trim()}
                className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                URL保存
              </button>
            </div>

            {/* 画像削除ボタン */}
            {imageEditModal.currentUrl && (
              <button
                onClick={async () => {
                  if (confirm('画像を削除しますか？')) {
                    try {
                      const { error } = await supabase
                        .from('manual_sales')
                        .update({ image_url: null })
                        .eq('id', imageEditModal.id)
                      if (error) throw error
                      setSales(prev => prev.map(item =>
                        item.id === imageEditModal.id ? { ...item, image_url: null } : item
                      ))
                      setImageEditModal(null)
                      setImageUrlInput('')
                    } catch (error) {
                      console.error('Error deleting image:', error)
                      alert('画像の削除に失敗しました')
                    }
                  }
                }}
                className="w-full mt-3 px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200"
              >
                画像を削除
              </button>
            )}
          </div>
        </div>
      )}

      {/* セル編集バー（画面下部に固定表示） */}
      {modalEdit && (
        <div className="fixed bottom-4 left-4 right-4 z-[110] bg-white shadow-lg border rounded-lg">
          <div className="px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {modalEdit.field === 'product_name' ? '商品名' : modalEdit.field === 'brand_name' ? 'ブランド名' : modalEdit.field === 'inventory_number' ? '管理番号' : modalEdit.field}:
            </span>
            <input
              type="text"
              value={modalEdit.value}
              onChange={(e) => setModalEdit({ ...modalEdit, value: e.target.value })}
              className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              autoFocus
              onKeyDown={(e) => {
                // IME入力中（変換確定のEnter）は無視
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveModalEdit()
                } else if (e.key === 'Escape') {
                  setModalEdit(null)
                }
              }}
            />
            <button
              onClick={() => setModalEdit(null)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium whitespace-nowrap"
            >
              キャンセル
            </button>
            <button
              onClick={saveModalEdit}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium whitespace-nowrap"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* 転記先選択モーダル */}
      {transferModal && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setTransferModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">転記先を選択</h3>
              <button
                onClick={() => setTransferModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              「{transferModal.sale.product_name}」をどこに転記しますか？
            </p>

            <div className="space-y-3">
              {/* 通算（売上明細のみ） */}
              <button
                onClick={() => executeTransfer(null)}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">通算（売上明細のみ）</div>
                <div className="text-sm text-gray-500">まとめ仕入れに紐づけずに売上明細に追加</div>
              </button>

              {/* 仕入別 */}
              {transferModal.bulkPurchases.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">仕入別（まとめ仕入れに紐づけ）</div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {transferModal.bulkPurchases.map((bp) => (
                      <button
                        key={bp.id}
                        onClick={() => executeTransfer(bp.id)}
                        className="w-full px-4 py-2 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{bp.genre}</div>
                        <div className="text-sm text-gray-500">{bp.purchase_date}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {transferModal.bulkPurchases.length === 0 && (
                <div className="text-sm text-gray-500 italic">
                  まとめ仕入れがありません
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setTransferModal(null)}
                className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規追加モーダル */}
      {addModal && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setAddModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">新規売上を追加</h3>
              <button
                onClick={() => setAddModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              {/* 商品名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  商品名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addModal.product_name}
                  onChange={(e) => setAddModal({ ...addModal, product_name: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-base"
                  placeholder="商品名を入力"
                  autoFocus
                />
              </div>

              {/* ブランド名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ブランド名</label>
                <input
                  type="text"
                  value={addModal.brand_name}
                  onChange={(e) => setAddModal({ ...addModal, brand_name: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-base"
                  placeholder="ブランド名を入力"
                  list="brand-suggestions"
                />
                <datalist id="brand-suggestions">
                  {availableBrands.map(brand => (
                    <option key={brand} value={brand} />
                  ))}
                </datalist>
              </div>

              {/* ジャンル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ジャンル</label>
                <select
                  value={addModal.category}
                  onChange={(e) => setAddModal({ ...addModal, category: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-base"
                >
                  <option value="">選択してください</option>
                  {categoryOptions.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* 販売先と仕入先を横並び */}
              <div className="grid grid-cols-2 gap-3">
                {/* 販売先 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">販売先</label>
                  <select
                    value={addModal.sale_destination}
                    onChange={(e) => setAddModal({ ...addModal, sale_destination: e.target.value })}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-base"
                  >
                    <option value="">選択</option>
                    {salePlatforms.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* 仕入先 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仕入先</label>
                  <select
                    value={addModal.purchase_source}
                    onChange={(e) => setAddModal({ ...addModal, purchase_source: e.target.value })}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-base"
                  >
                    <option value="">選択</option>
                    {purchasePlatforms.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 売価と原価を横並び */}
              <div className="grid grid-cols-2 gap-3">
                {/* 売価 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">売価</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={addModal.sale_price}
                    onChange={(e) => setAddModal({ ...addModal, sale_price: e.target.value })}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-base"
                    placeholder="0"
                  />
                </div>

                {/* 原価 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">原価</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={addModal.purchase_price}
                    onChange={(e) => setAddModal({ ...addModal, purchase_price: e.target.value })}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-base"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 日付入力 */}
              <div className="grid grid-cols-3 gap-3">
                {/* 仕入日 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仕入日</label>
                  <input
                    type="date"
                    value={addModal.purchase_date}
                    onChange={(e) => setAddModal({ ...addModal, purchase_date: e.target.value })}
                    className="w-full px-2 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-sm"
                  />
                </div>

                {/* 出品日 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">出品日</label>
                  <input
                    type="date"
                    value={addModal.listing_date}
                    onChange={(e) => setAddModal({ ...addModal, listing_date: e.target.value })}
                    className="w-full px-2 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-sm"
                  />
                </div>

                {/* 売却日 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">売却日</label>
                  <input
                    type="date"
                    value={addModal.sale_date}
                    onChange={(e) => setAddModal({ ...addModal, sale_date: e.target.value })}
                    className="w-full px-2 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-sm"
                  />
                </div>
              </div>

              {/* メモ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                <textarea
                  value={addModal.memo}
                  onChange={(e) => setAddModal({ ...addModal, memo: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-base resize-none"
                  rows={2}
                  placeholder="メモを入力"
                />
              </div>
            </div>

            {/* フッターボタン */}
            <div className="p-4 border-t bg-gray-50 flex gap-3 sticky bottom-0">
              <button
                onClick={() => setAddModal(null)}
                className="flex-1 px-4 py-3 text-base text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveNewSale}
                disabled={isAddingNew || !addModal.product_name.trim()}
                className="flex-1 px-4 py-3 text-base text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingNew ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSVインポートモーダル */}
      {csvImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {csvImportModal.step === 'header-select' && 'ヘッダー行の選択'}
                {csvImportModal.step === 'mapping' && 'カラムマッピング'}
                {csvImportModal.step === 'preview' && 'インポートプレビュー'}
                {csvImportModal.step === 'importing' && 'インポート中...'}
              </h2>
              {csvImportModal.step !== 'importing' && (
                <button
                  onClick={() => setCsvImportModal(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              {csvImportModal.step === 'header-select' && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    ヘッダー（列名）がある行をクリックしてください。<br />
                    選択した行より上の行はスキップされます。
                  </p>
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-sm">
                      <tbody>
                        {csvImportModal.previewRows.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            onClick={() => setCsvImportModal({ ...csvImportModal, headerRow: rowIndex + 1 })}
                            className={`cursor-pointer transition-colors ${
                              csvImportModal.headerRow === rowIndex + 1
                                ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset'
                                : rowIndex + 1 < csvImportModal.headerRow
                                ? 'bg-gray-100 text-gray-400'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-2 py-2 text-gray-400 text-xs w-8 text-right border-r">
                              {rowIndex + 1}
                            </td>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-3 py-2 text-gray-900 whitespace-nowrap max-w-[200px] truncate">
                                {cell || <span className="text-gray-300">（空）</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-sm text-blue-600">
                    選択中: {csvImportModal.headerRow}行目をヘッダーとして使用
                    {csvImportModal.headerRow > 1 && (
                      <span className="text-gray-500">（1〜{csvImportModal.headerRow - 1}行目はスキップ）</span>
                    )}
                  </p>
                </>
              )}

              {csvImportModal.step === 'mapping' && (
                <>
                  {(() => {
                    const productNameCol = Object.entries(csvImportModal.mapping).find(([, v]) => v === 'product_name')?.[0]
                    const validCount = csvImportModal.csvData.filter(row =>
                      productNameCol && row[productNameCol]?.trim()
                    ).length
                    const totalCount = csvImportModal.csvData.length
                    return (
                      <p className="text-sm text-gray-600 mb-4">
                        CSVの各列を、どの項目に入れるか選んでください
                        <br />
                        <span className="font-medium">
                          インポート対象: {validCount}件 / 全{totalCount}行
                          {validCount < totalCount && <span className="text-orange-600">（{totalCount - validCount}行は商品名がないためスキップ）</span>}
                        </span>
                      </p>
                    )
                  })()}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">CSVの列</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">データ例</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">手入力売上の項目</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvImportModal.csvHeaders.map((header, index) => (
                        <tr key={`header-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-900 font-medium">{header}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">
                            {csvImportModal.csvData[0]?.[header] || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={csvImportModal.mapping[header] || ''}
                              onChange={(e) => {
                                const newMapping = { ...csvImportModal.mapping }
                                if (e.target.value === '') {
                                  delete newMapping[header]
                                } else {
                                  Object.keys(newMapping).forEach(key => {
                                    if (newMapping[key] === e.target.value && key !== header) {
                                      delete newMapping[key]
                                    }
                                  })
                                  newMapping[header] = e.target.value
                                }
                                setCsvImportModal({ ...csvImportModal, mapping: newMapping })
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900"
                            >
                              <option value="">（インポートしない）</option>
                              {CSV_IMPORT_COLUMNS.map(col => (
                                <option key={col.key} value={col.key}>
                                  {col.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {csvImportModal.step === 'preview' && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {csvImportModal.csvData.length}件中 最初の5件を表示
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          {CSV_IMPORT_COLUMNS.filter(col => Object.values(csvImportModal.mapping).includes(col.key)).map(col => (
                            <th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvImportModal.csvData.slice(0, 5).map((row, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {CSV_IMPORT_COLUMNS.filter(col => Object.values(csvImportModal.mapping).includes(col.key)).map(col => {
                              const csvHeader = Object.keys(csvImportModal.mapping).find(k => csvImportModal.mapping[k] === col.key)
                              return (
                                <td key={col.key} className="px-3 py-2 text-gray-900 max-w-[150px] truncate">
                                  {csvHeader ? row[csvHeader] || '-' : '-'}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 rounded text-yellow-800 text-sm">
                    <p className="font-medium mb-1">インポート前の確認:</p>
                    <ul className="list-disc list-inside">
                      <li>全{csvImportModal.csvData.length}件のデータがインポートされます</li>
                      <li>既存データとの重複チェックは行われません</li>
                    </ul>
                  </div>
                </>
              )}

              {csvImportModal.step === 'importing' && (
                <div className="py-8 text-center">
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${csvImportModal.progress}%` }}
                    />
                  </div>
                  <p className="text-gray-600">{csvImportModal.progress}% 完了</p>
                </div>
              )}
            </div>

            {csvImportModal.step !== 'importing' && (
              <div className="p-4 border-t flex justify-between">
                {csvImportModal.step === 'header-select' && (
                  <>
                    <button
                      onClick={() => setCsvImportModal(null)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={confirmHeaderRow}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      次へ →
                    </button>
                  </>
                )}
                {csvImportModal.step === 'mapping' && (
                  <>
                    <button
                      onClick={() => setCsvImportModal({ ...csvImportModal, step: 'header-select' })}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      ← ヘッダー選択に戻る
                    </button>
                    <button
                      onClick={() => setCsvImportModal({ ...csvImportModal, step: 'preview' })}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      プレビュー →
                    </button>
                  </>
                )}
                {csvImportModal.step === 'preview' && (
                  <>
                    <button
                      onClick={() => setCsvImportModal({ ...csvImportModal, step: 'mapping' })}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      ← マッピングに戻る
                    </button>
                    <button
                      onClick={executeCSVImport}
                      className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      インポート実行
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ヘッダーフィルタードロップダウン - Portalでbodyに直接レンダリング */}
      {isMounted && openFilter && filterDropdownPosition && createPortal(
        <div
          className="filter-dropdown fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] w-56 max-h-80 overflow-y-auto"
          style={{
            top: filterDropdownPosition.top,
            right: filterDropdownPosition.right,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ブランドフィルター */}
          {openFilter === 'brand' && (
            <>
              <div className="p-2 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                <span className="text-xs text-gray-500">{availableBrands.length}件</span>
                {selectedBrands.size > 0 && (
                  <button
                    onClick={() => setSelectedBrands(new Set())}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    クリア
                  </button>
                )}
              </div>
              <div className="p-1">
                {availableBrands.map(brand => (
                  <label
                    key={brand}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBrands.has(brand)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedBrands)
                        if (e.target.checked) {
                          newSelected.add(brand)
                        } else {
                          newSelected.delete(brand)
                        }
                        setSelectedBrands(newSelected)
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{brand}</span>
                  </label>
                ))}
                {availableBrands.length === 0 && (
                  <p className="text-sm text-gray-500 px-2 py-2">ブランドがありません</p>
                )}
              </div>
            </>
          )}
          {/* カテゴリフィルター */}
          {openFilter === 'category' && (
            <>
              <div className="p-2 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                <span className="text-xs text-gray-500">{availableCategories.length}件</span>
                {selectedCategories.size > 0 && (
                  <button
                    onClick={() => setSelectedCategories(new Set())}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    クリア
                  </button>
                )}
              </div>
              <div className="p-1">
                {availableCategories.map(category => (
                  <label
                    key={category}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.has(category)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedCategories)
                        if (e.target.checked) {
                          newSelected.add(category)
                        } else {
                          newSelected.delete(category)
                        }
                        setSelectedCategories(newSelected)
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{category}</span>
                  </label>
                ))}
                {availableCategories.length === 0 && (
                  <p className="text-sm text-gray-500 px-2 py-2">カテゴリがありません</p>
                )}
              </div>
            </>
          )}
          {/* 仕入先フィルター */}
          {openFilter === 'purchase_source' && (
            <>
              <div className="p-2 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                <span className="text-xs text-gray-500">{availablePurchaseSources.length}件</span>
                {selectedPurchaseSources.size > 0 && (
                  <button
                    onClick={() => setSelectedPurchaseSources(new Set())}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    クリア
                  </button>
                )}
              </div>
              <div className="p-1">
                {availablePurchaseSources.map(source => (
                  <label
                    key={source}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPurchaseSources.has(source)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedPurchaseSources)
                        if (e.target.checked) {
                          newSelected.add(source)
                        } else {
                          newSelected.delete(source)
                        }
                        setSelectedPurchaseSources(newSelected)
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{source}</span>
                  </label>
                ))}
                {availablePurchaseSources.length === 0 && (
                  <p className="text-sm text-gray-500 px-2 py-2">仕入先がありません</p>
                )}
              </div>
            </>
          )}
          {/* 販売先フィルター */}
          {openFilter === 'sale_destination' && (
            <>
              <div className="p-2 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                <span className="text-xs text-gray-500">{availableSaleDestinations.length}件</span>
                {selectedSaleDestinations.size > 0 && (
                  <button
                    onClick={() => setSelectedSaleDestinations(new Set())}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    クリア
                  </button>
                )}
              </div>
              <div className="p-1">
                {availableSaleDestinations.map(destination => (
                  <label
                    key={destination}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSaleDestinations.has(destination)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedSaleDestinations)
                        if (e.target.checked) {
                          newSelected.add(destination)
                        } else {
                          newSelected.delete(destination)
                        }
                        setSelectedSaleDestinations(newSelected)
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{destination}</span>
                  </label>
                ))}
                {availableSaleDestinations.length === 0 && (
                  <p className="text-sm text-gray-500 px-2 py-2">販売先がありません</p>
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}

      {/* 固定横スクロールバー - Portalでbodyに直接レンダリング */}
      {isMounted && scrollWidth > 0 && createPortal(
        <div
          ref={fixedScrollbarRef}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '20px',
            backgroundColor: '#d1d5db',
            borderTop: '1px solid #9ca3af',
            zIndex: 99999,
            overflowX: 'scroll',
            overflowY: 'hidden'
          }}
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>,
        document.body
      )}
    </div>
  )
}
