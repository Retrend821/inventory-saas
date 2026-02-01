'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// 仕入先の手数料計算
function calculateSupplierFee(supplier: string, price: number): number {
  if (!supplier || !price) return 0

  switch (supplier) {
    case "エコオク":
      if (price <= 10000) return 500
      if (price <= 50000) return 1000
      return 2000
    case "ものバンク":
      return Math.round(price * 0.03)
    case "スターバイヤーズ":
      return 550
    case "アプレ":
      return Math.round(price * 0.03)
    case "オークネット":
      return Math.max(500, Math.round(price * 0.04))
    case "JBA（金沢）":
      if (price <= 10000) return 500
      if (price <= 99999) return Math.round(price * 0.05)
      return Math.round(price * 0.02)
    case "仲卸":
      return 0
    case "JPA（柏）":
      return Math.round(price * 0.08)
    case "大吉":
      return Math.round(price * 0.05)
    default:
      return 0
  }
}

// 販売先の手数料計算
function calculateSellingFee(buyer: string, price: number): number {
  if (!buyer || !price) return 0

  switch (buyer) {
    case "エコオク":
      if (price <= 10000) return 550
      if (price <= 50000) return 1100
      return 2200
    case "ものバンク":
      return Math.round(price * 0.05)
    case "スターバイヤーズ":
      return 550
    case "アプレ":
      return Math.round(price * 0.03)
    case "タイムレス":
      return Math.round(price * 0.05)
    case "ペイペイ":
      return Math.round(price * 0.05)
    case "メルカリ":
      return Math.round(price * 0.1)
    case "ヤフオク":
      return Math.round(price * 0.088)
    case "オークネット":
      return Math.max(550, Math.round(price * 0.03))
    case "エコトレ":
      return Math.round(price * 0.1)
    case "JBA":
      return Math.round(price * 0.03) + 550
    case "仲卸":
      return 0
    default:
      return 0
  }
}

// 数値フォーマット
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)
}

// 送料データ
type ShippingMethod = {
  name: string
  size: string
  weight: string
  price: number
  extra?: string
  category: string
}

const shippingCategories = [
  'すべて',
  'ネコポス',
  '宅急便コンパクト',
  '宅急便',
  'ゆうパケットポストmini',
  'ゆうパケットポスト',
  'ゆうパケット',
  'ゆうパケットプラス',
  'ゆうパック',
]

