-- 手入力売上から転記されたbulk_salesで、原価回収として扱うべきものを修正
-- purchase_price = deposit_amount にすることで利益が0になる

-- まず対象データを確認
SELECT 
  id,
  product_name,
  sale_amount,
  purchase_price,
  deposit_amount,
  (deposit_amount - purchase_price - COALESCE(other_cost, 0)) as current_profit,
  memo
FROM bulk_sales
WHERE memo LIKE '%手入力売上から転記%'
ORDER BY sale_date DESC;

-- 修正を実行（purchase_price = deposit_amount にする）
-- UPDATE bulk_sales
-- SET purchase_price = deposit_amount
-- WHERE memo LIKE '%手入力売上から転記%';
