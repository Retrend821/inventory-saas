const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co';
const supabaseServiceKey = 'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateMemo() {
  console.log('Fetching inventory...');

  // 全在庫を取得
  let allItems = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, inventory_number, purchase_total, memo')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Fetch error:', error);
      break;
    }

    if (data && data.length > 0) {
      allItems = [...allItems, ...data];
      from += pageSize;
      if (data.length < pageSize) break;
    } else {
      break;
    }
  }

  console.log('Total items:', allItems.length);

  // メモが空欄のアイテムのみ抽出（既存のメモは上書きしない）
  const needsUpdate = allItems.filter(item => {
    if (!item.inventory_number) return false;
    return !item.memo || item.memo.trim() === '';
  });

  console.log('Needs update:', needsUpdate.length);

  if (needsUpdate.length === 0) {
    console.log('All memos are already correct!');
    return;
  }

  let success = 0;
  let failed = 0;

  // バッチ処理
  const batchSize = 100;
  for (let i = 0; i < needsUpdate.length; i += batchSize) {
    const batch = needsUpdate.slice(i, i + batchSize);

    // 各アイテムを更新
    for (const item of batch) {
      const newMemo = `${item.inventory_number}）${item.purchase_total || 0}`;

      const { error } = await supabase
        .from('inventory')
        .update({ memo: newMemo })
        .eq('id', item.id);

      if (error) {
        console.log(`Failed: ${item.id}`, error.message);
        failed++;
      } else {
        success++;
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, needsUpdate.length)}/${needsUpdate.length}`);
  }

  console.log('\n=== Migration Complete ===');
  console.log('Success:', success);
  console.log('Failed:', failed);
}

migrateMemo();
