const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co';
const supabaseServiceKey = 'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
  // inventoryを全件取得
  let allInventory = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, purchase_total, sale_date, purchase_date, sale_destination')
      .range(from, from + pageSize - 1);

    if (error) {
      console.log('Error:', error);
      break;
    }

    if (data && data.length > 0) {
      allInventory = [...allInventory, ...data];
      from += pageSize;
      if (data.length < pageSize) break;
    } else {
      break;
    }
  }

  // 未売却 = sale_destinationが空のもの
  const unsoldInventory = allInventory.filter(item => !item.sale_destination);
  const inventoryValue = unsoldInventory.reduce((sum, item) => sum + (item.purchase_total || 0), 0);

  // 有効な仕入日がある未売却在庫
  const validUnsold = unsoldInventory.filter(item => item.purchase_date && /^\d{4}[-/]\d{2}[-/]\d{2}/.test(item.purchase_date));
  const validInventoryValue = validUnsold.reduce((sum, item) => sum + (item.purchase_total || 0), 0);

  console.log('=== 単品在庫 (inventory) ===');
  console.log('全件数:', allInventory.length);
  console.log('未売却件数:', unsoldInventory.length);
  console.log('有効な仕入日付きの未売却:', validUnsold.length);
  console.log('未売却在庫金額:', inventoryValue.toLocaleString(), '円');
  console.log('有効日付の在庫金額:', validInventoryValue.toLocaleString(), '円');

  // bulk_purchases
  const { data: bulkPurchases } = await supabase
    .from('bulk_purchases')
    .select('*');

  const { data: bulkSales } = await supabase
    .from('bulk_sales')
    .select('*');

  console.log('\n=== まとめ仕入れ詳細 ===');
  let bulkRemainingValue = 0;
  let bulkRemainingCount = 0;
  (bulkPurchases || []).forEach(bp => {
    const soldQty = (bulkSales || [])
      .filter(s => s.bulk_purchase_id === bp.id)
      .reduce((sum, s) => sum + s.quantity, 0);
    const remaining = bp.total_quantity - soldQty;
    const unitCost = bp.total_quantity > 0 ? bp.total_amount / bp.total_quantity : 0;
    const remainingValue = unitCost * remaining;
    bulkRemainingValue += remainingValue;
    bulkRemainingCount += remaining;

    console.log('- ' + bp.genre + ': 仕入' + bp.total_quantity + '個 売上' + soldQty + '個 残' + remaining + '個 (単価' + Math.round(unitCost) + '円 残高' + Math.round(remainingValue).toLocaleString() + '円)');
  });

  console.log('\n=== 合計推定（現時点）===');
  console.log('単品在庫（有効日付）:', validInventoryValue.toLocaleString(), '円');
  console.log('まとめ残在庫:', Math.round(bulkRemainingValue).toLocaleString(), '円');
  console.log('合計:', (validInventoryValue + Math.round(bulkRemainingValue)).toLocaleString(), '円');
}

checkData();
