-- 日付カラムをTEXT型に変更（日付と文字列の両方を保存できるようにする）

ALTER TABLE inventory
  ALTER COLUMN purchase_date TYPE TEXT,
  ALTER COLUMN listing_date TYPE TEXT,
  ALTER COLUMN sale_date TYPE TEXT;
