// 一回限りの変換スクリプト: エコリング → エコオク
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impld2xhbnFmbHVyY3FyZW1hbnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODY2NDgsImV4cCI6MjA3OTY2MjY0OH0.eZiO_lkE7dM5ih3kHjrLCeaQ5ozpilRwTVgLsLnCp8I'

const supabase = createClient(supabaseUrl, supabaseKey)

async function convertEcoringToEcoauc() {
  console.log('エコリング → エコオク 変換を開始します...')

  // まず対象件数を確認
  const { data: countData, error: countError } = await supabase
    .from('inventory')
    .select('id', { count: 'exact' })
    .eq('purchase_source', 'エコリング')

  if (countError) {
    console.error('件数確認エラー:', countError)
    return
  }

  console.log(`変換対象: ${countData?.length || 0}件`)

  if (!countData || countData.length === 0) {
    console.log('変換対象のデータがありません')
    return
  }

  // 一括更新
  const { data, error } = await supabase
    .from('inventory')
    .update({ purchase_source: 'エコオク' })
    .eq('purchase_source', 'エコリング')
    .select()

  if (error) {
    console.error('更新エラー:', error)
    return
  }

  console.log(`変換完了: ${data?.length || 0}件を「エコオク」に変換しました`)
}

convertEcoringToEcoauc()
