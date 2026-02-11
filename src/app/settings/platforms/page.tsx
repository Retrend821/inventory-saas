'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Platform {
  id: string
  name: string
  color_class: string
  commission_rate: number
  sales_type: 'toB' | 'toC'
  sort_order: number
  is_active: boolean
  is_hidden: boolean
  created_at: string
  // 古物台帳用フィールド
  address: string | null
  representative_name: string | null
  occupation: string | null
  phone: string | null
  email: string | null
  website: string | null
  verification_method: string | null
  is_anonymous: boolean
}

interface Supplier {
  id: string
  name: string
  color_class: string
  sort_order: number
  is_active: boolean
  is_hidden: boolean
  created_at: string
  // 古物台帳用フィールド
  address: string | null
  representative_name: string | null
  occupation: string | null
  phone: string | null
  email: string | null
  website: string | null
  verification_method: string | null
  is_anonymous: boolean
}

// デフォルト販路の設定（色と手数料率と販売区分）
const defaultPlatformSettings: Record<string, { color: string; commission: number; salesType: 'toB' | 'toC' }> = {
  'メルカリ': { color: 'bg-red-500 text-white', commission: 10, salesType: 'toC' },
  'メルカリショップス': { color: 'bg-red-400 text-white', commission: 10, salesType: 'toC' },
  'ヤフオク': { color: 'bg-yellow-200 text-yellow-900', commission: 10, salesType: 'toC' },
  'ヤフーフリマ': { color: 'bg-yellow-100 text-yellow-800', commission: 5, salesType: 'toC' },
  'ラクマ': { color: 'bg-pink-500 text-white', commission: 0, salesType: 'toC' },
  'エコオク': { color: 'bg-green-100 text-green-800', commission: 0, salesType: 'toB' },
  'エコトレ': { color: 'bg-green-100 text-green-800', commission: 10, salesType: 'toB' },
  'オークネット': { color: 'bg-blue-100 text-blue-800', commission: 3, salesType: 'toB' },
  'スターバイヤーズ': { color: 'bg-slate-700 text-white', commission: 0, salesType: 'toB' },
  'モノバンク': { color: 'bg-lime-100 text-lime-800', commission: 5, salesType: 'toB' },
  'アプレ': { color: 'bg-amber-700 text-white', commission: 3, salesType: 'toB' },
  'タイムレス': { color: 'bg-sky-100 text-sky-800', commission: 5, salesType: 'toB' },
  'セカスト': { color: 'bg-blue-900 text-red-500 [text-shadow:_-1px_-1px_0_#fff,_1px_-1px_0_#fff,_-1px_1px_0_#fff,_1px_1px_0_#fff]', commission: 0, salesType: 'toB' },
  'トレファク': { color: 'bg-yellow-400 text-white', commission: 0, salesType: 'toB' },
  'JBA': { color: 'bg-white text-black border border-gray-300', commission: 3, salesType: 'toB' },
  'JPA': { color: 'bg-blue-900 text-white', commission: 0, salesType: 'toB' },
  '返品': { color: 'bg-gray-500 text-white', commission: 0, salesType: 'toC' },
  'shopify': { color: 'bg-green-600 text-white', commission: 0, salesType: 'toC' },
  'エレノス': { color: 'bg-purple-500 text-white', commission: 0, salesType: 'toB' },
}

// デフォルト仕入先の設定（色）
const defaultSupplierSettings: Record<string, { color: string }> = {
  'メルカリ': { color: 'bg-red-500 text-white' },
  'ヤフオク': { color: 'bg-yellow-200 text-yellow-900' },
  'ヤフーフリマ': { color: 'bg-yellow-100 text-yellow-800' },
  'ラクマ': { color: 'bg-pink-500 text-white' },
  'エコオク': { color: 'bg-green-100 text-green-800' },
  'エコトレ': { color: 'bg-green-100 text-green-800' },
  'オークネット': { color: 'bg-blue-100 text-blue-800' },
  'スターバイヤーズ': { color: 'bg-slate-700 text-white' },
  'モノバンク': { color: 'bg-lime-100 text-lime-800' },
  'アプレ': { color: 'bg-amber-700 text-white' },
  'タイムレス': { color: 'bg-sky-100 text-sky-800' },
  'セカスト': { color: 'bg-blue-900 text-red-500 [text-shadow:_-1px_-1px_0_#fff,_1px_-1px_0_#fff,_-1px_1px_0_#fff,_1px_1px_0_#fff]' },
  'トレファク': { color: 'bg-yellow-400 text-white' },
  'JBA': { color: 'bg-white text-black border border-gray-300' },
  'JPA': { color: 'bg-blue-900 text-white' },
  '古物市場': { color: 'bg-purple-500 text-white' },
  '店舗仕入': { color: 'bg-teal-500 text-white' },
  '個人取引': { color: 'bg-orange-500 text-white' },
}

// 手数料計算が分岐する販路の説明
const commissionDetails: Record<string, string> = {
  'ラクマ': '月ごとに変動\nラクマ手数料設定で管理',
  'エコオク': '固定額制\n〜1万円: 550円\n〜5万円: 1,100円\n5万円超: 2,200円',
  'オークネット': '3% + 330円\n最低1,100円',
  'スターバイヤーズ': '固定1,100円',
  'タイムレス': '1万円未満: 10%\n1万円以上: 5%',
  'JBA': '3% + 550円',
}

