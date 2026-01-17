-- 売り上げ明細専用テーブルを作成
-- inventory, bulk_sales, manual_sales から切り離して独立管理

CREATE TABLE IF NOT EXISTS sales_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 元データの追跡用（重複防止）
  source_type TEXT NOT NULL CHECK (source_type IN ('single', 'bulk', 'manual')),
  source_id TEXT NOT NULL,

  -- 商品情報
  inventory_number TEXT,
  product_name TEXT NOT NULL DEFAULT '',
  brand_name TEXT,
  category TEXT,
  image_url TEXT,

  -- 取引情報
  purchase_source TEXT,
  sale_destination TEXT,

  -- 金額情報
  sale_price NUMERIC DEFAULT 0,
  commission NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  other_cost NUMERIC DEFAULT 0,
  purchase_price NUMERIC DEFAULT 0,
  purchase_cost NUMERIC DEFAULT 0,
  deposit_amount NUMERIC,
  profit NUMERIC DEFAULT 0,
  profit_rate NUMERIC DEFAULT 0,

  -- 日付情報
  purchase_date DATE,
  listing_date DATE,
  sale_date DATE,
  turnover_days INTEGER,

  -- その他
  memo TEXT,
  quantity INTEGER DEFAULT 1,

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 重複防止（同じ元データからの二重登録を防ぐ）
  UNIQUE (source_type, source_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_sales_summary_sale_date ON sales_summary(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_summary_source ON sales_summary(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_sales_summary_sale_destination ON sales_summary(sale_destination);
CREATE INDEX IF NOT EXISTS idx_sales_summary_purchase_source ON sales_summary(purchase_source);

-- RLS（Row Level Security）ポリシー
ALTER TABLE sales_summary ENABLE ROW LEVEL SECURITY;

-- 全ユーザーに読み取り・書き込み許可（認証済みユーザー）
CREATE POLICY "Enable all access for authenticated users" ON sales_summary
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 匿名ユーザーにも読み取り許可（必要に応じて）
CREATE POLICY "Enable read access for anon users" ON sales_summary
  FOR SELECT
  TO anon
  USING (true);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_sales_summary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_summary_updated_at
  BEFORE UPDATE ON sales_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_summary_updated_at();
