const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://jewlanqflurcqremanty.supabase.co',
  'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ'
)

async function check() {
  // 全件取得
  let all = []
  let offset = 0
  const batchSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, inventory_number, memo, product_name, purchase_total')
      .range(offset, offset + batchSize - 1)
    if (error) { console.error(error); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < batchSize) break
    offset += batchSize
  }

  console.log(`全件数: ${all.length}`)

  // 重複チェック
  const byNumber = {}
  for (const item of all) {
    const num = item.inventory_number
    if (!byNumber[num]) byNumber[num] = []
    byNumber[num].push(item)
  }

  const duplicates = Object.entries(byNumber).filter(([k, v]) => v.length > 1)

  if (duplicates.length === 0) {
    console.log('\n重複なし！')
  } else {
    console.log(`\n重複している管理番号: ${duplicates.length}件`)
    for (const [num, items] of duplicates) {
      console.log(`\n=== no${num} (${items.length}件) ===`)
      for (const item of items) {
        console.log(`  ID: ${item.id}`)
        console.log(`  商品名: ${item.product_name?.substring(0, 40)}`)
        console.log(`  メモ: ${item.memo?.substring(0, 40)}`)
        console.log(`  仕入総額: ${item.purchase_total}`)
        console.log('')
      }
    }
  }

  // 最大番号確認
  let maxNum = 0
  for (const item of all) {
    const num = parseInt(String(item.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    if (num > maxNum) maxNum = num
  }
  console.log(`\n最大管理番号: ${maxNum}`)
}

check()