// カラーパレット
const bgColorOptions = [
  // 白・グレー系
  { label: '白', value: 'bg-white', color: '#ffffff' },
  { label: 'グレー(淡)', value: 'bg-gray-100', color: '#f3f4f6' },
  { label: 'グレー', value: 'bg-gray-500', color: '#6b7280' },
  { label: 'スレート', value: 'bg-slate-700', color: '#334155' },
  // 赤・ピンク系
  { label: 'ローズ', value: 'bg-rose-500', color: '#f43f5e' },
  { label: '赤', value: 'bg-red-500', color: '#ef4444' },
  { label: 'ピンク', value: 'bg-pink-500', color: '#ec4899' },
  // オレンジ・黄系
  { label: '琥珀', value: 'bg-amber-700', color: '#b45309' },
  { label: 'オレンジ', value: 'bg-orange-500', color: '#f97316' },
  { label: '黄', value: 'bg-yellow-400', color: '#facc15' },
  { label: '黄(淡)', value: 'bg-yellow-200', color: '#fef08a' },
  // 緑系
  { label: 'エメラルド', value: 'bg-emerald-500', color: '#10b981' },
  { label: '緑', value: 'bg-green-500', color: '#22c55e' },
  { label: '緑(淡)', value: 'bg-green-100', color: '#dcfce7' },
  { label: 'ライム', value: 'bg-lime-100', color: '#ecfccb' },
  // 青・水色系
  { label: 'ティール', value: 'bg-teal-500', color: '#14b8a6' },
  { label: 'シアン', value: 'bg-cyan-500', color: '#06b6d4' },
  { label: '紺', value: 'bg-blue-900', color: '#1e3a8a' },
  { label: '青', value: 'bg-blue-500', color: '#3b82f6' },
  { label: '青(淡)', value: 'bg-blue-100', color: '#dbeafe' },
  { label: '水色', value: 'bg-sky-100', color: '#e0f2fe' },
  // 紫系
  { label: 'インディゴ', value: 'bg-indigo-500', color: '#6366f1' },
  { label: '紫', value: 'bg-purple-500', color: '#a855f7' },
  { label: '紫(淡)', value: 'bg-purple-100', color: '#f3e8ff' },
]

const textColorOptions = [
  // 基本色
  { label: '白', value: 'text-white', color: '#ffffff' },
  { label: '黒', value: 'text-black', color: '#000000' },
  { label: 'グレー', value: 'text-gray-800', color: '#1f2937' },
  // カラー
  { label: '赤', value: 'text-red-500', color: '#ef4444' },
  { label: 'ピンク', value: 'text-pink-600', color: '#db2777' },
  { label: 'オレンジ', value: 'text-orange-600', color: '#ea580c' },
  { label: '黄', value: 'text-yellow-900', color: '#713f12' },
  { label: '緑', value: 'text-green-800', color: '#166534' },
  { label: 'シアン', value: 'text-cyan-600', color: '#0891b2' },
  { label: '青', value: 'text-blue-800', color: '#1e40af' },
  { label: 'インディゴ', value: 'text-indigo-600', color: '#4f46e5' },
  { label: '紫', value: 'text-purple-800', color: '#6b21a8' },
]

