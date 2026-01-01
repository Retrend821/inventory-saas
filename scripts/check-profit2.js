const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co';
const supabaseServiceKey = 'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProfit() {
  // bulk_sales取得
  const { data: bulkSales } = await supabase.from('bulk_sales').select('*');
  const { data: bulkPurchases } = await supabase.from('bulk_purchases').select('*');

  console.log('=== bulk_sales詳細 ===');
  (bulkSales || []).forEach(s => {
    const bp = (bulkPurchases || []).find(p => p.id === s.bulk_purchase_id);
    const unitCost = bp ? (bp.total_quantity > 0 ? bp.total_amount / bp.total_quantity : 0) : 0;
    const purchaseCost = unitCost * s.quantity;
    const profit = s.sale_amount - purchaseCost - s.commission - s.shipping_cost;
    console.log('sale_date: ' + s.sale_date + ', sale_amount: ' + s.sale_amount + 
      ', qty: ' + s.quantity + ', cost: ' + Math.round(purchaseCost) + 
      ', commission: ' + s.commission + ', shipping: ' + s.shipping_cost +
      ', profit: ' + Math.round(profit));
  });
}

checkProfit();
