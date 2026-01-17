const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://jewlanqflurcqremanty.supabase.co',
  'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ'
)

async function fix() {
  // 全件取得
  let all = []
  let offset = 0
  const batchSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, inventory_number, memo, purchase_total')
      .range(offset, offset + batchSize - 1)
    if (error) { console.error(error); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < batchSize) break
    offset += batchSize
  }

  console.log(`全件数: ${all.length}`)

  // 9991以上の異常な番号を持つレコードを抽出
  const abnormal = all.filter(item => {
    const num = parseInt(String(item.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    return num >= 9991
  })

  console.log(`異常な番号のレコード数: ${abnormal.length}`)

  if (abnormal.length === 0) {
    console.log('修正対象がありません')
    return
  }

  // 現在の正常な最大番号を取得（3437のはず）
  let maxNormal = 0
  for (const item of all) {
    const num = parseInt(String(item.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    if (num > maxNormal && num < 9991) maxNormal = num
  }
  console.log(`正常な最大番号: ${maxNormal}`)

  // 異常レコードを元の管理番号でソート（順序を維持）
  abnormal.sort((a, b) => {
    const aNum = parseInt(String(a.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    const bNum = parseInt(String(b.inventory_number || '0').match(/^(\d+)/)?.[1] || '0', 10)
    return aNum - bNum
  })

  console.log('\n=== 修正対象一覧 ===')
  let nextNumber = maxNormal + 1
  const updates = []
  for (const item of abnormal) {
    const newNum = nextNumber++
    const newMemo = `${newNum}）${item.purchase_total || 0}`
    console.log(`no${item.inventory_number} → no${newNum} | メモ: ${newMemo}`)
    updates.push({
      id: item.id,
      inventory_number: String(newNum),
      memo: newMemo
    })
  }

  console.log(`\n修正件数: ${updates.length}件`)
  console.log(`新しい番号範囲: ${maxNormal + 1} 〜 ${nextNumber - 1}`)

  // 確認プロンプト
  const readline = require('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  rl.question('\n実行しますか？ (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
      console.log('\n更新中...')
      let success = 0
      let failed = 0
      for (const update of updates) {
        const { error } = await supabase
          .from('inventory')
          .update({ inventory_number: update.inventory_number, memo: update.memo })
          .eq('id', update.id)
        if (error) {
          console.error(`Error updating ${update.id}:`, error.message)
          failed++
        } else {
          success++
        }
      }
      console.log(`\n完了: 成功 ${success}件, 失敗 ${failed}件`)
    } else {
      console.log('キャンセルしました')
    }
    rl.close()
  })
}

fix()
