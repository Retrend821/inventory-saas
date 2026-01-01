const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co';
const supabaseServiceKey = 'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const isValidDate = (dateStr) => {
  if (!dateStr) return false;
  if (/返品|不明|キャンセル/.test(dateStr)) return false;
  return /^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr);
};

const normalizeYearMonth = (dateStr) => {
  return dateStr.substring(0, 7).replace('/', '-');
};

async function checkProfit() {
  // inventory取得
  let allInventory = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) break;
    if (data && data.length > 0) {
      allInventory = [...allInventory, ...data];
      from += pageSize;
      if (data.length < pageSize) break;
    } else break;
  }

  // manual_sales取得
  const { data: manualSales } = await supabase
    .from('manual_sales')
    .select('*');

  // bulk_sales取得
  const { data: bulkSales } = await supabase
    .from('bulk_sales')
    .select('*');

  console.log('=== データ件数 ===');
  console.log('inventory:', allInventory.length);
  console.log('manual_sales:', (manualSales || []).length);
  console.log('bulk_sales:', (bulkSales || []).length);

  // 2025年の月別利益を計算
  const year = '2025';
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  console.log('\n=== 2025年 月別利益 ===');

  for (const month of months) {
    const yearMonth = year + '-' + month;

    // inventory（返品除く）
    const invSold = allInventory.filter(item => {
      if (!isValidDate(item.sale_date)) return false;
      if (item.sale_destination === '返品') return false;
      return normalizeYearMonth(item.sale_date) === yearMonth;
    });

    const invSales = invSold.reduce((s, i) => s + (i.sale_price || 0), 0);
    const invCommission = invSold.reduce((s, i) => s + (i.commission || 0), 0);
    const invShipping = invSold.reduce((s, i) => s + (i.shipping_cost || 0), 0);
    const invPurchase = invSold.reduce((s, i) => s + (i.purchase_total || 0), 0);
    const invProfit = invSales - invCommission - invShipping - invPurchase;

    // manual_sales
    const manualSold = (manualSales || []).filter(item => {
      if (!isValidDate(item.sale_date)) return false;
      return normalizeYearMonth(item.sale_date) === yearMonth;
    });

    const manualSalesTotal = manualSold.reduce((s, i) => s + (i.sale_price || 0), 0);
    const manualCommission = manualSold.reduce((s, i) => s + (i.commission || 0), 0);
    const manualShipping = manualSold.reduce((s, i) => s + (i.shipping_cost || 0), 0);
    const manualPurchase = manualSold.reduce((s, i) => s + (i.purchase_total || 0), 0);
    const manualProfit = manualSalesTotal - manualCommission - manualShipping - manualPurchase;

    // manual_salesのprofit列の合計（DBに保存された値）
    const manualStoredProfit = manualSold.reduce((s, i) => s + (i.profit || 0), 0);

    // 原価回収の件数
    const costRecoveredCount = manualSold.filter(i => i.cost_recovered).length;

    const totalProfit = invProfit + manualProfit;

    console.log(parseInt(month) + '月: inv=' + invSold.length + '件 ¥' + invProfit.toLocaleString() +
      ' + manual=' + manualSold.length + '件 ¥' + manualProfit.toLocaleString() +
      ' (stored:¥' + manualStoredProfit.toLocaleString() + ', 原価回収:' + costRecoveredCount + '件)' +
      ' = ¥' + totalProfit.toLocaleString());
  }

  // bulk_salesの月別集計
  console.log('\n=== bulk_sales 月別 ===');
  for (const month of months) {
    const yearMonth = year + '-' + month;
    const bs = (bulkSales || []).filter(s => s.sale_date && s.sale_date.startsWith(yearMonth));
    if (bs.length > 0) {
      console.log(parseInt(month) + '月: ' + bs.length + '件');
    }
  }
}

checkProfit();
