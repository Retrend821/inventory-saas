'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Papa from 'papaparse'
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
  type: 'purchase' | 'sale'
}

// テーブルのカラム定義
const columns: { key: keyof ManualSale | 'no' | 'actions'; label: string; editable: boolean; type: 'text' | 'number' | 'date' | 'select' | 'readonly' }[] = [
  { key: 'no', label: 'No', editable: false, type: 'readonly' },
  { key: 'inventory_number', label: '管理番号', editable: true, type: 'text' },
  { key: 'image_url', label: '画像', editable: false, type: 'readonly' },
  { key: 'category', label: 'ジャンル', editable: true, type: 'text' },
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
  { key: 'actions', label: '操作', editable: false, type: 'readonly' },
]

export default function ManualSalesPage() {
  const { user, loading: authLoading } = useAuth()
  const [sales, setSales] = useState<ManualSale[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  // セル選択用の状態
  const [selectedCell, setSelectedCell] = useState<{ id: string; field: keyof ManualSale } | null>(null)
  // セル編集用の状態
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof ManualSale } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const editCellRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
  // 商品名モーダル編集用の状態
  const [modalEdit, setModalEdit] = useState<{ id: string; field: keyof ManualSale; value: string } | null>(null)
  // 画像編集モーダル用の状態
  const [imageEditModal, setImageEditModal] = useState<{ id: string; currentUrl: string | null } | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [newSale, setNewSale] = useState<Partial<ManualSale>>({
    sale_type: 'main'
  })
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'main' | 'bulk'>('all')
  // 列の表示/非表示
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  // 転記先選択モーダル用の状態
  const [transferModal, setTransferModal] = useState<{ sale: ManualSale; bulkPurchases: { id: string; genre: string; purchase_date: string }[] } | null>(null)
  // Undo履歴
  const [undoHistory, setUndoHistory] = useState<{ id: string; field: keyof ManualSale; oldValue: unknown; newValue: unknown }[]>([])

  // ラクマ手数料設定
  const [rakumaCommissionSettings, setRakumaCommissionSettings] = useState<Record<string, number>>({})

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
          .range(from, from + pageSize - 1)
          .order('sale_date', { ascending: false })

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

      // プラットフォーム取得
      const { data: platformData } = await supabase
        .from('platforms')
        .select('*')
      if (platformData) {
        setPlatforms(platformData)
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
    sales.forEach(sale => {
      const year = extractYear(sale.sale_date)
      if (year) years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [sales])

  // フィルタリング
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
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
      return true
    })
  }, [sales, selectedYear, selectedMonth, saleTypeFilter])

  // 利益計算
  const calculateProfit = (sale: Partial<ManualSale>): number => {
    const salePrice = sale.sale_price || 0
    const purchaseTotal = sale.purchase_total || sale.purchase_price || 0
    const commission = sale.commission || 0
    const shippingCost = sale.shipping_cost || 0
    const otherCost = sale.other_cost || 0
    return salePrice - purchaseTotal - commission - shippingCost - otherCost
  }

  // 利益率計算
  const calculateProfitRate = (sale: Partial<ManualSale>): number => {
    const salePrice = sale.sale_price || 0
    if (salePrice === 0) return 0
    const profit = calculateProfit(sale)
    return Math.round((profit / salePrice) * 100 * 10) / 10
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
      default:
        return null
    }
  }

  // セルクリックで選択 (ダブルクリックで編集開始)
  const handleCellClick = (sale: ManualSale, field: keyof ManualSale) => {
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
  const editableColumns = columns.filter(col => col.editable && col.key !== 'no' && col.key !== 'actions' && col.key !== 'image_url')

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

    // 日付フィールドの正規化
    const dateFields: (keyof ManualSale)[] = ['purchase_date', 'listing_date', 'sale_date']
    if (dateFields.includes(field) && newValue) {
      newValue = normalizeDate(String(newValue))
    }

    // ローカル状態を更新
    const updatedSale = { ...sale, [field]: newValue }

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

  // キーボード操作（編集中）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell) return

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
      if (isAdding || imageEditModal || modalEdit) return

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
  }, [selectedCell, editingCell, filteredSales, editableColumns, isAdding, imageEditModal, modalEdit])

  // 新規追加
  const handleAdd = async () => {
    if (!newSale.product_name) {
      alert('商品名は必須です')
      return
    }

    const profit = calculateProfit(newSale)
    const profitRate = calculateProfitRate(newSale)
    const turnoverDays = calculateTurnoverDays(newSale)

    const { data, error } = await supabase
      .from('manual_sales')
      .insert([{
        ...newSale,
        profit,
        profit_rate: profitRate,
        turnover_days: turnoverDays,
        purchase_date: normalizeDate(newSale.purchase_date || null),
        listing_date: normalizeDate(newSale.listing_date || null),
        sale_date: normalizeDate(newSale.sale_date || null),
      }])
      .select()

    if (error) {
      console.error('Error adding sale:', error)
      alert('追加に失敗しました: ' + error.message)
      return
    }

    if (data) {
      setSales([data[0], ...sales])
      setNewSale({ sale_type: 'main' })
      setIsAdding(false)
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

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm('この売上データを削除しますか？')) return

    const { error } = await supabase
      .from('manual_sales')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting sale:', error)
      alert('削除に失敗しました')
      return
    }

    setSales(sales.filter(s => s.id !== id))
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

      // 元の仕入総額と利益を再計算
      const originalPurchaseTotal = sale.purchase_price || 0
      const salePrice = sale.sale_price || 0
      const commission = sale.commission || 0
      const shippingCost = sale.shipping_cost || 0
      const otherCost = sale.other_cost || 0
      const profit = salePrice - originalPurchaseTotal - commission - shippingCost - otherCost
      const profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100 * 10) / 10 : 0

      // manual_salesを更新（仕入総額・利益を元に戻す）
      setSales(sales.map(s => s.id === sale.id ? {
        ...s,
        cost_recovered: false,
        purchase_total: originalPurchaseTotal,
        profit,
        profit_rate: profitRate
      } : s))
      await supabase.from('manual_sales').update({
        cost_recovered: false,
        purchase_total: originalPurchaseTotal,
        profit,
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

    setTransferModal({ sale, bulkPurchases: bulkPurchases || [] })
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

    // bulk_salesに転記
    const insertData: Record<string, unknown> = {
      product_name: sale.product_name,
      brand_name: sale.brand_name,
      category: sale.category,
      image_url: sale.image_url,
      purchase_price: sale.purchase_price,
      sale_date: sale.sale_date,
      sale_destination: sale.sale_destination,
      quantity: 1,
      sale_amount: sale.sale_price,
      commission: sale.commission || 0,
      shipping_cost: sale.shipping_cost || 0,
      other_cost: sale.other_cost || 0,
      deposit_amount: sale.deposit_amount,
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

  const purchasePlatforms = platforms.filter(p => p.type === 'purchase')
  const salePlatforms = platforms.filter(p => p.type === 'sale')

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
    brand_name: ['ブランド', 'brand', 'メーカー', 'maker'],
    category: ['カテゴリ', 'category', '種類', '分類', 'ジャンル', '商品区分', '区分'],
    image_url: ['画像', 'image', 'photo', '写真', 'url'],
    purchase_price: ['原価', '仕入値', '仕入れ値'],
    purchase_total: ['仕入総額', '総額', 'total', '合計'],
    sale_price: ['販売価格', '売価', '売値', '出品価格', 'selling_price'],
    commission: ['手数料', 'commission', 'fee'],
    shipping_cost: ['送料', 'shipping', '配送料'],
    other_cost: ['経費', 'その他', 'other', '諸経費'],
    deposit_amount: ['入金', '入金額', 'deposit'],
    purchase_date: ['仕入日', '購入日', 'purchase_date', '取引日'],
    listing_date: ['出品日', 'listing_date'],
    sale_date: ['売却日', '販売日', 'sale_date', '売上日'],
    purchase_source: ['仕入先', '仕入れ先', 'source', '出品者'],
    sale_destination: ['販路', '販売先', '出品先', 'destination'],
    memo: ['メモ', 'memo', 'note', '備考', 'コメント'],
    inventory_number: ['管理番号', '番号', 'number', 'id'],
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

  const handleCSVFileSelect = (file: File) => {
    const showHeaderSelect = (text: string) => {
      // 最初の10行をプレビュー用に取得
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        preview: 10,
        complete: (results) => {
          const rows = results.data as string[][]
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
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const hasJapanese = /[あ-んア-ン一-龯]/.test(text)
      const hasGarbage = /[\ufffd\u0000-\u001f]/.test(text) && !hasJapanese
      if (hasGarbage || (!hasJapanese && text.includes('�'))) {
        const sjisReader = new FileReader()
        sjisReader.onload = (e) => {
          const sjisText = e.target?.result as string
          showHeaderSelect(sjisText)
        }
        sjisReader.readAsText(file, 'Shift_JIS')
      } else {
        showHeaderSelect(text)
      }
    }
    reader.readAsText(file, 'UTF-8')
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
        const autoMapped = autoMappingCSV(headers)
        setCsvImportModal({
          ...csvImportModal,
          step: 'mapping',
          csvHeaders: headers,
          csvData: data,
          mapping: autoMapped,
        })
      }
    })
  }

  const executeCSVImport = async () => {
    if (!csvImportModal) return
    const { csvData, mapping } = csvImportModal

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

    let success = 0
    let failed = 0
    const batchSize = 50

    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize)

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

        Object.entries(mapping).forEach(([csvHeader, column]) => {
          // 許可されたカラムのみ処理（image_urlなどスキップ）
          if (!allowedColumns.includes(column)) return

          const value = row[csvHeader]
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
        const purchaseTotal = (record.purchase_total as number) || (record.purchase_price as number) || 0
        const shippingCost = (record.shipping_cost as number) || 0
        const otherCost = (record.other_cost as number) || 0
        const profit = salePrice - purchaseTotal - commission - shippingCost - otherCost
        let profitRate = salePrice > 0 ? Math.round((profit / salePrice) * 100 * 10) / 10 : 0
        // データベースのNUMERIC(5,1)制限に合わせてクランプ (-9999.9〜9999.9)
        profitRate = Math.max(-9999.9, Math.min(9999.9, profitRate))

        record.profit = profit
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
    const skipped = csvData.length - success - failed
    alert(`インポート完了: ${success}件成功${failed > 0 ? `、${failed}件失敗` : ''}${skipped > 0 ? `、${skipped}件スキップ` : ''}`)

    // データを再取得
    const { data: newData } = await supabase
      .from('manual_sales')
      .select('*')
      .order('sale_date', { ascending: false })
    if (newData) {
      setSales(newData)
    }
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
    const nonEditableFields = ['id', 'created_at', 'no', 'image_url', 'profit', 'profit_rate', 'turnover_days', 'cost_recovered', 'actions']

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
    <div className={`min-h-screen ${t.bg}`} style={{ paddingBottom: '20px' }}>
      <Navigation />
      <div className="pt-14 px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">手入力売上表</h1>
          <div className="flex items-center gap-3">
            {/* 列の編集ボタン */}
            <div className="relative">
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                列の編集
              </button>
              {showColumnSettings && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowColumnSettings(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[200px] max-h-[400px] overflow-y-auto">
                    <div className="text-xs font-medium text-gray-500 mb-2">表示する列</div>
                    {columns.filter(col => col.key !== 'no' && col.key !== 'actions').map(col => (
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
            {/* CSVインポートボタン */}
            <input
              type="file"
              accept=".csv"
              ref={csvInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleCSVFileSelect(file)
                }
                e.target.value = ''
              }}
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              CSVインポート
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              新規追加
            </button>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex items-center gap-4 mb-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className={`px-3 py-2 ${t.input} border rounded`}
          >
            <option value="">全年</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={`px-3 py-2 ${t.input} border rounded`}
          >
            <option value="">全月</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
              <option key={month} value={month}>{month}月</option>
            ))}
          </select>
        </div>

        {/* 集計 */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className={`${t.cardBg} p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-sm`}>件数</div>
            <div className={`${t.text} text-xl font-bold`}>{summary.count}件</div>
          </div>
          <div className={`${t.cardBg} p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-sm`}>売上合計</div>
            <div className={`${t.text} text-xl font-bold`}>¥{summary.totalSales.toLocaleString()}</div>
          </div>
          <div className={`${t.cardBg} p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-sm`}>仕入合計</div>
            <div className={`${t.text} text-xl font-bold`}>¥{summary.totalPurchase.toLocaleString()}</div>
          </div>
          <div className={`${t.cardBg} p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-sm`}>利益合計</div>
            <div className={`text-xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ¥{summary.totalProfit.toLocaleString()}
            </div>
          </div>
          <div className={`${t.cardBg} p-4 rounded-lg shadow-sm border ${t.border}`}>
            <div className={`${t.textMuted} text-sm`}>平均利益率</div>
            <div className={`text-xl font-bold ${summary.avgProfitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.avgProfitRate}%
            </div>
          </div>
        </div>

        {/* 新規追加フォーム */}
        {isAdding && (
          <div className={`${t.cardBg} p-4 rounded-lg mb-6 shadow-sm border ${t.border}`}>
            <h2 className={`text-lg font-bold ${t.text} mb-4`}>新規売上追加</h2>
            <div className="grid grid-cols-6 gap-4">
              <div>
                <label className={`${t.textMuted} text-sm`}>管理番号</label>
                <input
                  type="text"
                  value={newSale.inventory_number || ''}
                  onChange={(e) => setNewSale({ ...newSale, inventory_number: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div className="col-span-2">
                <label className={`${t.textMuted} text-sm`}>商品名 *</label>
                <input
                  type="text"
                  value={newSale.product_name || ''}
                  onChange={(e) => setNewSale({ ...newSale, product_name: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>ブランド</label>
                <input
                  type="text"
                  value={newSale.brand_name || ''}
                  onChange={(e) => setNewSale({ ...newSale, brand_name: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>カテゴリ</label>
                <input
                  type="text"
                  value={newSale.category || ''}
                  onChange={(e) => setNewSale({ ...newSale, category: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>仕入原価</label>
                <input
                  type="number"
                  value={newSale.purchase_price || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_price: parseInt(e.target.value) || null })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>仕入合計</label>
                <input
                  type="number"
                  value={newSale.purchase_total || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_total: parseInt(e.target.value) || null })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>売価</label>
                <input
                  type="number"
                  value={newSale.sale_price || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_price: parseInt(e.target.value) || null })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>手数料</label>
                <input
                  type="number"
                  value={newSale.commission || ''}
                  onChange={(e) => setNewSale({ ...newSale, commission: parseInt(e.target.value) || null })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>送料</label>
                <input
                  type="number"
                  value={newSale.shipping_cost || ''}
                  onChange={(e) => setNewSale({ ...newSale, shipping_cost: parseInt(e.target.value) || null })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>その他経費</label>
                <input
                  type="number"
                  value={newSale.other_cost || ''}
                  onChange={(e) => setNewSale({ ...newSale, other_cost: parseInt(e.target.value) || null })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>入金額</label>
                <input
                  type="number"
                  value={newSale.deposit_amount || ''}
                  onChange={(e) => setNewSale({ ...newSale, deposit_amount: parseInt(e.target.value) || null })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>仕入日</label>
                <input
                  type="date"
                  value={newSale.purchase_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_date: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>出品日</label>
                <input
                  type="date"
                  value={newSale.listing_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, listing_date: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>販売日</label>
                <input
                  type="date"
                  value={newSale.sale_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_date: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>仕入先</label>
                <select
                  value={newSale.purchase_source || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_source: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                >
                  <option value="">選択</option>
                  {purchasePlatforms.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`${t.textMuted} text-sm`}>販路</label>
                <select
                  value={newSale.sale_destination || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_destination: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                >
                  <option value="">選択</option>
                  {salePlatforms.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={`${t.textMuted} text-sm`}>メモ</label>
                <input
                  type="text"
                  value={newSale.memo || ''}
                  onChange={(e) => setNewSale({ ...newSale, memo: e.target.value })}
                  className={`w-full px-2 py-1 ${t.input} border rounded`}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                追加
              </button>
              <button
                onClick={() => {
                  setIsAdding(false)
                  setNewSale({ sale_type: 'main' })
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* テーブル */}
        <div
          ref={tableContainerRef}
          className={`overflow-x-auto overflow-y-auto max-h-[calc(100vh-180px)] ${t.cardBg} rounded-lg shadow-sm border ${t.border}`}
        >
          <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: '1560px' }}>
            <thead className="sticky top-0 z-10" style={{ backgroundColor: '#334155' }}>
              <tr>
                {visibleColumns.map(col => {
                  const colWidths: Record<string, number> = {
                    no: 30,
                    inventory_number: 70,  // 管理番号
                    image_url: 50,         // 画像
                    category: 70,          // ジャンル
                    brand_name: 85,        // ブランド名
                    product_name: 240,     // 商品名
                    purchase_source: 60,   // 仕入先
                    sale_destination: 60,  // 販売先
                    sale_price: 50,        // 売価
                    commission: 60,        // 手数料
                    shipping_cost: 50,     // 送料
                    other_cost: 60,        // その他
                    purchase_price: 50,    // 原価
                    purchase_total: 70,    // 仕入総額
                    deposit_amount: 60,    // 入金額
                    profit: 50,            // 利益
                    profit_rate: 60,       // 利益率
                    purchase_date: 70,     // 仕入日
                    listing_date: 70,      // 出品日
                    sale_date: 70,         // 売却日
                    memo: 60,              // メモ
                    turnover_days: 70,     // 回転日数
                    cost_recovered: 70,    // 原価回収
                    actions: 50,           // 操作
                  }
                  return (
                    <th
                      key={col.key}
                      style={{
                        backgroundColor: '#334155',
                        color: '#ffffff',
                        width: `${colWidths[col.key] || 80}px`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      className="px-1 py-2 text-center text-xs font-medium border border-slate-600 whitespace-nowrap"
                    >
                      {col.label}
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
                  const cellClass = `px-1 py-1 text-center text-xs ${t.text} border ${t.border} cursor-pointer ${t.tableRowHover} ${isSelected && !isEditing ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${isEditing ? 'ring-2 ring-blue-500 ring-inset' : ''} ${rangeClass} select-none`

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

                const renderSelectCell = (field: keyof ManualSale, colIndex: number, value: string | null, options: Platform[]) => {
                  const isEditing = editingCell?.id === sale.id && editingCell?.field === field
                  const isSelected = isSelectedCell(sale.id, field)
                  const inRange = isCellInRange(rowIndex, colIndex)
                  const rangeClass = inRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''
                  const cellClass = `px-1 py-1 text-center text-xs ${t.text} border ${t.border} cursor-pointer ${t.tableRowHover} ${isSelected && !isEditing ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${isEditing ? 'ring-2 ring-blue-500 ring-inset' : ''} ${rangeClass} select-none`

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
                        <select
                          ref={(el) => { editCellRef.current = el }}
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value)
                            setTimeout(() => saveEditingCell(), 0)
                          }}
                          onKeyDown={handleKeyDown}
                          className={`w-full px-1 py-0.5 ${t.input} border border-blue-500 rounded text-sm`}
                          autoFocus
                        >
                          <option value="">選択</option>
                          {options.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        value || '-'
                      )}
                    </td>
                  )
                }

                // 各列をレンダリングする関数
                const renderColumnCell = (colKey: string, colIndex: number) => {
                  const inRange = isCellInRange(rowIndex, colIndex)
                  const rangeClass = inRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''

                  switch (colKey) {
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
                      return <React.Fragment key={colKey}>{renderEditableCell('category', colIndex, sale.category || '-')}</React.Fragment>
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
                      return <React.Fragment key={colKey}>{renderSelectCell('sale_destination', colIndex, sale.sale_destination, salePlatforms)}</React.Fragment>
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
                          className={`px-2 py-1 text-center text-xs border ${t.border} ${(sale.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} ${rangeClass} select-none overflow-hidden`}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          <span className="block truncate">{sale.profit?.toLocaleString() || '-'}</span>
                        </td>
                      )
                    case 'profit_rate':
                      return (
                        <td
                          key={colKey}
                          className={`px-2 py-1 text-center text-xs border ${t.border} ${(sale.profit_rate || 0) >= 0 ? 'text-green-600' : 'text-red-600'} ${rangeClass} select-none overflow-hidden`}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          <span className="block truncate">{sale.profit_rate != null ? `${sale.profit_rate}%` : '-'}</span>
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
                    case 'actions':
                      return (
                        <td
                          key={colKey}
                          className={`px-2 py-1 text-center text-xs ${t.text} border ${t.border} ${rangeClass} select-none overflow-hidden`}
                          onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        >
                          <button
                            onClick={() => handleDelete(sale.id)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                          >
                            削除
                          </button>
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

      {/* セル編集バー（画面上部に固定表示） */}
      {modalEdit && (
        <div className="fixed top-14 left-0 right-0 z-[110] bg-white shadow-lg border-b">
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
