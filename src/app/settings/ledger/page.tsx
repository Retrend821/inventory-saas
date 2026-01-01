'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Platform {
  id: string
  name: string
  color_class: string
  address: string | null
  representative_name: string | null
  occupation: string | null
  phone: string | null
  email: string | null
  website: string | null
  verification_method: string | null
  is_anonymous: boolean
  is_hidden: boolean
  sort_order: number
}

interface Supplier {
  id: string
  name: string
  color_class: string
  address: string | null
  representative_name: string | null
  occupation: string | null
  phone: string | null
  email: string | null
  website: string | null
  verification_method: string | null
  is_anonymous: boolean
  is_hidden: boolean
  sort_order: number
}

// 背景色オプション（基本色を先に配置）
const bgColorOptions = [
  // 基本色
  { label: '青', value: 'bg-blue-500', color: '#3b82f6' },
  { label: '赤', value: 'bg-red-500', color: '#ef4444' },
  { label: '緑', value: 'bg-green-500', color: '#22c55e' },
  { label: '黄', value: 'bg-yellow-400', color: '#facc15' },
  { label: 'オレンジ', value: 'bg-orange-500', color: '#f97316' },
  { label: '紫', value: 'bg-purple-500', color: '#a855f7' },
  { label: 'ピンク', value: 'bg-pink-500', color: '#ec4899' },
  { label: '紺', value: 'bg-blue-900', color: '#1e3a8a' },
  // 淡い色
  { label: '青(淡)', value: 'bg-blue-100', color: '#dbeafe' },
  { label: '赤(淡)', value: 'bg-red-100', color: '#fee2e2' },
  { label: '緑(淡)', value: 'bg-green-100', color: '#dcfce7' },
  { label: '黄(淡)', value: 'bg-yellow-100', color: '#fef9c3' },
  // モノトーン
  { label: '白', value: 'bg-white', color: '#ffffff' },
  { label: 'グレー(淡)', value: 'bg-gray-100', color: '#f3f4f6' },
  { label: 'グレー', value: 'bg-gray-500', color: '#6b7280' },
  { label: '黒', value: 'bg-gray-900', color: '#111827' },
]

const textColorOptions = [
  { label: '白', value: 'text-white', color: '#ffffff' },
  { label: '黒', value: 'text-black', color: '#000000' },
  { label: 'グレー', value: 'text-gray-800', color: '#1f2937' },
]

