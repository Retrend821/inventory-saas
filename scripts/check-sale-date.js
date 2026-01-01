const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co';
const supabaseServiceKey = 'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
  let allInventory = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, purchase_total, sale_date, purchase_date, sale_destination')
      .range(from, from + pageSize - 1);

    if (error) break;
    if (data && data.length > 0) {
      allInventory = [...allInventory, ...data];
      from += pageSize;
      if (data.length < pageSize) break;
    } else break;
  }

  // sale_dateの値の種類を集計
  const saleDateValues = {};
  allInventory.forEach(item => {
    const val = item.sale_date || '(空)';
    saleDateValues[val] = (saleDateValues[val] || 0) + 1;
  });

  console.log('=== sale_dateの値の分布 ===');
  Object.entries(saleDateValues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([val, count]) => {
      console.log(count + '件: ' + val);
    });

  // 未販売タブの判定（!sale_date && sale_destination !== '返品'）
  const unsoldByTab = allInventory.filter(i => !i.sale_date && i.sale_destination !== '返品');
  const tabValue = unsoldByTab.reduce((s, i) => s + (i.purchase_total || 0), 0);

  // 集計ページの判定（isValidDate）
  const isValidDate = (dateStr) => {
    if (!dateStr) return false;
    if (/返品|不明|キャンセル/.test(dateStr)) return false;
    return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr);
  };

  const unsoldBySummary = allInventory.filter(i => {
    if (!i.purchase_date) return false;
    if (!isValidDate(i.purchase_date)) return false;
    // sale_dateが無効なら「未売却」と判定
    if (!isValidDate(i.sale_date)) return true;
    return false;
  });
  const summaryValue = unsoldBySummary.reduce((s, i) => s + (i.purchase_total || 0), 0);

  console.log('\n=== 判定の違い ===');
  console.log('未販売タブ (!sale_date): ' + unsoldByTab.length + '件, ' + tabValue.toLocaleString() + '円');
  console.log('集計ページ (isValidDate): ' + unsoldBySummary.length + '件, ' + summaryValue.toLocaleString() + '円');
  console.log('差分: ' + (unsoldBySummary.length - unsoldByTab.length) + '件, ' + (summaryValue - tabValue).toLocaleString() + '円');

  // 差分の内訳（集計では在庫だが、タブでは在庫でないもの）
  const diff = unsoldBySummary.filter(i => !unsoldByTab.includes(i));
  console.log('\n=== 差分の内訳（集計のみ在庫扱い）===');
  const diffByReason = {};
  diff.forEach(item => {
    const reason = item.sale_date ? 'sale_date=' + item.sale_date : (item.sale_destination === '返品' ? '返品' : 'その他');
    diffByReason[reason] = (diffByReason[reason] || 0) + 1;
  });
  Object.entries(diffByReason).forEach(([reason, count]) => {
    console.log(count + '件: ' + reason);
  });
}

checkData();
