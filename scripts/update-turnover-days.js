// 既存データの回転日数を出品日→売却日で再計算するスクリプト
// 実行方法: node scripts/update-turnover-days.js

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impld2xhbnFmbHVyY3FyZW1hbnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODY2NDgsImV4cCI6MjA3OTY2MjY0OH0.eZiO_lkE7dM5ih3kHjrLCeaQ5ozpilRwTVgLsLnCp8I'

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateTurnoverDays() {
  console.log('回転日数の再計算を開始します...')
  console.log('計算方法: 出品日から売却日までの日数')

  // 出品日と売却日が両方あるデータを全件取得（ページネーション対応）
  let allItems = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data: items, error: fetchError } = await supabase
      .from('inventory')
      .select('id, listing_date, sale_date, turnover_days')
      .not('listing_date', 'is', null)
      .not('sale_date', 'is', null)
      .neq('listing_date', '')
      .neq('sale_date', '')
      .neq('listing_date', '返品')
      .neq('sale_date', '返品')
      .range(from, from + pageSize - 1)

    if (fetchError) {
      console.error('データ取得エラー:', fetchError)
      process.exit(1)
    }

    if (!items || items.length === 0) break
    allItems = allItems.concat(items)
    console.log(`${allItems.length}件取得済み...`)

    if (items.length < pageSize) break
    from += pageSize
  }

  const items = allItems
  console.log(`対象データ数: ${items.length}件`)

  let updatedCount = 0
  let skippedCount = 0

  for (const item of items) {
    try {
      const listingDate = new Date(item.listing_date)
      const saleDate = new Date(item.sale_date)

      // 日付が有効かチェック
      if (isNaN(listingDate.getTime()) || isNaN(saleDate.getTime())) {
        skippedCount++
        continue
      }

      const diffTime = saleDate.getTime() - listingDate.getTime()
      const newTurnoverDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // 更新
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ turnover_days: newTurnoverDays })
        .eq('id', item.id)

      if (updateError) {
        console.error(`ID ${item.id} の更新エラー:`, updateError)
        continue
      }

      updatedCount++

      // 進捗表示（100件ごと）
      if (updatedCount % 100 === 0) {
        console.log(`${updatedCount}件更新完了...`)
      }
    } catch (err) {
      console.error(`ID ${item.id} の処理エラー:`, err)
    }
  }

  console.log('\n=== 完了 ===')
  console.log(`更新: ${updatedCount}件`)
  console.log(`スキップ: ${skippedCount}件`)
}

updateTurnoverDays()
