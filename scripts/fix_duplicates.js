const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://jewlanqflurcqremanty.supabase.co',
  'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ'
)

async function fix() {
  // 重複のうち1件を新番号に振り直す（各ペアの2件目を対象）
  const updates = [
    // no149の2件目 → no3460
    {
      id: '5d3d26ab-ae89-4633-8648-1bc774a6b9b0',
      old_number: '149',
      new_number: '3460',
      purchase_total: 23793,
      product_name: 'ダミエ　黒　財布'
    },
    // no484の2件目 → no3461
    {
      id: '7d586a0a-fe23-4f89-8c68-937a3d9b4726',
      old_number: '484',
      new_number: '3461',
      purchase_total: 16588,
      product_name: 'セリーヌ　マカダム　ガンチーニ　バッグ・ショルダーバッグ'
    }
  ]

  console.log('=== 修正対象 ===')
  for (const u of updates) {
    console.log(`no${u.old_number} → no${u.new_number} | ${u.product_name.substring(0, 30)}`)
  }

  console.log('\n更新中...')
  for (const u of updates) {
    const newMemo = `${u.new_number}）${u.purchase_total}`
    const { error } = await supabase
      .from('inventory')
      .update({ inventory_number: u.new_number, memo: newMemo })
      .eq('id', u.id)
    if (error) {
      console.error(`Error:`, error.message)
    } else {
      console.log(`✓ no${u.old_number} → no${u.new_number}`)
    }
  }

  console.log('\n完了')
}

fix()
