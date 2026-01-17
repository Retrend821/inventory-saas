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

  // 管理番号でソート
  all.sort((a, b) => {
    const aNum = parseInt(String(a.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    const bNum = parseInt(String(b.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    return aNum - bNum
  })

  // 異常な管理番号（3000以上）を表示
  console.log('\n=== 異常な管理番号（3000以上） ===')
  for (const item of all) {
    const num = parseInt(String(item.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    if (num >= 3000) {
      console.log(`no${item.inventory_number} | メモ: ${(item.memo || '').substring(0, 40)} | ${(item.product_name || '').substring(0, 25)}`)
    }
  }

  // 2744〜2770の範囲を表示
  console.log('\n=== 2744〜2770付近 ===')
  let count = 0
  for (const item of all) {
    const num = parseInt(String(item.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    if (num >= 2744 && num <= 2800) {
      console.log(`no${item.inventory_number} | メモ: ${(item.memo || '').substring(0, 40)} | ${(item.product_name || '').substring(0, 25)}`)
      count++
    }
  }
  console.log(`この範囲: ${count}件`)

  // 正常な最大値確認（10000未満）
  let maxNormal = 0
  for (const item of all) {
    const num = parseInt(String(item.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    if (num > maxNormal && num < 10000) maxNormal = num
  }
  console.log(`\n正常範囲の最大管理番号: ${maxNormal}`)
}

check()
