-- 誤って保存されたprofit, profit_rate値をNULLにリセット
-- これにより、アプリ側で常に正しく計算されるようになります

-- inventoryテーブルのprofit, profit_rateをNULLにリセット
UPDATE inventory
SET profit = NULL, profit_rate = NULL
WHERE profit IS NOT NULL OR profit_rate IS NOT NULL;

-- 確認用クエリ（更新後に実行）
-- SELECT id, inventory_number, product_name, deposit_amount, purchase_total, other_cost, profit, profit_rate
-- FROM inventory
-- WHERE profit IS NOT NULL
-- LIMIT 10;