const mercariYamatoData: ShippingMethod[] = [
  { name: 'ネコポス', size: '三辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: 210, category: 'ネコポス' },
  { name: '宅急便コンパクト', size: '専用BOX', weight: '-', price: 450, extra: '+BOX70円', category: '宅急便コンパクト' },
  { name: '宅急便 60サイズ', size: '60cm以内', weight: '2kg以内', price: 750, category: '宅急便' },
  { name: '宅急便 80サイズ', size: '80cm以内', weight: '5kg以内', price: 850, category: '宅急便' },
  { name: '宅急便 100サイズ', size: '100cm以内', weight: '10kg以内', price: 1050, category: '宅急便' },
  { name: '宅急便 120サイズ', size: '120cm以内', weight: '15kg以内', price: 1200, category: '宅急便' },
  { name: '宅急便 140サイズ', size: '140cm以内', weight: '20kg以内', price: 1450, category: '宅急便' },
  { name: '宅急便 160サイズ', size: '160cm以内', weight: '25kg以内', price: 1700, category: '宅急便' },
]

const mercariYubinData: ShippingMethod[] = [
  { name: 'ゆうパケットポストmini', size: '三辺合計60cm以内（長辺34cm以内）', weight: '300g以内', price: 160, extra: '+シール20円', category: 'ゆうパケットポストmini' },
  { name: 'ゆうパケットポスト', size: '3辺合計60cm以内（長辺34cm以内）', weight: '2kg以内', price: 215, extra: '+シール5円', category: 'ゆうパケットポスト' },
  { name: 'ゆうパケット', size: '3辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: 230, category: 'ゆうパケット' },
  { name: 'ゆうパケットプラス', size: '専用BOX（24×17×7cm）', weight: '2kg以内', price: 455, extra: '+BOX65円', category: 'ゆうパケットプラス' },
  { name: 'ゆうパック 60サイズ', size: '60cm以内', weight: '25kg以内', price: 750, category: 'ゆうパック' },
  { name: 'ゆうパック 80サイズ', size: '80cm以内', weight: '25kg以内', price: 870, category: 'ゆうパック' },
  { name: 'ゆうパック 100サイズ', size: '100cm以内', weight: '25kg以内', price: 1070, category: 'ゆうパック' },
  { name: 'ゆうパック 120サイズ', size: '120cm以内', weight: '25kg以内', price: 1200, category: 'ゆうパック' },
  { name: 'ゆうパック 170サイズ', size: '170cm以内', weight: '25kg以内', price: 1900, category: 'ゆうパック' },
]

const rakumaYamatoData: ShippingMethod[] = [
  { name: 'ネコポス', size: 'A4サイズ（31.2×22.8cm・厚さ3cm以内）', weight: '1kg以内', price: 200, category: 'ネコポス' },
  { name: '宅急便コンパクト', size: '専用BOX（25×20×5cm以内）', weight: '-', price: 430, extra: '+BOX70円', category: '宅急便コンパクト' },
  { name: '宅急便 60サイズ', size: '60cm以内', weight: '2kg以内', price: 650, category: '宅急便' },
  { name: '宅急便 80サイズ', size: '80cm以内', weight: '5kg以内', price: 750, category: '宅急便' },
  { name: '宅急便 100サイズ', size: '100cm以内', weight: '10kg以内', price: 1050, category: '宅急便' },
  { name: '宅急便 120サイズ', size: '120cm以内', weight: '15kg以内', price: 1200, category: '宅急便' },
  { name: '宅急便 140サイズ', size: '140cm以内', weight: '20kg以内', price: 1400, category: '宅急便' },
  { name: '宅急便 160サイズ', size: '160cm以内', weight: '25kg以内', price: 1500, category: '宅急便' },
  { name: '宅急便 180サイズ', size: '180cm以内', weight: '30kg以内', price: 2800, category: '宅急便' },
  { name: '宅急便 200サイズ', size: '200cm以内', weight: '30kg以内', price: 3350, category: '宅急便' },
]

const rakumaYubinData: ShippingMethod[] = [
  { name: 'ゆうパケットポストmini', size: '郵便ポスト投函可能サイズ', weight: '2kg以内', price: 150, category: 'ゆうパケットポストmini' },
  { name: 'ゆうパケットポスト', size: '郵便ポスト投函可能サイズ', weight: '2kg以内', price: 175, category: 'ゆうパケットポスト' },
  { name: 'ゆうパケット', size: '3辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: 200, category: 'ゆうパケット' },
  { name: 'ゆうパケットプラス', size: '専用BOX（24×17×7cm）', weight: '2kg以内', price: 380, extra: '+BOX65円', category: 'ゆうパケットプラス' },
  { name: 'ゆうパック 60サイズ', size: '60cm以内', weight: '25kg以内', price: 700, category: 'ゆうパック' },
  { name: 'ゆうパック 80サイズ', size: '80cm以内', weight: '25kg以内', price: 800, category: 'ゆうパック' },
  { name: 'ゆうパック 100サイズ', size: '100cm以内', weight: '25kg以内', price: 1150, category: 'ゆうパック' },
  { name: 'ゆうパック 120サイズ', size: '120cm以内', weight: '25kg以内', price: 1350, category: 'ゆうパック' },
  { name: 'ゆうパック 140サイズ', size: '140cm以内', weight: '25kg以内', price: 1500, category: 'ゆうパック' },
  { name: 'ゆうパック 160サイズ', size: '160cm以内', weight: '25kg以内', price: 1500, category: 'ゆうパック' },
  { name: 'ゆうパック 170サイズ', size: '170cm以内', weight: '25kg以内', price: 1500, category: 'ゆうパック' },
]

const yahooYamatoData: ShippingMethod[] = [
  { name: 'ネコポス', size: '三辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: 200, category: 'ネコポス' },
  { name: '宅急便コンパクト', size: '専用BOX', weight: '-', price: 450, extra: '+BOX70円', category: '宅急便コンパクト' },
  { name: '宅急便 60サイズ', size: '60cm以内', weight: '2kg以内', price: 750, category: '宅急便' },
  { name: '宅急便 80サイズ', size: '80cm以内', weight: '5kg以内', price: 850, category: '宅急便' },
  { name: '宅急便 100サイズ', size: '100cm以内', weight: '10kg以内', price: 1050, category: '宅急便' },
  { name: '宅急便 120サイズ', size: '120cm以内', weight: '15kg以内', price: 1200, category: '宅急便' },
  { name: '宅急便 140サイズ', size: '140cm以内', weight: '20kg以内', price: 1450, category: '宅急便' },
  { name: '宅急便 160サイズ', size: '160cm以内', weight: '25kg以内', price: 1700, category: '宅急便' },
]

const yahooYubinData: ShippingMethod[] = [
  { name: 'ゆうパケットポストmini', size: '郵便ポスト投函可能サイズ', weight: '2kg以内', price: 160, category: 'ゆうパケットポストmini' },
  { name: 'ゆうパケットポスト', size: '専用箱または発送用シール使用', weight: '2kg以内', price: 210, category: 'ゆうパケットポスト' },
  { name: 'ゆうパケット', size: '3辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: 205, category: 'ゆうパケット' },
  { name: 'ゆうパケットプラス', size: '専用BOX（24×17×7cm）', weight: '2kg以内', price: 380, extra: '+BOX65円', category: 'ゆうパケットプラス' },
  { name: 'ゆうパック 60サイズ', size: '60cm以内', weight: '25kg以内', price: 750, category: 'ゆうパック' },
  { name: 'ゆうパック 80サイズ', size: '80cm以内', weight: '25kg以内', price: 870, category: 'ゆうパック' },
  { name: 'ゆうパック 100サイズ', size: '100cm以内', weight: '25kg以内', price: 1070, category: 'ゆうパック' },
  { name: 'ゆうパック 120サイズ', size: '120cm以内', weight: '25kg以内', price: 1200, category: 'ゆうパック' },
  { name: 'ゆうパック 170サイズ', size: '170cm以内', weight: '25kg以内', price: 1900, category: 'ゆうパック' },
]

// 送料テーブルコンポーネント
const theadStyle = { backgroundColor: '#334155' }

function ShippingTable({ data, selectedCategory, onSelectShipping }: {
  data: ShippingMethod[]
  selectedCategory: string
  onSelectShipping: (price: number) => void
}) {
  const filteredData = useMemo(() => {
    if (selectedCategory === 'すべて') return data
    return data.filter(item => item.category === selectedCategory)
  }, [data, selectedCategory])

  if (filteredData.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full bg-white rounded-lg overflow-hidden shadow">
        <thead style={theadStyle}>
          <tr>
            <th className="px-3 py-2 text-left text-white font-semibold text-sm">配送方法</th>
            <th className="px-3 py-2 text-left text-white font-semibold text-sm">サイズ</th>
            <th className="px-3 py-2 text-right text-white font-semibold text-sm">送料</th>
            <th className="px-3 py-2 text-center text-white font-semibold text-sm">選択</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredData.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-900 text-sm">{item.name}</td>
              <td className="px-3 py-2 text-gray-600 text-sm">{item.size}</td>
              <td className="px-3 py-2 text-right text-green-600 font-semibold text-sm">
                {formatCurrency(item.price)}
                {item.extra && <span className="text-xs text-gray-500 ml-1">{item.extra}</span>}
              </td>
              <td className="px-3 py-2 text-center">
                <button
                  onClick={() => onSelectShipping(item.price)}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  選択
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 仕入先リスト
const suppliers = [
  "エコオク",
  "ものバンク",
  "スターバイヤーズ",
  "アプレ",
  "オークネット",
  "JBA（金沢）",
  "仲卸",
  "JPA（柏）",
  "大吉",
]

// 売り先リスト
const buyers = [
  "エコオク",
  "ものバンク",
  "スターバイヤーズ",
  "アプレ",
  "タイムレス",
  "ペイペイ",
  "メルカリ",
  "ヤフオク",
  "オークネット",
  "エコトレ",
  "JBA",
  "仲卸",
]

export default function CalculatorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // URLパラメータから初期値を取得
  const [supplierName, setSupplierName] = useState(searchParams.get('supplier') || '')
  const [bidPrice, setBidPrice] = useState(searchParams.get('bid') || '')
  const [buyerName, setBuyerName] = useState(searchParams.get('buyer') || '')
  const [sellingPrice, setSellingPrice] = useState(searchParams.get('sell') || '')
  const [shippingCost, setShippingCost] = useState(searchParams.get('ship') || '')

  // 仕入れ限界値の状態
  const [limitSupplier, setLimitSupplier] = useState(searchParams.get('lsupplier') || '')
  const [limitSellingPrice, setLimitSellingPrice] = useState(searchParams.get('lsell') || '')

  // 送料表の状態
  const [shippingFilter, setShippingFilter] = useState('すべて')
  const [showShippingTable, setShowShippingTable] = useState(false)

  // URLパラメータを更新する関数
  const updateURL = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    const queryString = params.toString()
    router.replace(`/calculator${queryString ? '?' + queryString : ''}`, { scroll: false })
  }

  // 各入力のハンドラー
  const handleSupplierChange = (value: string) => {
    setSupplierName(value)
    updateURL({ supplier: value })
  }

  const handleBidPriceChange = (value: string) => {
    setBidPrice(value)
    updateURL({ bid: value })
  }

  const handleBuyerChange = (value: string) => {
    setBuyerName(value)
    updateURL({ buyer: value })
  }

  const handleSellingPriceChange = (value: string) => {
    setSellingPrice(value)
    updateURL({ sell: value })
  }

  const handleShippingCostChange = (value: string) => {
    setShippingCost(value)
    updateURL({ ship: value })
  }

  const handleLimitSupplierChange = (value: string) => {
    setLimitSupplier(value)
    updateURL({ lsupplier: value })
  }

  const handleLimitSellingPriceChange = (value: string) => {
    setLimitSellingPrice(value)
    updateURL({ lsell: value })
  }

  // 利益計算の結果
  const bidPriceNum = parseFloat(bidPrice) || 0
  const supplierFee = calculateSupplierFee(supplierName, bidPriceNum)
  const subtotal = bidPriceNum + supplierFee
  const finalPrice = Math.round(subtotal * 1.1)

  const sellingPriceNum = parseFloat(sellingPrice) || 0
  const sellingPriceTax = Math.round(sellingPriceNum * 1.1)
  const sellingFee = calculateSellingFee(buyerName, sellingPriceNum)

  const shippingCostNum = parseFloat(shippingCost) || 0
  const totalProfit = sellingPriceNum - sellingFee - finalPrice - shippingCostNum

  // 仕入れ限界値の計算
  const limitSellingPriceNum = parseFloat(limitSellingPrice) || 0
  const limitShippingCost = 1000
  const limitBuyerProfit = 3500
  const limitErenosProfit = 2000
  const limitRequiredProfit = 3500
  const limitRequiredRate = 13
  const limitSellingFee = Math.round(limitSellingPriceNum * 0.1)

  const calculatePurchaseLimit = () => {
    if (!limitSupplier || !limitSellingPriceNum) return null

    const minProfitFromRate = (limitSellingPriceNum * limitRequiredRate / 100)
    const minProfit = Math.max(minProfitFromRate, limitRequiredProfit)
    const totalRequiredProfit = minProfit + limitBuyerProfit + limitErenosProfit
    const maxPurchaseTotal = limitSellingPriceNum - limitSellingFee - limitShippingCost - totalRequiredProfit
    const taxRate = 0.1
    const maxPurchaseBeforeTax = maxPurchaseTotal / (1 + taxRate)

    let purchasePrice = maxPurchaseBeforeTax
    let lastPurchasePrice = 0
    let iterations = 0

    while (Math.abs(purchasePrice - lastPurchasePrice) > 1 && iterations < 10) {
      lastPurchasePrice = purchasePrice
      const supplierFeeEstimate = calculateSupplierFee(limitSupplier, purchasePrice)
      purchasePrice = maxPurchaseBeforeTax - supplierFeeEstimate
      iterations++
    }

    const supplierFeeValue = calculateSupplierFee(limitSupplier, purchasePrice)
    const subtotalValue = purchasePrice + supplierFeeValue
    const finalPriceValue = subtotalValue * (1 + taxRate)
    const wholesaleProfit = limitSellingPriceNum - limitSellingFee - finalPriceValue - limitShippingCost - limitBuyerProfit - limitErenosProfit
    const wholesaleProfitRate = (wholesaleProfit / limitSellingPriceNum) * 100

    return {
      purchasePrice: Math.round(purchasePrice),
      supplierFee: Math.round(supplierFeeValue),
      finalPrice: Math.round(finalPriceValue),
      actualProfit: Math.round(wholesaleProfit),
      actualRate: wholesaleProfitRate.toFixed(2),
    }
  }

  const limitResult = calculatePurchaseLimit()

  // 送料選択時のハンドラー
  const handleSelectShipping = (price: number) => {
    const priceStr = price.toString()
    setShippingCost(priceStr)
    updateURL({ ship: priceStr })
    setShowShippingTable(false)
  }

  // 送料表のセクション表示判定
  const showMercariYamato = shippingFilter === 'すべて' || mercariYamatoData.some(d => d.category === shippingFilter)
  const showMercariYubin = shippingFilter === 'すべて' || mercariYubinData.some(d => d.category === shippingFilter)
  const showRakumaYamato = shippingFilter === 'すべて' || rakumaYamatoData.some(d => d.category === shippingFilter)
  const showRakumaYubin = shippingFilter === 'すべて' || rakumaYubinData.some(d => d.category === shippingFilter)
  const showYahooYamato = shippingFilter === 'すべて' || yahooYamatoData.some(d => d.category === shippingFilter)
  const showYahooYubin = shippingFilter === 'すべて' || yahooYubinData.some(d => d.category === shippingFilter)

  const showMercari = showMercariYamato || showMercariYubin
  const showRakuma = showRakumaYamato || showRakumaYubin
  const showYahoo = showYahooYamato || showYahooYubin

  return (
    <div className="min-h-screen bg-gray-100 pt-16 sm:pt-20 pb-10 px-2 sm:px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">利益計算機</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* 利益計算カード */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">利益計算</h2>

            {/* 仕入情報 */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">仕入情報</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仕入先</label>
                  <select
                    value={supplierName}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-red-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">指値</label>
                  <input
                    type="number"
                    value={bidPrice}
                    onChange={(e) => handleBidPriceChange(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-red-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">手数料</label>
                  <input
                    type="text"
                    value={supplierFee ? formatCurrency(supplierFee) : ''}
                    readOnly
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg bg-orange-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最終税込価格</label>
                  <input
                    type="text"
                    value={finalPrice ? formatCurrency(finalPrice) : ''}
                    readOnly
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg bg-orange-50 font-bold text-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* 販売情報 */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">販売情報</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">売り先</label>
                  <select
                    value={buyerName}
                    onChange={(e) => handleBuyerChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-red-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {buyers.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">売値</label>
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => handleSellingPriceChange(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-red-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">販売手数料</label>
                  <input
                    type="text"
                    value={sellingFee ? formatCurrency(sellingFee) : ''}
                    readOnly
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg bg-orange-50"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-gray-700">送料</label>
                    <button
                      onClick={() => setShowShippingTable(!showShippingTable)}
                      className="px-2 py-0.5 bg-slate-600 text-white rounded text-xs font-medium hover:bg-slate-700 transition-colors"
                    >
                      送料表
                    </button>
                  </div>
                  <input
                    type="number"
                    value={shippingCost}
                    onChange={(e) => handleShippingCostChange(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-red-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 利益結果 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="text-center">
                <span className="text-gray-600 text-sm">利益</span>
                <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalProfit)}
                </p>
              </div>
            </div>
          </div>

          {/* 仕入れ限界値カード */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">仕入れ限界値</h2>
            <p className="text-sm text-gray-600 mb-4">メルカリ販売、卸先利益率13%以上かつ利益額3,500円以上を確保するための仕入れ限界値</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">仕入先</label>
                <select
                  value={limitSupplier}
                  onChange={(e) => handleLimitSupplierChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-red-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">選択してください</option>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メルカリ売値</label>
                <input
                  type="number"
                  value={limitSellingPrice}
                  onChange={(e) => handleLimitSellingPriceChange(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-red-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">販売手数料</label>
                <input
                  type="text"
                  value={limitSellingFee ? formatCurrency(limitSellingFee) : ''}
                  readOnly
                  className="w-full px-3 py-2 border border-orange-200 rounded-lg bg-orange-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">送料</label>
                <input
                  type="text"
                  value={formatCurrency(limitShippingCost)}
                  readOnly
                  className="w-full px-3 py-2 border border-orange-200 rounded-lg bg-orange-50"
                />
              </div>
            </div>

            {limitResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
                    <span className="text-xs text-gray-600">仕入れ限界額（税抜）</span>
                    <p className="text-lg font-bold text-gray-800">{formatCurrency(limitResult.purchasePrice)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
                    <span className="text-xs text-gray-600">仕入れ手数料</span>
                    <p className="text-lg font-bold text-gray-800">{formatCurrency(limitResult.supplierFee)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                    <span className="text-xs text-gray-600">仕入れ限界額（税込）</span>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(limitResult.finalPrice)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-lg p-3 text-center border ${limitResult.actualProfit >= limitRequiredProfit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-xs text-gray-600">実際の利益</span>
                    <p className={`text-lg font-bold ${limitResult.actualProfit >= limitRequiredProfit ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(limitResult.actualProfit)}</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center border ${parseFloat(limitResult.actualRate) >= limitRequiredRate ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-xs text-gray-600">実際の利益率</span>
                    <p className={`text-lg font-bold ${parseFloat(limitResult.actualRate) >= limitRequiredRate ? 'text-green-600' : 'text-red-600'}`}>{limitResult.actualRate}%</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500">
              <p>※ バイヤー利益: {formatCurrency(limitBuyerProfit)} / エレノス利益: {formatCurrency(limitErenosProfit)}</p>
            </div>
          </div>
        </div>

        {/* 送料表（折りたたみ） */}
        {showShippingTable && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">送料表</h2>
              <button
                onClick={() => setShowShippingTable(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* フィルター */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">配送方法で絞り込み</label>
              <select
                value={shippingFilter}
                onChange={(e) => setShippingFilter(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {shippingCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* メルカリ便 */}
            {showMercari && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
                  <h3 className="text-lg font-bold text-gray-800">メルカリ便</h3>
                  <span className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-medium rounded-full">Mercari</span>
                </div>
                {showMercariYamato && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-lg border border-red-200">らくらくメルカリ便</span>
                      <span className="text-gray-500 text-sm">ヤマト運輸</span>
                    </div>
                    <ShippingTable data={mercariYamatoData} selectedCategory={shippingFilter} onSelectShipping={handleSelectShipping} />
                  </div>
                )}
                {showMercariYubin && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-lg border border-red-200">ゆうゆうメルカリ便</span>
                      <span className="text-gray-500 text-sm">日本郵便</span>
                    </div>
                    <ShippingTable data={mercariYubinData} selectedCategory={shippingFilter} onSelectShipping={handleSelectShipping} />
                  </div>
                )}
              </div>
            )}

            {/* ラクマ */}
            {showRakuma && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-pink-500 to-rose-500 rounded-full"></div>
                  <h3 className="text-lg font-bold text-gray-800">かんたんラクマパック</h3>
                  <span className="px-3 py-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-medium rounded-full">Rakuma</span>
                </div>
                {showRakumaYamato && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-pink-100 text-pink-700 text-sm font-semibold rounded-lg border border-pink-200">ヤマト運輸</span>
                    </div>
                    <ShippingTable data={rakumaYamatoData} selectedCategory={shippingFilter} onSelectShipping={handleSelectShipping} />
                  </div>
                )}
                {showRakumaYubin && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-pink-100 text-pink-700 text-sm font-semibold rounded-lg border border-pink-200">日本郵便</span>
                    </div>
                    <ShippingTable data={rakumaYubinData} selectedCategory={shippingFilter} onSelectShipping={handleSelectShipping} />
                  </div>
                )}
              </div>
            )}

            {/* ヤフオク */}
            {showYahoo && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-8 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-full"></div>
                  <h3 className="text-lg font-bold text-gray-800">おてがる配送</h3>
                  <span className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-medium rounded-full">Yahoo!</span>
                </div>
                {showYahooYamato && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-semibold rounded-lg border border-yellow-200">ヤマト運輸</span>
                    </div>
                    <ShippingTable data={yahooYamatoData} selectedCategory={shippingFilter} onSelectShipping={handleSelectShipping} />
                  </div>
                )}
                {showYahooYubin && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-semibold rounded-lg border border-yellow-200">日本郵便</span>
                    </div>
                    <ShippingTable data={yahooYubinData} selectedCategory={shippingFilter} onSelectShipping={handleSelectShipping} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
