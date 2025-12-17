'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
  created_at: string
}

type Platform = {
  id: string
  name: string
  type: 'purchase' | 'sale'
}

export default function ManualSalesPage() {
  const { user, loading: authLoading } = useAuth()
  const [sales, setSales] = useState<ManualSale[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  // セル編集用の状態
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof ManualSale } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const editCellRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
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
  // CSVインポート用state
  const [csvImportModal, setCsvImportModal] = useState<{
    step: 'mapping' | 'preview' | 'importing'
    csvHeaders: string[]
    csvData: Record<string, string>[]
    mapping: Record<string, string>
    progress: number
  } | null>(null)

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

  // セルクリックで編集開始
  const handleCellClick = (sale: ManualSale, field: keyof ManualSale) => {
    // 既に同じセルを編集中なら何もしない
    if (editingCell?.id === sale.id && editingCell?.field === field) return

    // 他のセルを編集中なら先に保存
    if (editingCell) {
      saveEditingCell()
    }

    // 編集不可のフィールドはスキップ
    const readonlyFields: (keyof ManualSale)[] = ['id', 'profit', 'profit_rate', 'turnover_days', 'created_at']
    if (readonlyFields.includes(field)) return

    const value = sale[field]
    setEditingCell({ id: sale.id, field })
    setEditValue(value != null ? String(value) : '')
  }

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

    // 利益・利益率・回転日数を再計算
    const profit = calculateProfit(updatedSale)
    const profitRate = calculateProfitRate(updatedSale)
    const turnoverDays = calculateTurnoverDays(updatedSale)

    setSales(sales.map(s => s.id === id ? { ...s, [field]: newValue, profit, profit_rate: profitRate, turnover_days: turnoverDays } : s))
    setEditingCell(null)

    // DBに保存
    const { error } = await supabase
      .from('manual_sales')
      .update({
        [field]: newValue,
        profit,
        profit_rate: profitRate,
        turnover_days: turnoverDays,
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating cell:', error)
      // エラー時は元に戻す
      setSales(sales.map(s => s.id === id ? sale : s))
    }
  }, [editingCell, editValue, sales])

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

  // キーボード操作
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

  // CSVインポート用の定数とユーティリティ
  const CSV_IMPORT_COLUMNS = [
    { key: 'inventory_number', label: '管理番号' },
    { key: 'product_name', label: '商品名' },
    { key: 'brand_name', label: 'ブランド' },
    { key: 'category', label: 'カテゴリ' },
    { key: 'purchase_price', label: '仕入値' },
    { key: 'purchase_total', label: '仕入総額' },
    { key: 'sale_price', label: '販売価格' },
    { key: 'commission', label: '手数料' },
    { key: 'shipping_cost', label: '送料' },
    { key: 'other_cost', label: 'その他コスト' },
    { key: 'deposit_amount', label: '入金額' },
    { key: 'purchase_date', label: '仕入日' },
    { key: 'listing_date', label: '出品日' },
    { key: 'sale_date', label: '売上日' },
    { key: 'purchase_source', label: '仕入先' },
    { key: 'sale_destination', label: '販売先' },
    { key: 'memo', label: 'メモ' },
    { key: 'image_url', label: '画像URL' },
  ]

  const autoMappingCSV = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {}
    const keywordMap: Record<string, string[]> = {
      inventory_number: ['管理番号', '番号', 'No', 'no', 'ID'],
      product_name: ['商品名', '　商品名'],
      brand_name: ['ブランド名', 'ブランド', 'brand'],
      category: ['カテゴリ', '商品区分', 'category'],
      purchase_price: ['仕入値', '原価', '仕入れ値'],
      purchase_total: ['仕入総額', '総額', '手数料・送料・税込'],
      sale_price: ['販売価格', '売価'],
      commission: ['販売手数料', '手数料'],
      shipping_cost: ['送料'],
      other_cost: ['その他', 'other'],
      deposit_amount: ['入金額', '入金'],
      purchase_date: ['仕入日', '購入日'],
      listing_date: ['出品日'],
      sale_date: ['販売日', '売上日', '落札日'],
      purchase_source: ['仕入先', '仕入れ先'],
      sale_destination: ['販路', '販売先', '最終販路'],
      memo: ['メモ', '備考', 'memo'],
      image_url: ['画像URL', '画像', 'image'],
    }

    headers.forEach(header => {
      const lowerHeader = header.toLowerCase()
      for (const [key, keywords] of Object.entries(keywordMap)) {
        if (keywords.some(kw => lowerHeader.includes(kw.toLowerCase()))) {
          if (!Object.values(mapping).includes(key)) {
            mapping[header] = key
            break
          }
        }
      }
    })
    return mapping
  }

  const parseNumber = (value: string): number | null => {
    if (!value) return null
    const cleaned = value.replace(/[¥￥,、\s()（）]/g, '').replace(/^-/, '')
    const num = parseFloat(cleaned)
    if (isNaN(num)) return null
    return value.includes('(') || value.includes('（') || value.startsWith('-') ? -Math.abs(num) : num
  }

  const parseDate = (value: string): string | null => {
    if (!value) return null
    const cleaned = value.replace(/\//g, '-').trim()
    const match = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (match) {
      const [, year, month, day] = match
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    return null
  }

  // CSVインポート処理
  const handleCSVImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][]
          if (rows.length === 0) {
            alert('データがありません')
            return
          }

          // ヘッダー行を探す
          let headerRowIndex = 0
          const headerKeywords = ['商品', '仕入', 'ブランド', '販売', '価格', 'No', '売上']
          for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const row = rows[i]
            if (!row || row.length < 3) continue
            const rowText = row.join(',')
            const matchCount = headerKeywords.filter(kw => rowText.includes(kw)).length
            if (matchCount >= 2) {
              headerRowIndex = i
              break
            }
          }

          const headerRow = rows[headerRowIndex]
          const dataRows = rows.slice(headerRowIndex + 1)

          const headers = headerRow.map((h, i) => h?.trim() || `列${i + 1}`).filter(h => h)
          const data = dataRows
            .filter(row => row.some(cell => cell && cell.trim()))
            .map(row => {
              const obj: Record<string, string> = {}
              headerRow.forEach((header, i) => {
                const key = header?.trim() || `列${i + 1}`
                if (key && row[i] !== undefined) {
                  obj[key] = row[i]?.trim() || ''
                }
              })
              return obj
            })

          if (data.length === 0) {
            alert('データがありません')
            return
          }

          const autoMapped = autoMappingCSV(headers)
          setCsvImportModal({
            step: 'mapping',
            csvHeaders: headers,
            csvData: data,
            mapping: autoMapped,
            progress: 0,
          })
        }
      })
    }
    reader.readAsText(file, 'UTF-8')
  }

  // CSVインポート実行
  const executeCSVImport = async () => {
    if (!user || !csvImportModal) return
    const { csvData, mapping } = csvImportModal

    setCsvImportModal({ ...csvImportModal, step: 'importing', progress: 0 })

    let success = 0
    let failed = 0
    const batchSize = 50

    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize)

      const records = batch.map(row => {
        const record: Record<string, unknown> = {
          sale_type: 'main',
        }

        Object.entries(mapping).forEach(([csvHeader, dbColumn]) => {
          const value = row[csvHeader]
          if (['purchase_price', 'purchase_total', 'sale_price', 'commission', 'shipping_cost', 'other_cost', 'deposit_amount'].includes(dbColumn)) {
            record[dbColumn] = parseNumber(value)
          } else if (['purchase_date', 'listing_date', 'sale_date'].includes(dbColumn)) {
            record[dbColumn] = parseDate(value)
          } else {
            record[dbColumn] = value || null
          }
        })

        // 利益計算
        const salePrice = record.sale_price as number | null
        const purchaseTotal = record.purchase_total as number | null
        const otherCost = record.other_cost as number | null
        const depositAmount = record.deposit_amount as number | null
        const saleDate = record.sale_date as string | null

        // 売上日がある場合のみ利益を計算
        if (saleDate && depositAmount !== null) {
          record.profit = depositAmount - (purchaseTotal || 0) - (otherCost || 0)
          if (salePrice && salePrice > 0) {
            record.profit_rate = Math.round(((record.profit as number) / salePrice) * 100)
          }
        }

        // 回転日数
        const purchaseDate = record.purchase_date as string | null
        if (purchaseDate && saleDate) {
          const pDate = new Date(purchaseDate)
          const sDate = new Date(saleDate)
          record.turnover_days = Math.ceil((sDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24))
        }

        return record
      }).filter(record => record.product_name)

      if (records.length === 0) continue

      const { error } = await supabase.from('manual_sales').insert(records)
      if (error) {
        console.error('Import error:', error)
        failed += records.length
      } else {
        success += records.length
      }

      setCsvImportModal(prev => prev ? { ...prev, progress: Math.round(((i + batch.length) / csvData.length) * 100) } : null)
    }

    setCsvImportModal(null)
    const skipped = csvData.length - success - failed
    alert(`インポート完了: ${success}件成功${failed > 0 ? `、${failed}件失敗` : ''}${skipped > 0 ? `、${skipped}件スキップ` : ''}`)

    // データ再取得
    const { data } = await supabase
      .from('manual_sales')
      .select('*')
      .order('sale_date', { ascending: false })
    if (data) setSales(data)
  }

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Navigation />
        <div className="pt-14 flex items-center justify-center min-h-screen">
          <div className="text-white">読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Navigation />
        <div className="pt-14 flex items-center justify-center min-h-screen">
          <div className="text-white">ログインしてください</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navigation />
      <div className="pt-14 px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">手入力売上表</h1>
          <div className="flex items-center gap-2">
            <label className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">
              CSVインポート
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleCSVImport(file)
                  e.target.value = ''
                }}
                className="hidden"
              />
            </label>
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
            className="px-3 py-2 bg-slate-800 text-white border border-slate-600 rounded"
          >
            <option value="">全年</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-slate-800 text-white border border-slate-600 rounded"
          >
            <option value="">全月</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
              <option key={month} value={month}>{month}月</option>
            ))}
          </select>
        </div>

        {/* 集計 */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">件数</div>
            <div className="text-white text-xl font-bold">{summary.count}件</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">売上合計</div>
            <div className="text-white text-xl font-bold">¥{summary.totalSales.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">仕入合計</div>
            <div className="text-white text-xl font-bold">¥{summary.totalPurchase.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">利益合計</div>
            <div className={`text-xl font-bold ${summary.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ¥{summary.totalProfit.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="text-slate-400 text-sm">平均利益率</div>
            <div className={`text-xl font-bold ${summary.avgProfitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.avgProfitRate}%
            </div>
          </div>
        </div>

        {/* 新規追加フォーム */}
        {isAdding && (
          <div className="bg-slate-800 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-bold text-white mb-4">新規売上追加</h2>
            <div className="grid grid-cols-6 gap-4">
              <div>
                <label className="text-slate-400 text-sm">管理番号</label>
                <input
                  type="text"
                  value={newSale.inventory_number || ''}
                  onChange={(e) => setNewSale({ ...newSale, inventory_number: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-sm">商品名 *</label>
                <input
                  type="text"
                  value={newSale.product_name || ''}
                  onChange={(e) => setNewSale({ ...newSale, product_name: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">ブランド</label>
                <input
                  type="text"
                  value={newSale.brand_name || ''}
                  onChange={(e) => setNewSale({ ...newSale, brand_name: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">カテゴリ</label>
                <input
                  type="text"
                  value={newSale.category || ''}
                  onChange={(e) => setNewSale({ ...newSale, category: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">仕入原価</label>
                <input
                  type="number"
                  value={newSale.purchase_price || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_price: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">仕入合計</label>
                <input
                  type="number"
                  value={newSale.purchase_total || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_total: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">売価</label>
                <input
                  type="number"
                  value={newSale.sale_price || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_price: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">手数料</label>
                <input
                  type="number"
                  value={newSale.commission || ''}
                  onChange={(e) => setNewSale({ ...newSale, commission: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">送料</label>
                <input
                  type="number"
                  value={newSale.shipping_cost || ''}
                  onChange={(e) => setNewSale({ ...newSale, shipping_cost: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">その他経費</label>
                <input
                  type="number"
                  value={newSale.other_cost || ''}
                  onChange={(e) => setNewSale({ ...newSale, other_cost: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">入金額</label>
                <input
                  type="number"
                  value={newSale.deposit_amount || ''}
                  onChange={(e) => setNewSale({ ...newSale, deposit_amount: parseInt(e.target.value) || null })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">仕入日</label>
                <input
                  type="date"
                  value={newSale.purchase_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_date: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">出品日</label>
                <input
                  type="date"
                  value={newSale.listing_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, listing_date: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">販売日</label>
                <input
                  type="date"
                  value={newSale.sale_date || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_date: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm">仕入先</label>
                <select
                  value={newSale.purchase_source || ''}
                  onChange={(e) => setNewSale({ ...newSale, purchase_source: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                >
                  <option value="">選択</option>
                  {purchasePlatforms.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm">販路</label>
                <select
                  value={newSale.sale_destination || ''}
                  onChange={(e) => setNewSale({ ...newSale, sale_destination: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
                >
                  <option value="">選択</option>
                  {salePlatforms.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-sm">メモ</label>
                <input
                  type="text"
                  value={newSale.memo || ''}
                  onChange={(e) => setNewSale({ ...newSale, memo: e.target.value })}
                  className="w-full px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded"
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
                className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-700">
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">No</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">管理番号</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">画像</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">ジャンル</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">ブランド名</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">商品名</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">仕入先</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">販売先</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">売価</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">手数料</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">送料</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">その他</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">原価</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">仕入総額</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">入金額</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">利益</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">利益率</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">仕入日</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">出品日</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">売却日</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">回転日数</th>
                <th className="px-3 py-2 text-center text-sm font-medium text-white border border-slate-600 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale, index) => (
                <tr key={sale.id} className="hover:bg-slate-800">
                  {/* No */}
                  <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                    {index + 1}
                  </td>
                  {/* 管理番号 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'inventory_number')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'inventory_number' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.inventory_number || '-'
                    )}
                  </td>
                  {/* 画像 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => openImageModal(sale)}
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
                      <span className="text-slate-500">+</span>
                    )}
                  </td>
                  {/* ジャンル */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'category')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'category' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.category || '-'
                    )}
                  </td>
                  {/* ブランド名 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'brand_name')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'brand_name' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.brand_name || '-'
                    )}
                  </td>
                  {/* 商品名 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'product_name')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'product_name' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.product_name || '-'
                    )}
                  </td>
                  {/* 仕入先 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'purchase_source')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'purchase_source' ? (
                      <select
                        ref={(el) => { editCellRef.current = el }}
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value)
                          setTimeout(() => saveEditingCell(), 0)
                        }}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      >
                        <option value="">選択</option>
                        {purchasePlatforms.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      sale.purchase_source || '-'
                    )}
                  </td>
                  {/* 販売先 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'sale_destination')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'sale_destination' ? (
                      <select
                        ref={(el) => { editCellRef.current = el }}
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value)
                          setTimeout(() => saveEditingCell(), 0)
                        }}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      >
                        <option value="">選択</option>
                        {salePlatforms.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      sale.sale_destination || '-'
                    )}
                  </td>
                  {/* 売価 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'sale_price')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'sale_price' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.sale_price?.toLocaleString() || '-'
                    )}
                  </td>
                  {/* 手数料 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'commission')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'commission' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.commission?.toLocaleString() || '-'
                    )}
                  </td>
                  {/* 送料 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'shipping_cost')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'shipping_cost' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.shipping_cost?.toLocaleString() || '-'
                    )}
                  </td>
                  {/* その他 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'other_cost')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'other_cost' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.other_cost?.toLocaleString() || '-'
                    )}
                  </td>
                  {/* 原価 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'purchase_price')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'purchase_price' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.purchase_price?.toLocaleString() || '-'
                    )}
                  </td>
                  {/* 仕入総額 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'purchase_total')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'purchase_total' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.purchase_total?.toLocaleString() || '-'
                    )}
                  </td>
                  {/* 入金額 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'deposit_amount')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'deposit_amount' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.deposit_amount?.toLocaleString() || '-'
                    )}
                  </td>
                  {/* 利益（自動計算） */}
                  <td className={`px-3 py-2 text-center text-sm border border-slate-600 whitespace-nowrap ${(sale.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {sale.profit?.toLocaleString() || '-'}
                  </td>
                  {/* 利益率（自動計算） */}
                  <td className={`px-3 py-2 text-center text-sm border border-slate-600 whitespace-nowrap ${(sale.profit_rate || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {sale.profit_rate != null ? `${sale.profit_rate}%` : '-'}
                  </td>
                  {/* 仕入日 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'purchase_date')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'purchase_date' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.purchase_date || '-'
                    )}
                  </td>
                  {/* 出品日 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'listing_date')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'listing_date' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.listing_date || '-'
                    )}
                  </td>
                  {/* 売却日 */}
                  <td
                    className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700"
                    onClick={() => handleCellClick(sale, 'sale_date')}
                  >
                    {editingCell?.id === sale.id && editingCell?.field === 'sale_date' ? (
                      <input
                        ref={(el) => { editCellRef.current = el }}
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="px-1 py-0.5 bg-slate-700 text-white border border-blue-500 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      sale.sale_date || '-'
                    )}
                  </td>
                  {/* 回転日数（自動計算） */}
                  <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                    {sale.turnover_days ?? '-'}
                  </td>
                  {/* 操作 */}
                  <td className="px-3 py-2 text-center text-sm text-white border border-slate-600 whitespace-nowrap">
                    <button
                      onClick={() => handleDelete(sale.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center text-slate-400 py-8">
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

      {/* CSVインポートモーダル */}
      {csvImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {csvImportModal.step === 'mapping' && 'CSVインポート - 列のマッピング'}
                {csvImportModal.step === 'preview' && 'CSVインポート - プレビュー'}
                {csvImportModal.step === 'importing' && 'インポート中...'}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {csvImportModal.step === 'mapping' && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    CSVの各列をどの項目にインポートするか選択してください（{csvImportModal.csvData.length}件）
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-3 py-2 text-left font-semibold text-gray-900">CSV列名</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-900">サンプル値</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-900">インポート先</th>
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
                                onChange={(e) => setCsvImportModal({
                                  ...csvImportModal,
                                  mapping: { ...csvImportModal.mapping, [header]: e.target.value }
                                })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                              >
                                <option value="">-- 無視 --</option>
                                {CSV_IMPORT_COLUMNS.map(col => (
                                  <option key={col.key} value={col.key}>{col.label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                </>
              )}

              {csvImportModal.step === 'importing' && (
                <div className="text-center py-8">
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
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={() => setCsvImportModal(null)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  キャンセル
                </button>
                {csvImportModal.step === 'mapping' && (
                  <button
                    onClick={() => setCsvImportModal({ ...csvImportModal, step: 'preview' })}
                    className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    次へ
                  </button>
                )}
                {csvImportModal.step === 'preview' && (
                  <>
                    <button
                      onClick={() => setCsvImportModal({ ...csvImportModal, step: 'mapping' })}
                      className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      戻る
                    </button>
                    <button
                      onClick={executeCSVImport}
                      className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg"
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
    </div>
  )
}
