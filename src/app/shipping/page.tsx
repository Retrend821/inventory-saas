'use client'

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-gray-900 pt-20 pb-10 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">送料表</h1>

        {/* メルカリ便 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-orange-400 mb-4">メルカリ便</h2>

          {/* らくらくメルカリ便 */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-3">らくらくメルカリ便（ヤマト運輸）</h3>
            <div className="overflow-x-auto">
              <table className="w-full bg-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-white">配送方法</th>
                    <th className="px-4 py-3 text-left text-white">サイズ</th>
                    <th className="px-4 py-3 text-left text-white">重量</th>
                    <th className="px-4 py-3 text-right text-white">送料</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ネコポス</td>
                    <td className="px-4 py-3 text-gray-300">三辺合計60cm以内（長辺34cm・厚さ3cm以内）</td>
                    <td className="px-4 py-3 text-gray-300">1kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">210円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便コンパクト</td>
                    <td className="px-4 py-3 text-gray-300">専用BOX（薄型:24.8×34cm / 箱型:20×25×5cm）</td>
                    <td className="px-4 py-3 text-gray-300">-</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">450円 <span className="text-xs text-gray-400">+BOX70円</span></td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 60サイズ</td>
                    <td className="px-4 py-3 text-gray-300">60cm以内</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">750円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 80サイズ</td>
                    <td className="px-4 py-3 text-gray-300">80cm以内</td>
                    <td className="px-4 py-3 text-gray-300">5kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">850円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 100サイズ</td>
                    <td className="px-4 py-3 text-gray-300">100cm以内</td>
                    <td className="px-4 py-3 text-gray-300">10kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,050円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 120サイズ</td>
                    <td className="px-4 py-3 text-gray-300">120cm以内</td>
                    <td className="px-4 py-3 text-gray-300">15kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,200円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 140サイズ</td>
                    <td className="px-4 py-3 text-gray-300">140cm以内</td>
                    <td className="px-4 py-3 text-gray-300">20kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,450円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 160サイズ</td>
                    <td className="px-4 py-3 text-gray-300">160cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,700円</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ゆうゆうメルカリ便 */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-3">ゆうゆうメルカリ便（日本郵便）</h3>
            <div className="overflow-x-auto">
              <table className="w-full bg-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-white">配送方法</th>
                    <th className="px-4 py-3 text-left text-white">サイズ</th>
                    <th className="px-4 py-3 text-left text-white">重量</th>
                    <th className="px-4 py-3 text-right text-white">送料</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケットポストmini</td>
                    <td className="px-4 py-3 text-gray-300">三辺合計60cm以内（長辺34cm以内）</td>
                    <td className="px-4 py-3 text-gray-300">300g以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">160円 <span className="text-xs text-gray-400">+シール20円</span></td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケットポスト</td>
                    <td className="px-4 py-3 text-gray-300">3辺合計60cm以内（長辺34cm以内・郵便ポスト投函可能）</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">215円 <span className="text-xs text-gray-400">+シール5円</span></td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケット</td>
                    <td className="px-4 py-3 text-gray-300">3辺合計60cm以内（長辺34cm・厚さ3cm以内）</td>
                    <td className="px-4 py-3 text-gray-300">1kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">230円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケットプラス</td>
                    <td className="px-4 py-3 text-gray-300">専用BOX（24×17×7cm）</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">455円 <span className="text-xs text-gray-400">+BOX65円</span></td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 60サイズ</td>
                    <td className="px-4 py-3 text-gray-300">60cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">750円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 80サイズ</td>
                    <td className="px-4 py-3 text-gray-300">80cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">870円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 100サイズ</td>
                    <td className="px-4 py-3 text-gray-300">100cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,070円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 120サイズ</td>
                    <td className="px-4 py-3 text-gray-300">120cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,200円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 170サイズ</td>
                    <td className="px-4 py-3 text-gray-300">170cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,900円</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ラクマ */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-pink-400 mb-4">かんたんラクマパック</h2>

          {/* ヤマト運輸 */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-3">かんたんラクマパック（ヤマト運輸）</h3>
            <div className="overflow-x-auto">
              <table className="w-full bg-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-white">配送方法</th>
                    <th className="px-4 py-3 text-left text-white">サイズ</th>
                    <th className="px-4 py-3 text-left text-white">重量</th>
                    <th className="px-4 py-3 text-right text-white">送料</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ネコポス</td>
                    <td className="px-4 py-3 text-gray-300">A4サイズ（31.2×22.8cm・厚さ3cm以内）</td>
                    <td className="px-4 py-3 text-gray-300">1kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">200円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便コンパクト</td>
                    <td className="px-4 py-3 text-gray-300">専用BOX（25×20×5cm以内）</td>
                    <td className="px-4 py-3 text-gray-300">-</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">430円 <span className="text-xs text-gray-400">+BOX70円</span></td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 60サイズ</td>
                    <td className="px-4 py-3 text-gray-300">60cm以内</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">650円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 80サイズ</td>
                    <td className="px-4 py-3 text-gray-300">80cm以内</td>
                    <td className="px-4 py-3 text-gray-300">5kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">750円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 100サイズ</td>
                    <td className="px-4 py-3 text-gray-300">100cm以内</td>
                    <td className="px-4 py-3 text-gray-300">10kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">950円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 120サイズ</td>
                    <td className="px-4 py-3 text-gray-300">120cm以内</td>
                    <td className="px-4 py-3 text-gray-300">15kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,150円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 140サイズ</td>
                    <td className="px-4 py-3 text-gray-300">140cm以内</td>
                    <td className="px-4 py-3 text-gray-300">20kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,350円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 160サイズ</td>
                    <td className="px-4 py-3 text-gray-300">160cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,550円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 180サイズ</td>
                    <td className="px-4 py-3 text-gray-300">180cm以内</td>
                    <td className="px-4 py-3 text-gray-300">30kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">2,150円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 200サイズ</td>
                    <td className="px-4 py-3 text-gray-300">200cm以内</td>
                    <td className="px-4 py-3 text-gray-300">30kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">3,350円</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 日本郵便 */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-3">かんたんラクマパック（日本郵便）</h3>
            <div className="overflow-x-auto">
              <table className="w-full bg-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-white">配送方法</th>
                    <th className="px-4 py-3 text-left text-white">サイズ</th>
                    <th className="px-4 py-3 text-left text-white">重量</th>
                    <th className="px-4 py-3 text-right text-white">送料</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケットポストmini</td>
                    <td className="px-4 py-3 text-gray-300">郵便ポスト投函可能サイズ</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">150円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケットポスト</td>
                    <td className="px-4 py-3 text-gray-300">郵便ポスト投函可能サイズ</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">175円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケット</td>
                    <td className="px-4 py-3 text-gray-300">3辺合計60cm以内（長辺34cm・厚さ3cm以内）</td>
                    <td className="px-4 py-3 text-gray-300">1kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">200円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケットプラス</td>
                    <td className="px-4 py-3 text-gray-300">専用BOX（24×17×7cm）</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">380円 <span className="text-xs text-gray-400">+BOX65円</span></td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 60サイズ</td>
                    <td className="px-4 py-3 text-gray-300">60cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">700円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 80サイズ</td>
                    <td className="px-4 py-3 text-gray-300">80cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">800円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 100サイズ</td>
                    <td className="px-4 py-3 text-gray-300">100cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,150円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 120サイズ</td>
                    <td className="px-4 py-3 text-gray-300">120cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,350円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 140サイズ</td>
                    <td className="px-4 py-3 text-gray-300">140cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,500円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 160サイズ</td>
                    <td className="px-4 py-3 text-gray-300">160cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,500円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 170サイズ</td>
                    <td className="px-4 py-3 text-gray-300">170cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,500円</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ヤフオク */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-red-400 mb-4">おてがる配送（ヤフオク/Yahoo!フリマ）</h2>

          {/* ヤマト運輸 */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-3">おてがる配送（ヤマト運輸）</h3>
            <div className="overflow-x-auto">
              <table className="w-full bg-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-white">配送方法</th>
                    <th className="px-4 py-3 text-left text-white">サイズ</th>
                    <th className="px-4 py-3 text-left text-white">重量</th>
                    <th className="px-4 py-3 text-right text-white">送料</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ネコポス</td>
                    <td className="px-4 py-3 text-gray-300">三辺合計60cm以内（長辺34cm・厚さ3cm以内）</td>
                    <td className="px-4 py-3 text-gray-300">1kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">200円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便コンパクト</td>
                    <td className="px-4 py-3 text-gray-300">専用BOX</td>
                    <td className="px-4 py-3 text-gray-300">-</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">450円 <span className="text-xs text-gray-400">+BOX70円</span></td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 60サイズ</td>
                    <td className="px-4 py-3 text-gray-300">60cm以内</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">750円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 80サイズ</td>
                    <td className="px-4 py-3 text-gray-300">80cm以内</td>
                    <td className="px-4 py-3 text-gray-300">5kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">850円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 100サイズ</td>
                    <td className="px-4 py-3 text-gray-300">100cm以内</td>
                    <td className="px-4 py-3 text-gray-300">10kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,050円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 120サイズ</td>
                    <td className="px-4 py-3 text-gray-300">120cm以内</td>
                    <td className="px-4 py-3 text-gray-300">15kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,200円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 140サイズ</td>
                    <td className="px-4 py-3 text-gray-300">140cm以内</td>
                    <td className="px-4 py-3 text-gray-300">20kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,450円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">宅急便 160サイズ</td>
                    <td className="px-4 py-3 text-gray-300">160cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,700円</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 日本郵便 */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-3">おてがる配送（日本郵便）</h3>
            <div className="overflow-x-auto">
              <table className="w-full bg-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-white">配送方法</th>
                    <th className="px-4 py-3 text-left text-white">サイズ</th>
                    <th className="px-4 py-3 text-left text-white">重量</th>
                    <th className="px-4 py-3 text-right text-white">送料</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケット</td>
                    <td className="px-4 py-3 text-gray-300">3辺合計60cm以内（長辺34cm・厚さ3cm以内）</td>
                    <td className="px-4 py-3 text-gray-300">1kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">205円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケットポスト</td>
                    <td className="px-4 py-3 text-gray-300">専用箱または発送用シール使用</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">175円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパケットプラス</td>
                    <td className="px-4 py-3 text-gray-300">専用BOX（24×17×7cm）</td>
                    <td className="px-4 py-3 text-gray-300">2kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">380円 <span className="text-xs text-gray-400">+BOX65円</span></td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 60サイズ</td>
                    <td className="px-4 py-3 text-gray-300">60cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">750円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 80サイズ</td>
                    <td className="px-4 py-3 text-gray-300">80cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">870円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 100サイズ</td>
                    <td className="px-4 py-3 text-gray-300">100cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,070円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 120サイズ</td>
                    <td className="px-4 py-3 text-gray-300">120cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,200円</td>
                  </tr>
                  <tr className="hover:bg-slate-700">
                    <td className="px-4 py-3 text-white">ゆうパック 170サイズ</td>
                    <td className="px-4 py-3 text-gray-300">170cm以内</td>
                    <td className="px-4 py-3 text-gray-300">25kg以内</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">1,900円</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 注意事項 */}
        <section className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-yellow-400 mb-4">注意事項</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
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