export default function PlatformsPage() {
  // 販路マスタ用state
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [platformsLoading, setPlatformsLoading] = useState(true)
  const [newPlatformName, setNewPlatformName] = useState('')
  const [newPlatformBgColor, setNewPlatformBgColor] = useState('bg-gray-100')
  const [newPlatformTextColor, setNewPlatformTextColor] = useState('text-gray-800')
  const [newCommissionRate, setNewCommissionRate] = useState('')
  const [newSalesType, setNewSalesType] = useState<'toB' | 'toC'>('toC')
  const [platformEditingId, setPlatformEditingId] = useState<string | null>(null)
  const [platformEditName, setPlatformEditName] = useState('')
  const [platformEditColor, setPlatformEditColor] = useState('')
  const [platformEditCommissionRate, setPlatformEditCommissionRate] = useState('')
  const [platformEditSalesType, setPlatformEditSalesType] = useState<'toB' | 'toC'>('toC')
  const [platformSelectedIds, setPlatformSelectedIds] = useState<Set<string>>(new Set())
  const [detailPopup, setDetailPopup] = useState<{ name: string; x: number; y: number } | null>(null)
  const [platformIsOpen, setPlatformIsOpen] = useState(true)
  const [platformDragIndex, setPlatformDragIndex] = useState<number | null>(null)
  const [platformDragOverIndex, setPlatformDragOverIndex] = useState<number | null>(null)
  const [showHiddenPlatforms, setShowHiddenPlatforms] = useState(false)
  // 古物台帳詳細編集用
  const [platformDetailEditingId, setPlatformDetailEditingId] = useState<string | null>(null)
  const [platformDetailForm, setPlatformDetailForm] = useState({
    address: '',
    representative_name: '',
    occupation: '',
    phone: '',
    email: '',
    website: '',
    verification_method: '',
    is_anonymous: false,
  })

  // 仕入先マスタ用state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierBgColor, setNewSupplierBgColor] = useState('bg-gray-100')
  const [newSupplierTextColor, setNewSupplierTextColor] = useState('text-gray-800')
  const [supplierEditingId, setSupplierEditingId] = useState<string | null>(null)
  const [supplierEditName, setSupplierEditName] = useState('')
  const [supplierEditColor, setSupplierEditColor] = useState('')
  const [supplierSelectedIds, setSupplierSelectedIds] = useState<Set<string>>(new Set())
  const [supplierIsOpen, setSupplierIsOpen] = useState(true)
  const [supplierDragIndex, setSupplierDragIndex] = useState<number | null>(null)
  const [supplierDragOverIndex, setSupplierDragOverIndex] = useState<number | null>(null)
  const [showHiddenSuppliers, setShowHiddenSuppliers] = useState(false)
  // 古物台帳詳細編集用
  const [supplierDetailEditingId, setSupplierDetailEditingId] = useState<string | null>(null)
  const [supplierDetailForm, setSupplierDetailForm] = useState({
    address: '',
    representative_name: '',
    occupation: '',
    phone: '',
    email: '',
    website: '',
    verification_method: '',
    is_anonymous: false,
  })

  useEffect(() => {
    fetchPlatforms()
    fetchSuppliers()
  }, [])

  // ===== 販路マスタ関数 =====
  const fetchPlatforms = async () => {
    const { data, error } = await supabase
      .from('platforms')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching platforms:', error)
    } else {
      setPlatforms(data || [])
    }
    setPlatformsLoading(false)
  }

  const addPlatform = async () => {
    if (!newPlatformName.trim()) return

    const maxOrder = platforms.length > 0 ? Math.max(...platforms.map(p => p.sort_order)) : 0
    const colorClass = `${newPlatformBgColor} ${newPlatformTextColor}`

    const { error } = await supabase
      .from('platforms')
      .insert({
        name: newPlatformName.trim(),
        color_class: colorClass,
        commission_rate: newCommissionRate ? parseFloat(newCommissionRate) : 0,
        sales_type: newSalesType,
        sort_order: maxOrder + 1,
        is_active: true
      })

    if (error) {
      console.error('Error adding platform:', error)
      alert('追加に失敗しました: ' + error.message)
    } else {
      setNewPlatformName('')
      setNewPlatformBgColor('bg-gray-100')
      setNewPlatformTextColor('text-gray-800')
      setNewCommissionRate('')
      setNewSalesType('toC')
      fetchPlatforms()
    }
  }

  const updatePlatform = async (id: string) => {
    const { error } = await supabase
      .from('platforms')
      .update({
        name: platformEditName,
        color_class: platformEditColor,
        commission_rate: platformEditCommissionRate ? parseFloat(platformEditCommissionRate) : 0,
        sales_type: platformEditSalesType
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating platform:', error)
      alert('更新に失敗しました: ' + error.message)
    } else {
      setPlatformEditingId(null)
      fetchPlatforms()
    }
  }

  const togglePlatformActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('platforms')
      .update({ is_active: !currentState })
      .eq('id', id)

    if (error) {
      console.error('Error toggling platform:', error)
    } else {
      fetchPlatforms()
    }
  }

  const togglePlatformHidden = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('platforms')
      .update({ is_hidden: !currentState })
      .eq('id', id)

    if (error) {
      console.error('Error toggling platform hidden:', error)
    } else {
      fetchPlatforms()
    }
  }

  const deletePlatformSelected = async () => {
    if (platformSelectedIds.size === 0) return
    if (!confirm(`選択した${platformSelectedIds.size}件を削除しますか？`)) return

    const { error } = await supabase
      .from('platforms')
      .delete()
      .in('id', [...platformSelectedIds])

    if (error) {
      console.error('Error deleting platforms:', error)
      alert('削除に失敗しました: ' + error.message)
    } else {
      setPlatformSelectedIds(new Set())
      fetchPlatforms()
    }
  }

  const togglePlatformSelect = (id: string) => {
    const newSelected = new Set(platformSelectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setPlatformSelectedIds(newSelected)
  }

  const togglePlatformSelectAll = () => {
    if (platformSelectedIds.size === platforms.length) {
      setPlatformSelectedIds(new Set())
    } else {
      setPlatformSelectedIds(new Set(platforms.map(p => p.id)))
    }
  }

  const handlePlatformDragStart = (index: number) => {
    setPlatformDragIndex(index)
  }

  const handlePlatformDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setPlatformDragOverIndex(index)
  }

  const handlePlatformDragEnd = async () => {
    if (platformDragIndex === null || platformDragOverIndex === null || platformDragIndex === platformDragOverIndex) {
      setPlatformDragIndex(null)
      setPlatformDragOverIndex(null)
      return
    }

    const newPlatforms = [...platforms]
    const [draggedItem] = newPlatforms.splice(platformDragIndex, 1)
    newPlatforms.splice(platformDragOverIndex, 0, draggedItem)

    // Update sort_order for all items
    const updates = newPlatforms.map((p, i) => ({
      id: p.id,
      sort_order: i + 1
    }))

    setPlatforms(newPlatforms.map((p, i) => ({ ...p, sort_order: i + 1 })))
    setPlatformDragIndex(null)
    setPlatformDragOverIndex(null)

    // Save to database
    for (const update of updates) {
      await supabase
        .from('platforms')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
    }
  }

  const openPlatformDetailEdit = (platform: Platform) => {
    setPlatformDetailEditingId(platform.id)
    setPlatformDetailForm({
      address: platform.address || '',
      representative_name: platform.representative_name || '',
      occupation: platform.occupation || '',
      phone: platform.phone || '',
      email: platform.email || '',
      website: platform.website || '',
      verification_method: platform.verification_method || '',
      is_anonymous: platform.is_anonymous || false,
    })
  }

  const savePlatformDetail = async () => {
    if (!platformDetailEditingId) return

    const { error } = await supabase
      .from('platforms')
      .update({
        address: platformDetailForm.address || null,
        representative_name: platformDetailForm.representative_name || null,
        occupation: platformDetailForm.occupation || null,
        phone: platformDetailForm.phone || null,
        email: platformDetailForm.email || null,
        website: platformDetailForm.website || null,
        verification_method: platformDetailForm.verification_method || null,
        is_anonymous: platformDetailForm.is_anonymous,
      })
      .eq('id', platformDetailEditingId)

    if (error) {
      console.error('Error updating platform detail:', error)
      alert('更新に失敗しました: ' + error.message)
    } else {
      setPlatformDetailEditingId(null)
      fetchPlatforms()
    }
  }

  const initializePlatformDefaults = async () => {
    if (!confirm('デフォルトの販路を追加しますか？（既存のデータは保持されます）')) return

    const existingNames = platforms.map(p => p.name)
    const defaultPlatforms = Object.entries(defaultPlatformSettings)
      .filter(([name]) => !existingNames.includes(name))
      .map(([name, settings], index) => ({
        name,
        color_class: settings.color,
        commission_rate: settings.commission,
        sales_type: settings.salesType,
        sort_order: platforms.length + index + 1,
        is_active: true
      }))

    if (defaultPlatforms.length === 0) {
      alert('追加するデフォルト販路はありません')
      return
    }

    const { error } = await supabase
      .from('platforms')
      .insert(defaultPlatforms)

    if (error) {
      console.error('Error initializing defaults:', error)
      alert('初期化に失敗しました: ' + error.message)
    } else {
      fetchPlatforms()
    }
  }

  // ===== 仕入先マスタ関数 =====
  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching suppliers:', error)
    } else {
      setSuppliers(data || [])
    }
    setSuppliersLoading(false)
  }

  const addSupplier = async () => {
    if (!newSupplierName.trim()) return

    const maxOrder = suppliers.length > 0 ? Math.max(...suppliers.map(s => s.sort_order)) : 0
    const colorClass = `${newSupplierBgColor} ${newSupplierTextColor}`

    const { error } = await supabase
      .from('suppliers')
      .insert({
        name: newSupplierName.trim(),
        color_class: colorClass,
        sort_order: maxOrder + 1,
        is_active: true
      })

    if (error) {
      console.error('Error adding supplier:', error)
      alert('追加に失敗しました: ' + error.message)
    } else {
      setNewSupplierName('')
      setNewSupplierBgColor('bg-gray-100')
      setNewSupplierTextColor('text-gray-800')
      fetchSuppliers()
    }
  }

  const updateSupplier = async (id: string) => {
    const { error } = await supabase
      .from('suppliers')
      .update({
        name: supplierEditName,
        color_class: supplierEditColor
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating supplier:', error)
      alert('更新に失敗しました: ' + error.message)
    } else {
      setSupplierEditingId(null)
      fetchSuppliers()
    }
  }

  const toggleSupplierActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: !currentState })
      .eq('id', id)

    if (error) {
      console.error('Error toggling supplier:', error)
    } else {
      fetchSuppliers()
    }
  }

  const toggleSupplierHidden = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_hidden: !currentState })
      .eq('id', id)

    if (error) {
      console.error('Error toggling supplier hidden:', error)
    } else {
      fetchSuppliers()
    }
  }

  const deleteSupplierSelected = async () => {
    if (supplierSelectedIds.size === 0) return
    if (!confirm(`選択した${supplierSelectedIds.size}件を削除しますか？`)) return

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .in('id', [...supplierSelectedIds])

    if (error) {
      console.error('Error deleting suppliers:', error)
      alert('削除に失敗しました: ' + error.message)
    } else {
      setSupplierSelectedIds(new Set())
      fetchSuppliers()
    }
  }

  const toggleSupplierSelect = (id: string) => {
    const newSelected = new Set(supplierSelectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSupplierSelectedIds(newSelected)
  }

  const toggleSupplierSelectAll = () => {
    if (supplierSelectedIds.size === suppliers.length) {
      setSupplierSelectedIds(new Set())
    } else {
      setSupplierSelectedIds(new Set(suppliers.map(s => s.id)))
    }
  }

  const handleSupplierDragStart = (index: number) => {
    setSupplierDragIndex(index)
  }

  const handleSupplierDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setSupplierDragOverIndex(index)
  }

  const handleSupplierDragEnd = async () => {
    if (supplierDragIndex === null || supplierDragOverIndex === null || supplierDragIndex === supplierDragOverIndex) {
      setSupplierDragIndex(null)
      setSupplierDragOverIndex(null)
      return
    }

    const newSuppliers = [...suppliers]
    const [draggedItem] = newSuppliers.splice(supplierDragIndex, 1)
    newSuppliers.splice(supplierDragOverIndex, 0, draggedItem)

    // Update sort_order for all items
    const updates = newSuppliers.map((s, i) => ({
      id: s.id,
      sort_order: i + 1
    }))

    setSuppliers(newSuppliers.map((s, i) => ({ ...s, sort_order: i + 1 })))
    setSupplierDragIndex(null)
    setSupplierDragOverIndex(null)

    // Save to database
    for (const update of updates) {
      await supabase
        .from('suppliers')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
    }
  }

  const openSupplierDetailEdit = (supplier: Supplier) => {
    setSupplierDetailEditingId(supplier.id)
    setSupplierDetailForm({
      address: supplier.address || '',
      representative_name: supplier.representative_name || '',
      occupation: supplier.occupation || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      website: supplier.website || '',
      verification_method: supplier.verification_method || '',
      is_anonymous: supplier.is_anonymous || false,
    })
  }

  const saveSupplierDetail = async () => {
    if (!supplierDetailEditingId) return

    const { error } = await supabase
      .from('suppliers')
      .update({
        address: supplierDetailForm.address || null,
        representative_name: supplierDetailForm.representative_name || null,
        occupation: supplierDetailForm.occupation || null,
        phone: supplierDetailForm.phone || null,
        email: supplierDetailForm.email || null,
        website: supplierDetailForm.website || null,
        verification_method: supplierDetailForm.verification_method || null,
        is_anonymous: supplierDetailForm.is_anonymous,
      })
      .eq('id', supplierDetailEditingId)

    if (error) {
      console.error('Error updating supplier detail:', error)
      alert('更新に失敗しました: ' + error.message)
    } else {
      setSupplierDetailEditingId(null)
      fetchSuppliers()
    }
  }

  const initializeSupplierDefaults = async () => {
    if (!confirm('デフォルトの仕入先を追加しますか？（既存のデータは保持されます）')) return

    const existingNames = suppliers.map(s => s.name)
    const defaultSuppliers = Object.entries(defaultSupplierSettings)
      .filter(([name]) => !existingNames.includes(name))
      .map(([name, settings], index) => ({
        name,
        color_class: settings.color,
        sort_order: suppliers.length + index + 1,
        is_active: true
      }))

    if (defaultSuppliers.length === 0) {
      alert('追加するデフォルト仕入先はありません')
      return
    }

    const { error } = await supabase
      .from('suppliers')
      .insert(defaultSuppliers)

    if (error) {
      console.error('Error initializing defaults:', error)
      alert('初期化に失敗しました: ' + error.message)
    } else {
      fetchSuppliers()
    }
  }

  if (platformsLoading || suppliersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 md:p-8">
      <div className="max-w-full mx-auto space-y-4 sm:space-y-6">
        {/* ===== 販路マスタ ===== */}
        <div>
          {/* アコーディオンヘッダー */}
          <button
            onClick={() => setPlatformIsOpen(!platformIsOpen)}
            className="w-full flex items-center justify-between bg-slate-800 rounded-lg shadow px-4 sm:px-6 py-3 sm:py-4 mb-3 sm:mb-4 hover:bg-slate-700 transition-colors touch-target"
          >
            <h1 className="text-lg sm:text-xl font-bold text-white">販路マスタ設定</h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-slate-300">{platforms.length}件</span>
              <svg
                className={`w-5 h-5 sm:w-6 sm:h-6 text-white transition-transform ${platformIsOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* アコーディオン本体 */}
          {platformIsOpen && (
            <>
              {/* 新規追加フォーム */}
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">新規追加</h2>
                <div className="flex gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">販路名</label>
                    <input
                      type="text"
                      value={newPlatformName}
                      onChange={(e) => setNewPlatformName(e.target.value)}
                      className="w-80 border border-gray-300 rounded px-3 py-2 text-gray-900"
                      placeholder="例: メルカリ"
                    />
                    <div className="flex gap-3 mt-2 w-80">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">手数料(%)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={newCommissionRate}
                          onChange={(e) => setNewCommissionRate(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">販売区分</label>
                        <select
                          value={newSalesType}
                          onChange={(e) => setNewSalesType(e.target.value as 'toB' | 'toC')}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm"
                        >
                          <option value="toC">toC</option>
                          <option value="toB">toB</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">背景色</label>
                    <div className="flex flex-wrap gap-1 p-2 border border-gray-300 rounded bg-white max-w-[200px]">
                      {bgColorOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewPlatformBgColor(opt.value)}
                          className={`w-6 h-6 rounded border-2 ${newPlatformBgColor === opt.value ? 'border-blue-500' : 'border-gray-300'}`}
                          style={{ backgroundColor: opt.color }}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">文字色</label>
                    <div className="flex flex-wrap gap-1 p-2 border border-gray-300 rounded bg-white max-w-[120px]">
                      {textColorOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewPlatformTextColor(opt.value)}
                          className={`w-6 h-6 rounded border-2 ${newPlatformTextColor === opt.value ? 'border-blue-500' : 'border-gray-300'}`}
                          style={{ backgroundColor: opt.color }}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">プレビュー</label>
                    <span className={`inline-block px-3 py-2 rounded-full text-sm font-bold ${newPlatformBgColor} ${newPlatformTextColor}`}>
                      {newPlatformName || '例：メルカリ'}
                    </span>
                    <div className="mt-2">
                      <button
                        onClick={addPlatform}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ボタン */}
              <div className="mb-6 flex gap-4 items-center">
                <button
                  onClick={initializePlatformDefaults}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  デフォルト販路を追加
                </button>
                <button
                  onClick={deletePlatformSelected}
                  disabled={platformSelectedIds.size === 0}
                  className={`px-4 py-2 rounded bg-red-600 text-white ${
                    platformSelectedIds.size > 0
                      ? 'hover:bg-red-700'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  {platformSelectedIds.size > 0 ? `選択した${platformSelectedIds.size}件を削除` : '削除'}
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={showHiddenPlatforms}
                    onChange={(e) => setShowHiddenPlatforms(e.target.checked)}
                    className="w-4 h-4"
                  />
                  非表示の販路も表示
                </label>
              </div>

              {/* 販路一覧 */}
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-slate-600">
                      <th className="text-center px-2 py-3 text-sm font-semibold text-white w-10"></th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white w-10">
                        <input
                          type="checkbox"
                          checked={platforms.length > 0 && platformSelectedIds.size === platforms.filter(p => showHiddenPlatforms || !p.is_hidden).length}
                          onChange={togglePlatformSelectAll}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">販路名</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">プレビュー</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">手数料</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">販売区分</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">有効</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">非表示</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">編集</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">台帳情報</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platforms.filter(p => showHiddenPlatforms || !p.is_hidden).map((platform) => {
                      const origIndex = platforms.findIndex(p => p.id === platform.id)
                      return (
                      <tr
                        key={platform.id}
                        draggable
                        onDragStart={() => handlePlatformDragStart(origIndex)}
                        onDragOver={(e) => handlePlatformDragOver(e, origIndex)}
                        onDragEnd={handlePlatformDragEnd}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          platformDragIndex === origIndex ? 'opacity-50 bg-blue-100' : ''
                        } ${platformDragOverIndex === origIndex && platformDragIndex !== origIndex ? 'border-t-2 border-t-blue-500' : ''} ${platform.is_hidden ? 'opacity-50' : ''}`}
                      >
                        <td className="px-2 py-3 text-center cursor-grab active:cursor-grabbing">
                          <svg className="w-5 h-5 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={platformSelectedIds.has(platform.id)}
                            onChange={() => togglePlatformSelect(platform.id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {platformEditingId === platform.id ? (
                            <input
                              type="text"
                              value={platformEditName}
                              onChange={(e) => setPlatformEditName(e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900"
                            />
                          ) : (
                            <span className="text-gray-900">{platform.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block w-32 text-center px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ${platformEditingId === platform.id ? platformEditColor : platform.color_class}`}>
                            {platformEditingId === platform.id ? platformEditName : platform.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {platformEditingId === platform.id ? (
                            <input
                              type="number"
                              step="0.1"
                              value={platformEditCommissionRate}
                              onChange={(e) => setPlatformEditCommissionRate(e.target.value)}
                              className="w-16 border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm text-center"
                            />
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {commissionDetails[platform.name] ? (
                                <span
                                  className="text-sm text-orange-600 font-medium cursor-pointer hover:text-orange-700"
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setDetailPopup({
                                      name: platform.name,
                                      x: rect.left + rect.width / 2,
                                      y: rect.bottom + 4
                                    })
                                  }}
                                >
                                  変動
                                </span>
                              ) : (
                                <span className="text-sm text-gray-900">{platform.commission_rate}%</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {platformEditingId === platform.id ? (
                            <select
                              value={platformEditSalesType}
                              onChange={(e) => setPlatformEditSalesType(e.target.value as 'toB' | 'toC')}
                              className="border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm"
                            >
                              <option value="toC">toC</option>
                              <option value="toB">toB</option>
                            </select>
                          ) : (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              platform.sales_type === 'toB'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {platform.sales_type || 'toC'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => togglePlatformActive(platform.id, platform.is_active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              platform.is_active
                                ? 'bg-green-500'
                                : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                platform.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => togglePlatformHidden(platform.id, platform.is_hidden)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              platform.is_hidden
                                ? 'bg-gray-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {platform.is_hidden ? '非表示中' : '非表示'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {platformEditingId === platform.id ? (
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => updatePlatform(platform.id)}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 whitespace-nowrap"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setPlatformEditingId(null)}
                                className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500 whitespace-nowrap"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setPlatformEditingId(platform.id)
                                setPlatformEditName(platform.name)
                                setPlatformEditColor(platform.color_class)
                                setPlatformEditCommissionRate(String(platform.commission_rate || 0))
                                setPlatformEditSalesType(platform.sales_type || 'toC')
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                            >
                              編集
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => openPlatformDetailEdit(platform)}
                            className={`px-2 py-1 rounded text-xs ${
                              platform.representative_name || platform.address
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {platform.representative_name || platform.address ? '編集' : '未設定'}
                          </button>
                        </td>
                      </tr>
                    )})}
                    {platforms.filter(p => showHiddenPlatforms || !p.is_hidden).length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                          販路が登録されていません。「デフォルト販路を追加」ボタンで初期データを追加できます。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ===== 仕入先マスタ ===== */}
        <div>
          {/* アコーディオンヘッダー */}
          <button
            onClick={() => setSupplierIsOpen(!supplierIsOpen)}
            className="w-full flex items-center justify-between bg-slate-800 rounded-lg shadow px-6 py-4 mb-4 hover:bg-slate-700 transition-colors"
          >
            <h1 className="text-xl font-bold text-white">仕入先マスタ設定</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-300">{suppliers.length}件</span>
              <svg
                className={`w-6 h-6 text-white transition-transform ${supplierIsOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* アコーディオン本体 */}
          {supplierIsOpen && (
            <>
              {/* 新規追加フォーム */}
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">新規追加</h2>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">仕入先名</label>
                    <input
                      type="text"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                      placeholder="例: メルカリ"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">背景色</label>
                    <div className="flex flex-wrap gap-1 p-2 border border-gray-300 rounded bg-white max-w-[200px]">
                      {bgColorOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewSupplierBgColor(opt.value)}
                          className={`w-6 h-6 rounded border-2 ${newSupplierBgColor === opt.value ? 'border-blue-500' : 'border-gray-300'}`}
                          style={{ backgroundColor: opt.color }}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">文字色</label>
                    <div className="flex flex-wrap gap-1 p-2 border border-gray-300 rounded bg-white max-w-[120px]">
                      {textColorOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewSupplierTextColor(opt.value)}
                          className={`w-6 h-6 rounded border-2 ${newSupplierTextColor === opt.value ? 'border-blue-500' : 'border-gray-300'}`}
                          style={{ backgroundColor: opt.color }}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">プレビュー</label>
                    <span className={`inline-block px-3 py-2 rounded-full text-sm font-bold ${newSupplierBgColor} ${newSupplierTextColor}`}>
                      {newSupplierName || 'プレビュー'}
                    </span>
                  </div>
                  <button
                    onClick={addSupplier}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* ボタン */}
              <div className="mb-6 flex gap-4 items-center">
                <button
                  onClick={initializeSupplierDefaults}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  デフォルト仕入先を追加
                </button>
                <button
                  onClick={deleteSupplierSelected}
                  disabled={supplierSelectedIds.size === 0}
                  className={`px-4 py-2 rounded bg-red-600 text-white ${
                    supplierSelectedIds.size > 0
                      ? 'hover:bg-red-700'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  {supplierSelectedIds.size > 0 ? `選択した${supplierSelectedIds.size}件を削除` : '削除'}
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={showHiddenSuppliers}
                    onChange={(e) => setShowHiddenSuppliers(e.target.checked)}
                    className="w-4 h-4"
                  />
                  非表示の仕入先も表示
                </label>
              </div>

              {/* 仕入先一覧 */}
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-slate-600">
                      <th className="text-center px-2 py-3 text-sm font-semibold text-white w-10"></th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white w-10">
                        <input
                          type="checkbox"
                          checked={suppliers.length > 0 && supplierSelectedIds.size === suppliers.filter(s => showHiddenSuppliers || !s.is_hidden).length}
                          onChange={toggleSupplierSelectAll}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">仕入先名</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">プレビュー</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">有効</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">非表示</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">編集</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">台帳情報</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.filter(s => showHiddenSuppliers || !s.is_hidden).map((supplier) => {
                      const origIndex = suppliers.findIndex(s => s.id === supplier.id)
                      return (
                      <tr
                        key={supplier.id}
                        draggable
                        onDragStart={() => handleSupplierDragStart(origIndex)}
                        onDragOver={(e) => handleSupplierDragOver(e, origIndex)}
                        onDragEnd={handleSupplierDragEnd}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          supplierDragIndex === origIndex ? 'opacity-50 bg-blue-100' : ''
                        } ${supplierDragOverIndex === origIndex && supplierDragIndex !== origIndex ? 'border-t-2 border-t-blue-500' : ''} ${supplier.is_hidden ? 'opacity-50' : ''}`}
                      >
                        <td className="px-2 py-3 text-center cursor-grab active:cursor-grabbing">
                          <svg className="w-5 h-5 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={supplierSelectedIds.has(supplier.id)}
                            onChange={() => toggleSupplierSelect(supplier.id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {supplierEditingId === supplier.id ? (
                            <input
                              type="text"
                              value={supplierEditName}
                              onChange={(e) => setSupplierEditName(e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900"
                            />
                          ) : (
                            <span className="text-gray-900">{supplier.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block w-32 text-center px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ${supplierEditingId === supplier.id ? supplierEditColor : supplier.color_class}`}>
                            {supplierEditingId === supplier.id ? supplierEditName : supplier.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleSupplierActive(supplier.id, supplier.is_active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              supplier.is_active
                                ? 'bg-green-500'
                                : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                supplier.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleSupplierHidden(supplier.id, supplier.is_hidden)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              supplier.is_hidden
                                ? 'bg-gray-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {supplier.is_hidden ? '非表示中' : '非表示'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {supplierEditingId === supplier.id ? (
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => updateSupplier(supplier.id)}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 whitespace-nowrap"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setSupplierEditingId(null)}
                                className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500 whitespace-nowrap"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSupplierEditingId(supplier.id)
                                setSupplierEditName(supplier.name)
                                setSupplierEditColor(supplier.color_class)
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                            >
                              編集
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => openSupplierDetailEdit(supplier)}
                            className={`px-2 py-1 rounded text-xs ${
                              supplier.representative_name || supplier.address
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {supplier.representative_name || supplier.address ? '編集' : '未設定'}
                          </button>
                        </td>
                      </tr>
                    )})}
                    {suppliers.filter(s => showHiddenSuppliers || !s.is_hidden).length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          仕入先が登録されていません。「デフォルト仕入先を追加」ボタンで初期データを追加できます。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 詳細ポップアップ */}
      {detailPopup && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setDetailPopup(null)}
          />
          <div
            className="fixed z-[101] bg-gray-800 text-white text-xs rounded-lg shadow-lg px-3 py-2 whitespace-pre-line"
            style={{
              left: detailPopup.x,
              top: detailPopup.y,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-semibold mb-1 text-yellow-300">{detailPopup.name}</div>
            {commissionDetails[detailPopup.name]}
          </div>
        </>
      )}

      {/* 販路 古物台帳詳細編集モーダル */}
      {platformDetailEditingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              古物台帳情報 - {platforms.find(p => p.id === platformDetailEditingId)?.name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">代表者氏名</label>
                <input
                  type="text"
                  value={platformDetailForm.representative_name}
                  onChange={(e) => setPlatformDetailForm({ ...platformDetailForm, representative_name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  placeholder="例: 山田太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                <input
                  type="text"
                  value={platformDetailForm.address}
                  onChange={(e) => setPlatformDetailForm({ ...platformDetailForm, address: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  placeholder="例: 東京都渋谷区..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">職業</label>
                <input
                  type="text"
                  value={platformDetailForm.occupation}
                  onChange={(e) => setPlatformDetailForm({ ...platformDetailForm, occupation: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  placeholder="例: 会社員"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                  <input
                    type="text"
                    value={platformDetailForm.phone}
                    onChange={(e) => setPlatformDetailForm({ ...platformDetailForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                    placeholder="例: 03-1234-5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={platformDetailForm.email}
                    onChange={(e) => setPlatformDetailForm({ ...platformDetailForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                    placeholder="例: info@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ホームページ</label>
                <input
                  type="url"
                  value={platformDetailForm.website}
                  onChange={(e) => setPlatformDetailForm({ ...platformDetailForm, website: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  placeholder="例: https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">本人確認方法</label>
                <select
                  value={platformDetailForm.verification_method}
                  onChange={(e) => setPlatformDetailForm({ ...platformDetailForm, verification_method: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                >
                  <option value="">選択してください</option>
                  <option value="運転免許証">運転免許証</option>
                  <option value="マイナンバーカード">マイナンバーカード</option>
                  <option value="パスポート">パスポート</option>
                  <option value="健康保険証">健康保険証</option>
                  <option value="住民票">住民票</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="platform_is_anonymous"
                  checked={platformDetailForm.is_anonymous}
                  onChange={(e) => setPlatformDetailForm({ ...platformDetailForm, is_anonymous: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="platform_is_anonymous" className="text-sm text-gray-700">
                  匿名取引（本人確認不要）
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPlatformDetailEditingId(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
              <button
                onClick={savePlatformDetail}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 仕入先 古物台帳詳細編集モーダル */}
      {supplierDetailEditingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              古物台帳情報 - {suppliers.find(s => s.id === supplierDetailEditingId)?.name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">代表者氏名</label>
                <input
                  type="text"
                  value={supplierDetailForm.representative_name}
                  onChange={(e) => setSupplierDetailForm({ ...supplierDetailForm, representative_name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  placeholder="例: 山田太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                <input
                  type="text"
                  value={supplierDetailForm.address}
                  onChange={(e) => setSupplierDetailForm({ ...supplierDetailForm, address: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  placeholder="例: 東京都渋谷区..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">職業</label>
                <input
                  type="text"
                  value={supplierDetailForm.occupation}
                  onChange={(e) => setSupplierDetailForm({ ...supplierDetailForm, occupation: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  placeholder="例: 会社員"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                  <input
                    type="text"
                    value={supplierDetailForm.phone}
                    onChange={(e) => setSupplierDetailForm({ ...supplierDetailForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                    placeholder="例: 03-1234-5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={supplierDetailForm.email}
                    onChange={(e) => setSupplierDetailForm({ ...supplierDetailForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                    placeholder="例: info@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ホームページ</label>
                <input
                  type="url"
                  value={supplierDetailForm.website}
                  onChange={(e) => setSupplierDetailForm({ ...supplierDetailForm, website: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                  placeholder="例: https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">本人確認方法</label>
                <select
                  value={supplierDetailForm.verification_method}
                  onChange={(e) => setSupplierDetailForm({ ...supplierDetailForm, verification_method: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
                >
                  <option value="">選択してください</option>
                  <option value="運転免許証">運転免許証</option>
                  <option value="マイナンバーカード">マイナンバーカード</option>
                  <option value="パスポート">パスポート</option>
                  <option value="健康保険証">健康保険証</option>
                  <option value="住民票">住民票</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="supplier_is_anonymous"
                  checked={supplierDetailForm.is_anonymous}
                  onChange={(e) => setSupplierDetailForm({ ...supplierDetailForm, is_anonymous: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="supplier_is_anonymous" className="text-sm text-gray-700">
                  匿名取引（本人確認不要）
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSupplierDetailEditingId(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
              <button
                onClick={saveSupplierDetail}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