export default function LedgerSettingsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  // 仕入先用state
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierSelectedIds, setSupplierSelectedIds] = useState<Set<string>>(new Set())
  const [showHiddenSuppliers, setShowHiddenSuppliers] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierBgColor, setNewSupplierBgColor] = useState('bg-blue-500')
  const [newSupplierTextColor, setNewSupplierTextColor] = useState('text-white')
  const [showAddSupplierForm, setShowAddSupplierForm] = useState(false)

  // 販路用state
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [platformSelectedIds, setPlatformSelectedIds] = useState<Set<string>>(new Set())
  const [showHiddenPlatforms, setShowHiddenPlatforms] = useState(false)
  const [newPlatformName, setNewPlatformName] = useState('')
  const [newPlatformBgColor, setNewPlatformBgColor] = useState('bg-blue-500')
  const [newPlatformTextColor, setNewPlatformTextColor] = useState('text-white')
  const [showAddPlatformForm, setShowAddPlatformForm] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [platformsRes, suppliersRes] = await Promise.all([
      supabase.from('platforms').select('*').order('sort_order', { ascending: true }),
      supabase.from('suppliers').select('*').order('sort_order', { ascending: true }),
    ])

    if (!platformsRes.error) setPlatforms(platformsRes.data || [])
    if (!suppliersRes.error) setSuppliers(suppliersRes.data || [])
    setLoading(false)
  }

  // ===== 仕入先関数 =====
  const addSupplier = async () => {
    if (!newSupplierName.trim()) return

    const maxOrder = suppliers.length > 0 ? Math.max(...suppliers.map(s => s.sort_order || 0)) : 0
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
      alert('追加に失敗しました: ' + error.message)
    } else {
      setNewSupplierName('')
      setNewSupplierBgColor('bg-blue-500')
      setNewSupplierTextColor('text-white')
      setShowAddSupplierForm(false)
      fetchData()
    }
  }

  const saveSupplier = async () => {
    if (!editingSupplier) return

    const { error } = await supabase
      .from('suppliers')
      .update({
        address: editingSupplier.address || null,
        representative_name: editingSupplier.representative_name || null,
        occupation: editingSupplier.occupation || null,
        phone: editingSupplier.phone || null,
        email: editingSupplier.email || null,
        website: editingSupplier.website || null,
        verification_method: editingSupplier.verification_method || null,
        is_anonymous: editingSupplier.is_anonymous,
      })
      .eq('id', editingSupplier.id)

    if (error) {
      alert('保存に失敗しました: ' + error.message)
    } else {
      setEditingSupplier(null)
      fetchData()
    }
  }

  const toggleSupplierHidden = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_hidden: !currentState })
      .eq('id', id)

    if (!error) fetchData()
  }

  const deleteSupplierSelected = async () => {
    if (supplierSelectedIds.size === 0) return
    if (!confirm(`選択した${supplierSelectedIds.size}件を削除しますか？`)) return

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .in('id', [...supplierSelectedIds])

    if (error) {
      alert('削除に失敗しました: ' + error.message)
    } else {
      setSupplierSelectedIds(new Set())
      fetchData()
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
    const visibleSuppliers = suppliers.filter(s => showHiddenSuppliers || !s.is_hidden)
    if (supplierSelectedIds.size === visibleSuppliers.length) {
      setSupplierSelectedIds(new Set())
    } else {
      setSupplierSelectedIds(new Set(visibleSuppliers.map(s => s.id)))
    }
  }

  // ===== 販路関数 =====
  const addPlatform = async () => {
    if (!newPlatformName.trim()) return

    const maxOrder = platforms.length > 0 ? Math.max(...platforms.map(p => p.sort_order || 0)) : 0
    const colorClass = `${newPlatformBgColor} ${newPlatformTextColor}`

    const { error } = await supabase
      .from('platforms')
      .insert({
        name: newPlatformName.trim(),
        color_class: colorClass,
        sort_order: maxOrder + 1,
        is_active: true
      })

    if (error) {
      alert('追加に失敗しました: ' + error.message)
    } else {
      setNewPlatformName('')
      setNewPlatformBgColor('bg-blue-500')
      setNewPlatformTextColor('text-white')
      setShowAddPlatformForm(false)
      fetchData()
    }
  }

  const savePlatform = async () => {
    if (!editingPlatform) return

    const { error } = await supabase
      .from('platforms')
      .update({
        address: editingPlatform.address || null,
        representative_name: editingPlatform.representative_name || null,
        occupation: editingPlatform.occupation || null,
        phone: editingPlatform.phone || null,
        email: editingPlatform.email || null,
        website: editingPlatform.website || null,
        verification_method: editingPlatform.verification_method || null,
        is_anonymous: editingPlatform.is_anonymous,
      })
      .eq('id', editingPlatform.id)

    if (error) {
      alert('保存に失敗しました: ' + error.message)
    } else {
      setEditingPlatform(null)
      fetchData()
    }
  }

  const togglePlatformHidden = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('platforms')
      .update({ is_hidden: !currentState })
      .eq('id', id)

    if (!error) fetchData()
  }

  const deletePlatformSelected = async () => {
    if (platformSelectedIds.size === 0) return
    if (!confirm(`選択した${platformSelectedIds.size}件を削除しますか？`)) return

    const { error } = await supabase
      .from('platforms')
      .delete()
      .in('id', [...platformSelectedIds])

    if (error) {
      alert('削除に失敗しました: ' + error.message)
    } else {
      setPlatformSelectedIds(new Set())
      fetchData()
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
    const visiblePlatforms = platforms.filter(p => showHiddenPlatforms || !p.is_hidden)
    if (platformSelectedIds.size === visiblePlatforms.length) {
      setPlatformSelectedIds(new Set())
    } else {
      setPlatformSelectedIds(new Set(visiblePlatforms.map(p => p.id)))
    }
  }

  const hasLedgerInfo = (item: Platform | Supplier) => {
    return !!(item.address || item.representative_name || item.phone || item.email)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-black">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-full mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-black">古物台帳マスタ設定</h1>
        <p className="text-sm text-black">
          仕入先・販路ごとの取引相手方情報を設定します。ここで設定した情報は古物台帳に自動的に反映されます。
        </p>

        {/* 仕入先（受入時の相手方） */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-black mb-4 border-b pb-2">仕入先（受入時の取引相手方）</h2>

          {/* ボタン類 */}
          <div className="mb-4 flex gap-4 items-center flex-wrap">
            <button
              onClick={() => setShowAddSupplierForm(!showAddSupplierForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              {showAddSupplierForm ? '閉じる' : '新規追加'}
            </button>
            <button
              onClick={deleteSupplierSelected}
              disabled={supplierSelectedIds.size === 0}
              className={`px-4 py-2 rounded text-sm ${
                supplierSelectedIds.size > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
              非表示も表示
            </label>
          </div>

          {/* 新規追加フォーム */}
          {showAddSupplierForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">仕入先名</label>
                  <input
                    type="text"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-48 border border-gray-300 rounded px-3 py-2 text-black"
                    placeholder="例: 新規仕入先"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">背景色</label>
                  <div className="grid grid-cols-8 gap-1 w-fit">
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
                  <label className="block text-sm font-medium text-black mb-1">文字色</label>
                  <div className="flex gap-1">
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
                  <label className="block text-sm font-medium text-black mb-1">プレビュー</label>
                  <span className={`inline-block w-28 text-center px-2 py-1 rounded text-xs font-bold ${newSupplierBgColor} ${newSupplierTextColor}`}>
                    {newSupplierName || '新規仕入先'}
                  </span>
                </div>
                <button
                  onClick={addSupplier}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  追加
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="px-3 py-2 text-center font-bold text-black w-10">
                    <input
                      type="checkbox"
                      checked={suppliers.filter(s => showHiddenSuppliers || !s.is_hidden).length > 0 &&
                               supplierSelectedIds.size === suppliers.filter(s => showHiddenSuppliers || !s.is_hidden).length}
                      onChange={toggleSupplierSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-black">仕入先名</th>
                  <th className="px-3 py-2 text-left font-bold text-black">代表者氏名</th>
                  <th className="px-3 py-2 text-left font-bold text-black">住所</th>
                  <th className="px-3 py-2 text-left font-bold text-black">電話番号</th>
                  <th className="px-3 py-2 text-left font-bold text-black">メールアドレス</th>
                  <th className="px-3 py-2 text-left font-bold text-black">確認方法</th>
                  <th className="px-3 py-2 text-center font-bold text-black">状態</th>
                  <th className="px-3 py-2 text-center font-bold text-black">非表示</th>
                  <th className="px-3 py-2 text-center font-bold text-black">操作</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.filter(s => showHiddenSuppliers || !s.is_hidden).map((supplier) => (
                  <tr key={supplier.id} className={`border-b hover:bg-gray-50 ${supplier.is_hidden ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={supplierSelectedIds.has(supplier.id)}
                        onChange={() => toggleSupplierSelect(supplier.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block w-28 text-center px-2 py-1 rounded text-xs font-bold ${supplier.color_class}`}>
                        {supplier.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-black">{supplier.representative_name || '-'}</td>
                    <td className="px-3 py-2 text-black max-w-[200px] truncate" title={supplier.address || ''}>
                      {supplier.address || '-'}
                    </td>
                    <td className="px-3 py-2 text-black">{supplier.phone || '-'}</td>
                    <td className="px-3 py-2 text-black max-w-[180px] truncate" title={supplier.email || ''}>{supplier.email || '-'}</td>
                    <td className="px-3 py-2 text-black">{supplier.verification_method || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      {hasLedgerInfo(supplier) ? (
                        <span className="inline-block w-14 text-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">設定済</span>
                      ) : (
                        <span className="inline-block w-14 text-center px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">未設定</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
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
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => setEditingSupplier(supplier)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))}
                {suppliers.filter(s => showHiddenSuppliers || !s.is_hidden).length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-black">
                      仕入先が登録されていません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 販路（払出時の相手方） */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-black mb-4 border-b pb-2">販路（払出時の取引相手方）</h2>

          {/* ボタン類 */}
          <div className="mb-4 flex gap-4 items-center flex-wrap">
            <button
              onClick={() => setShowAddPlatformForm(!showAddPlatformForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              {showAddPlatformForm ? '閉じる' : '新規追加'}
            </button>
            <button
              onClick={deletePlatformSelected}
              disabled={platformSelectedIds.size === 0}
              className={`px-4 py-2 rounded text-sm ${
                platformSelectedIds.size > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
              非表示も表示
            </label>
          </div>

          {/* 新規追加フォーム */}
          {showAddPlatformForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">販路名</label>
                  <input
                    type="text"
                    value={newPlatformName}
                    onChange={(e) => setNewPlatformName(e.target.value)}
                    className="w-48 border border-gray-300 rounded px-3 py-2 text-black"
                    placeholder="例: 新規販路"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">背景色</label>
                  <div className="grid grid-cols-8 gap-1 w-fit">
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
                  <label className="block text-sm font-medium text-black mb-1">文字色</label>
                  <div className="flex gap-1">
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
                  <label className="block text-sm font-medium text-black mb-1">プレビュー</label>
                  <span className={`inline-block w-28 text-center px-2 py-1 rounded text-xs font-bold ${newPlatformBgColor} ${newPlatformTextColor}`}>
                    {newPlatformName || '新規販路'}
                  </span>
                </div>
                <button
                  onClick={addPlatform}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  追加
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-50">
                  <th className="px-3 py-2 text-center font-bold text-black w-10">
                    <input
                      type="checkbox"
                      checked={platforms.filter(p => showHiddenPlatforms || !p.is_hidden).length > 0 &&
                               platformSelectedIds.size === platforms.filter(p => showHiddenPlatforms || !p.is_hidden).length}
                      onChange={togglePlatformSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-black">販路名</th>
                  <th className="px-3 py-2 text-left font-bold text-black">代表者氏名</th>
                  <th className="px-3 py-2 text-left font-bold text-black">住所</th>
                  <th className="px-3 py-2 text-left font-bold text-black">電話番号</th>
                  <th className="px-3 py-2 text-left font-bold text-black">メールアドレス</th>
                  <th className="px-3 py-2 text-left font-bold text-black">確認方法</th>
                  <th className="px-3 py-2 text-center font-bold text-black">状態</th>
                  <th className="px-3 py-2 text-center font-bold text-black">非表示</th>
                  <th className="px-3 py-2 text-center font-bold text-black">操作</th>
                </tr>
              </thead>
              <tbody>
                {platforms.filter(p => showHiddenPlatforms || !p.is_hidden).map((platform) => (
                  <tr key={platform.id} className={`border-b hover:bg-gray-50 ${platform.is_hidden ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={platformSelectedIds.has(platform.id)}
                        onChange={() => togglePlatformSelect(platform.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block w-28 text-center px-2 py-1 rounded text-xs font-bold ${platform.color_class}`}>
                        {platform.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-black">{platform.representative_name || '-'}</td>
                    <td className="px-3 py-2 text-black max-w-[200px] truncate" title={platform.address || ''}>
                      {platform.address || '-'}
                    </td>
                    <td className="px-3 py-2 text-black">{platform.phone || '-'}</td>
                    <td className="px-3 py-2 text-black max-w-[180px] truncate" title={platform.email || ''}>{platform.email || '-'}</td>
                    <td className="px-3 py-2 text-black">{platform.verification_method || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      {hasLedgerInfo(platform) ? (
                        <span className="inline-block w-14 text-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">設定済</span>
                      ) : (
                        <span className="inline-block w-14 text-center px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">未設定</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
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
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => setEditingPlatform(platform)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))}
                {platforms.filter(p => showHiddenPlatforms || !p.is_hidden).length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-black">
                      販路が登録されていません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 注記 */}
        <div className="text-xs text-black space-y-1">
          <p>* 仕入先・販路の詳細設定（手数料等）は「仕入先・販路マスタ設定」で行ってください。</p>
          <p>* フリマアプリなど匿名取引の場合は、相手方情報は空欄のままで問題ありません。</p>
        </div>
      </div>

      {/* 仕入先編集モーダル */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-black mb-4">
              仕入先情報編集 - <span className={`inline-block px-2 py-1 rounded text-sm ${editingSupplier.color_class}`}>{editingSupplier.name}</span>
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">代表者氏名</label>
                <input
                  type="text"
                  value={editingSupplier.representative_name || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, representative_name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                  placeholder="例: 山田太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">住所</label>
                <input
                  type="text"
                  value={editingSupplier.address || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                  placeholder="例: 東京都渋谷区..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">職業</label>
                <input
                  type="text"
                  value={editingSupplier.occupation || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, occupation: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                  placeholder="例: 会社員"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">電話番号</label>
                  <input
                    type="text"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                    placeholder="例: 03-1234-5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={editingSupplier.email || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                    placeholder="例: info@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">ホームページ</label>
                <input
                  type="url"
                  value={editingSupplier.website || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, website: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                  placeholder="例: https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">本人確認方法</label>
                <select
                  value={editingSupplier.verification_method || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, verification_method: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
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
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingSupplier(null)}
                className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
              <button
                onClick={saveSupplier}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 販路編集モーダル */}
      {editingPlatform && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-black mb-4">
              販路情報編集 - <span className={`inline-block px-2 py-1 rounded text-sm ${editingPlatform.color_class}`}>{editingPlatform.name}</span>
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">代表者氏名</label>
                <input
                  type="text"
                  value={editingPlatform.representative_name || ''}
                  onChange={(e) => setEditingPlatform({ ...editingPlatform, representative_name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                  placeholder="例: 山田太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">住所</label>
                <input
                  type="text"
                  value={editingPlatform.address || ''}
                  onChange={(e) => setEditingPlatform({ ...editingPlatform, address: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                  placeholder="例: 東京都渋谷区..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">職業</label>
                <input
                  type="text"
                  value={editingPlatform.occupation || ''}
                  onChange={(e) => setEditingPlatform({ ...editingPlatform, occupation: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                  placeholder="例: 会社員"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">電話番号</label>
                  <input
                    type="text"
                    value={editingPlatform.phone || ''}
                    onChange={(e) => setEditingPlatform({ ...editingPlatform, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                    placeholder="例: 03-1234-5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={editingPlatform.email || ''}
                    onChange={(e) => setEditingPlatform({ ...editingPlatform, email: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                    placeholder="例: info@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">ホームページ</label>
                <input
                  type="url"
                  value={editingPlatform.website || ''}
                  onChange={(e) => setEditingPlatform({ ...editingPlatform, website: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
                  placeholder="例: https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">本人確認方法</label>
                <select
                  value={editingPlatform.verification_method || ''}
                  onChange={(e) => setEditingPlatform({ ...editingPlatform, verification_method: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-black"
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
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingPlatform(null)}
                className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
              <button
                onClick={savePlatform}
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
