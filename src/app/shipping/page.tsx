'use client'

import { useState, useMemo } from 'react'

type ShippingMethod = {
  name: string
  size: string
  weight: string
  price: string
  extra?: string
  category: string  // ネコポス, 宅急便コンパクト, 宅急便, ゆうパケット, ゆうパック等
}

// 配送方法のカテゴリ一覧
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

// らくらくメルカリ便のデータ
const mercariYamatoData: ShippingMethod[] = [
  { name: 'ネコポス', size: '三辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: '210円', category: 'ネコポス' },
  { name: '宅急便コンパクト', size: '専用BOX（薄型:24.8×34cm / 箱型:20×25×5cm）', weight: '-', price: '450円', extra: '+BOX70円', category: '宅急便コンパクト' },
  { name: '宅急便 60サイズ', size: '60cm以内', weight: '2kg以内', price: '750円', category: '宅急便' },
  { name: '宅急便 80サイズ', size: '80cm以内', weight: '5kg以内', price: '850円', category: '宅急便' },
  { name: '宅急便 100サイズ', size: '100cm以内', weight: '10kg以内', price: '1,050円', category: '宅急便' },
  { name: '宅急便 120サイズ', size: '120cm以内', weight: '15kg以内', price: '1,200円', category: '宅急便' },
  { name: '宅急便 140サイズ', size: '140cm以内', weight: '20kg以内', price: '1,450円', category: '宅急便' },
  { name: '宅急便 160サイズ', size: '160cm以内', weight: '25kg以内', price: '1,700円', category: '宅急便' },
]

// ゆうゆうメルカリ便のデータ
const mercariYubinData: ShippingMethod[] = [
  { name: 'ゆうパケットポストmini', size: '三辺合計60cm以内（長辺34cm以内）', weight: '300g以内', price: '160円', extra: '+シール20円', category: 'ゆうパケットポストmini' },
  { name: 'ゆうパケットポスト', size: '3辺合計60cm以内（長辺34cm以内・郵便ポスト投函可能）', weight: '2kg以内', price: '215円', extra: '+シール5円', category: 'ゆうパケットポスト' },
  { name: 'ゆうパケット', size: '3辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: '230円', category: 'ゆうパケット' },
  { name: 'ゆうパケットプラス', size: '専用BOX（24×17×7cm）', weight: '2kg以内', price: '455円', extra: '+BOX65円', category: 'ゆうパケットプラス' },
  { name: 'ゆうパック 60サイズ', size: '60cm以内', weight: '25kg以内', price: '750円', category: 'ゆうパック' },
  { name: 'ゆうパック 80サイズ', size: '80cm以内', weight: '25kg以内', price: '870円', category: 'ゆうパック' },
  { name: 'ゆうパック 100サイズ', size: '100cm以内', weight: '25kg以内', price: '1,070円', category: 'ゆうパック' },
  { name: 'ゆうパック 120サイズ', size: '120cm以内', weight: '25kg以内', price: '1,200円', category: 'ゆうパック' },
  { name: 'ゆうパック 170サイズ', size: '170cm以内', weight: '25kg以内', price: '1,900円', category: 'ゆうパック' },
]

// かんたんラクマパック（ヤマト）のデータ
const rakumaYamatoData: ShippingMethod[] = [
  { name: 'ネコポス', size: 'A4サイズ（31.2×22.8cm・厚さ3cm以内）', weight: '1kg以内', price: '200円', category: 'ネコポス' },
  { name: '宅急便コンパクト', size: '専用BOX（25×20×5cm以内）', weight: '-', price: '430円', extra: '+BOX70円', category: '宅急便コンパクト' },
  { name: '宅急便 60サイズ', size: '60cm以内', weight: '2kg以内', price: '650円', category: '宅急便' },
  { name: '宅急便 80サイズ', size: '80cm以内', weight: '5kg以内', price: '750円', category: '宅急便' },
  { name: '宅急便 100サイズ', size: '100cm以内', weight: '10kg以内', price: '1,050円', category: '宅急便' },
  { name: '宅急便 120サイズ', size: '120cm以内', weight: '15kg以内', price: '1,200円', category: '宅急便' },
  { name: '宅急便 140サイズ', size: '140cm以内', weight: '20kg以内', price: '1,400円', category: '宅急便' },
  { name: '宅急便 160サイズ', size: '160cm以内', weight: '25kg以内', price: '1,500円', category: '宅急便' },
  { name: '宅急便 180サイズ', size: '180cm以内', weight: '30kg以内', price: '2,800円', category: '宅急便' },
  { name: '宅急便 200サイズ', size: '200cm以内', weight: '30kg以内', price: '3,350円', category: '宅急便' },
]

// かんたんラクマパック（日本郵便）のデータ
const rakumaYubinData: ShippingMethod[] = [
  { name: 'ゆうパケットポストmini', size: '郵便ポスト投函可能サイズ', weight: '2kg以内', price: '150円', category: 'ゆうパケットポストmini' },
  { name: 'ゆうパケットポスト', size: '郵便ポスト投函可能サイズ', weight: '2kg以内', price: '175円', category: 'ゆうパケットポスト' },
  { name: 'ゆうパケット', size: '3辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: '200円', category: 'ゆうパケット' },
  { name: 'ゆうパケットプラス', size: '専用BOX（24×17×7cm）', weight: '2kg以内', price: '380円', extra: '+BOX65円', category: 'ゆうパケットプラス' },
  { name: 'ゆうパック 60サイズ', size: '60cm以内', weight: '25kg以内', price: '700円', category: 'ゆうパック' },
  { name: 'ゆうパック 80サイズ', size: '80cm以内', weight: '25kg以内', price: '800円', category: 'ゆうパック' },
  { name: 'ゆうパック 100サイズ', size: '100cm以内', weight: '25kg以内', price: '1,150円', category: 'ゆうパック' },
  { name: 'ゆうパック 120サイズ', size: '120cm以内', weight: '25kg以内', price: '1,350円', category: 'ゆうパック' },
  { name: 'ゆうパック 140サイズ', size: '140cm以内', weight: '25kg以内', price: '1,500円', category: 'ゆうパック' },
  { name: 'ゆうパック 160サイズ', size: '160cm以内', weight: '25kg以内', price: '1,500円', category: 'ゆうパック' },
  { name: 'ゆうパック 170サイズ', size: '170cm以内', weight: '25kg以内', price: '1,500円', category: 'ゆうパック' },
]

// おてがる配送（ヤマト）のデータ
const yahooYamatoData: ShippingMethod[] = [
  { name: 'ネコポス', size: '三辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: '200円', category: 'ネコポス' },
  { name: '宅急便コンパクト', size: '専用BOX', weight: '-', price: '450円', extra: '+BOX70円', category: '宅急便コンパクト' },
  { name: '宅急便 60サイズ', size: '60cm以内', weight: '2kg以内', price: '750円', category: '宅急便' },
  { name: '宅急便 80サイズ', size: '80cm以内', weight: '5kg以内', price: '850円', category: '宅急便' },
  { name: '宅急便 100サイズ', size: '100cm以内', weight: '10kg以内', price: '1,050円', category: '宅急便' },
  { name: '宅急便 120サイズ', size: '120cm以内', weight: '15kg以内', price: '1,200円', category: '宅急便' },
  { name: '宅急便 140サイズ', size: '140cm以内', weight: '20kg以内', price: '1,450円', category: '宅急便' },
  { name: '宅急便 160サイズ', size: '160cm以内', weight: '25kg以内', price: '1,700円', category: '宅急便' },
]

// おてがる配送（日本郵便）のデータ
const yahooYubinData: ShippingMethod[] = [
  { name: 'ゆうパケット', size: '3辺合計60cm以内（長辺34cm・厚さ3cm以内）', weight: '1kg以内', price: '205円', category: 'ゆうパケット' },
  { name: 'ゆうパケットポスト', size: '専用箱または発送用シール使用', weight: '2kg以内', price: '175円', category: 'ゆうパケットポスト' },
  { name: 'ゆうパケットプラス', size: '専用BOX（24×17×7cm）', weight: '2kg以内', price: '380円', extra: '+BOX65円', category: 'ゆうパケットプラス' },
  { name: 'ゆうパック 60サイズ', size: '60cm以内', weight: '25kg以内', price: '750円', category: 'ゆうパック' },
  { name: 'ゆうパック 80サイズ', size: '80cm以内', weight: '25kg以内', price: '870円', category: 'ゆうパック' },
  { name: 'ゆうパック 100サイズ', size: '100cm以内', weight: '25kg以内', price: '1,070円', category: 'ゆうパック' },
  { name: 'ゆうパック 120サイズ', size: '120cm以内', weight: '25kg以内', price: '1,200円', category: 'ゆうパック' },
  { name: 'ゆうパック 170サイズ', size: '170cm以内', weight: '25kg以内', price: '1,900円', category: 'ゆうパック' },
]

// テーブルヘッダースタイル（在庫表と同じ#334155）
const theadStyle = { backgroundColor: '#334155' }
const thStyle = "px-4 py-3 text-left text-white font-semibold"
const thRightStyle = "px-4 py-3 text-right text-white font-semibold"

function ShippingTable({ data, selectedCategory }: { data: ShippingMethod[], selectedCategory: string }) {
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
            <th className={thStyle}>配送方法</th>
            <th className={thStyle}>サイズ</th>
            <th className={thStyle}>重量</th>
            <th className={thRightStyle}>送料</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredData.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900">{item.name}</td>
              <td className="px-4 py-3 text-gray-600">{item.size}</td>
              <td className="px-4 py-3 text-gray-600">{item.weight}</td>
              <td className="px-4 py-3 text-right text-green-600 font-semibold">
                {item.price}
                {item.extra && <span className="text-xs text-gray-500 ml-1">{item.extra}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ShippingPage() {
  const [selectedCategory, setSelectedCategory] = useState('すべて')

  // 各セクションの表示可否を判定
  const showMercariYamato = selectedCategory === 'すべて' || mercariYamatoData.some(d => d.category === selectedCategory)
  const showMercariYubin = selectedCategory === 'すべて' || mercariYubinData.some(d => d.category === selectedCategory)
  const showRakumaYamato = selectedCategory === 'すべて' || rakumaYamatoData.some(d => d.category === selectedCategory)
  const showRakumaYubin = selectedCategory === 'すべて' || rakumaYubinData.some(d => d.category === selectedCategory)
  const showYahooYamato = selectedCategory === 'すべて' || yahooYamatoData.some(d => d.category === selectedCategory)
  const showYahooYubin = selectedCategory === 'すべて' || yahooYubinData.some(d => d.category === selectedCategory)

  const showMercari = showMercariYamato || showMercariYubin
  const showRakuma = showRakumaYamato || showRakumaYubin
  const showYahoo = showYahooYamato || showYahooYubin

  return (
    <div className="min-h-screen bg-gray-100 pt-20 pb-10 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">送料表</h1>

        {/* 絞り込みフィルター */}
        <div className="mb-8 bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">配送方法で絞り込み</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {shippingCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* メルカリ便 */}
        {showMercari && (
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-orange-600 mb-4">メルカリ便</h2>

            {/* らくらくメルカリ便 */}
            {showMercariYamato && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">らくらくメルカリ便（ヤマト運輸）</h3>
                <ShippingTable data={mercariYamatoData} selectedCategory={selectedCategory} />
              </div>
            )}

            {/* ゆうゆうメルカリ便 */}
            {showMercariYubin && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">ゆうゆうメルカリ便（日本郵便）</h3>
                <ShippingTable data={mercariYubinData} selectedCategory={selectedCategory} />
              </div>
            )}
          </section>
        )}

        {/* ラクマ */}
        {showRakuma && (
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-pink-600 mb-4">かんたんラクマパック</h2>

            {/* ヤマト運輸 */}
            {showRakumaYamato && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">かんたんラクマパック（ヤマト運輸）</h3>
                <ShippingTable data={rakumaYamatoData} selectedCategory={selectedCategory} />
              </div>
            )}

            {/* 日本郵便 */}
            {showRakumaYubin && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">かんたんラクマパック（日本郵便）</h3>
                <ShippingTable data={rakumaYubinData} selectedCategory={selectedCategory} />
              </div>
            )}
          </section>
        )}

        {/* ヤフオク */}
        {showYahoo && (
          <section className="mb-10">
            <h2 className="text-2xl font-bold text-red-600 mb-4">おてがる配送（ヤフオク/Yahoo!フリマ）</h2>

            {/* ヤマト運輸 */}
            {showYahooYamato && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">おてがる配送（ヤマト運輸）</h3>
                <ShippingTable data={yahooYamatoData} selectedCategory={selectedCategory} />
              </div>
            )}

            {/* 日本郵便 */}
            {showYahooYubin && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">おてがる配送（日本郵便）</h3>
                <ShippingTable data={yahooYubinData} selectedCategory={selectedCategory} />
              </div>
            )}
          </section>
        )}

        {/* 注意事項 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-yellow-600 mb-4">注意事項</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>送料は2025年1月時点の情報です。各社の料金改定により変更される場合があります。</li>
            <li>専用BOXやシールは別途購入が必要です。</li>
            <li>サイズは縦・横・高さの合計です。</li>
            <li>すべて匿名配送・追跡・補償に対応しています。</li>
            <li>発送場所や時間帯により、料金が異なる場合があります。</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
