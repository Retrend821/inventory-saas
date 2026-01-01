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

  // sale_dateで判定（現在のロジック）
  const unsoldBySaleDate = allInventory.filter(item => {
    if (!item.purchase_date) return false;
    if (!/^\d{4}[-/]\d{2}[-/]\d{2}/.test(item.purchase_date)) return false;
    if (item.sale_date && /^\d{4}[-/]\d{2}[-/]\d{2}/.test(item.sale_date)) return false;
    return true;
  });
  
  // sale_destinationで判定
  const unsoldByDestination = allInventory.filter(item => !item.sale_destination);
  
  // 両方で判定
  const unsoldByBoth = allInventory.filter(item => {
    if (!item.purchase_date) return false;
    if (!/^\d{4}[-/]\d{2}[-/]\d{2}/.test(item.purchase_date)) return false;
    if (item.sale_destination) return false;
    return true;
  });

  console.log('=== 在庫判定の違い ===');
  console.log('sale_date無し（現在のロジック）:');
  console.log('  件数:', unsoldBySaleDate.length);
  console.log('  金額:', unsoldBySaleDate.reduce((s,i) => s + (i.purchase_total||0), 0).toLocaleString(), '円');
  
  console.log('\nsale_destination無し:');
  console.log('  件数:', unsoldByDestination.length);
  console.log('  金額:', unsoldByDestination.reduce((s,i) => s + (i.purchase_total||0), 0).toLocaleString(), '円');
  
  console.log('\n有効日付あり & sale_destination無し:');
  console.log('  件数:', unsoldByBoth.length);
  console.log('  金額:', unsoldByBoth.reduce((s,i) => s + (i.purchase_total||0), 0).toLocaleString(), '円');

  // sale_dateがあるけどsale_destinationがないケース
  const hasDateNoDestination = allInventory.filter(item => 
    item.sale_date && /^\d{4}[-/]\d{2}[-/]\d{2}/.test(item.sale_date) && !item.sale_destination
  );
  console.log('\nsale_dateあり but sale_destinationなし（おかしいデータ）:');
  console.log('  件数:', hasDateNoDestination.length);
}

checkData();
