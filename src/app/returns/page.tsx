'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type ReturnItem = {
  id: string
  inventory_number: string | null
  product_name: string
  brand_name: string | null
  image_url: string | null
  saved_image_url: string | null
  purchase_price: number | null
  sale_price: number | null
  purchase_source: string | null
  sale_date: string | null
  refund_status: string | null
  refund_date: string | null
  refund_amount: number | null
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReturns()
  }, [])

  const fetchReturns = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, inventory_number, product_name, brand_name, image_url, saved_image_url, purchase_price, sale_price, purchase_source, sale_date, refund_status, refund_date, refund_amount')
      .eq('sale_destination', '返品')
      .order('sale_date', { ascending: false })

    if (error) {
      console.error('Error fetching returns:', error)
    } else {
      setReturns(data || [])
    }
    setLoading(false)
  }

  const toggleRefundStatus = async (item: ReturnItem) => {
    const newStatus = item.refund_status === '返金済み' ? '未返金' : '返金済み'
    const newDate = newStatus === '返金済み' ? new Date().toISOString().split('T')[0] : null

    const { error } = await supabase
      .from('inventory')
      .update({
        refund_status: newStatus,
        refund_date: newDate
      })
      .eq('id', item.id)

    if (error) {
      console.error('Error updating refund status:', error)
    } else {
      setReturns(prev => prev.map(r =>
        r.id === item.id
          ? { ...r, refund_status: newStatus, refund_date: newDate }
          : r
      ))
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    return `¥${amount.toLocaleString()}`
  }

  // 集計
  const totalCount = returns.length
  const refundedCount = returns.filter(r => r.refund_status === '返金済み').length
  const pendingCount = totalCount - refundedCount
  const totalRefundAmount = returns
    .filter(r => r.refund_status === '返金済み')
    .reduce((sum, r) => sum + (r.purchase_price || 0), 0)
  const pendingRefundAmount = returns
    .filter(r => r.refund_status !== '返金済み')
    .reduce((sum, r) => sum + (r.purchase_price || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">返品管理</h1>

        {/* サマリー */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">返品総数</p>
            <p className="text-2xl font-bold text-gray-900">{totalCount}件</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">返金済み</p>
            <p className="text-2xl font-bold text-green-600">{refundedCount}件</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">未返金</p>
            <p className="text-2xl font-bold text-red-600">{pendingCount}件</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">未返金額</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(pendingRefundAmount)}</p>
          </div>
        </div>

        {/* 返品一覧 */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-600">
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">画像</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">管理番号</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">商品名</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-white">仕入先</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-white">返品日</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-white">返金額</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-white">返金状況</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-white">返金日</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((item) => (
                <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 ${item.refund_status === '返金済み' ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-3">
                    {(item.saved_image_url || item.image_url) ? (
                      <img
                        src={item.saved_image_url || item.image_url || ''}
                        alt={item.product_name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                        No Image
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.inventory_number || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 font-medium">{item.product_name}</div>
                    {item.brand_name && (
                      <div className="text-xs text-gray-500">{item.brand_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.purchase_source || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-center">{formatDate(item.sale_date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.purchase_price)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleRefundStatus(item)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        item.refund_status === '返金済み'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {item.refund_status || '未返金'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-center">
                    <input
                      type="date"
                      value={item.refund_date || ''}
                      onChange={async (e) => {
                        const newDate = e.target.value || null
                        const { error } = await supabase
                          .from('inventory')
                          .update({ refund_date: newDate })
                          .eq('id', item.id)
                        if (!error) {
                          setReturns(prev => prev.map(r =>
                            r.id === item.id ? { ...r, refund_date: newDate } : r
                          ))
                        }
                      }}
                      className="w-32 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    返品データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
