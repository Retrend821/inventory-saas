-- 単品在庫テーブル
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 仕入れ情報
  product_name VARCHAR(500) NOT NULL,           -- 商品名
  brand_name VARCHAR(100),                      -- ブランド名
  category VARCHAR(100),                        -- カテゴリ
  supplier VARCHAR(100),                        -- 仕入先
  purchase_date DATE,                           -- 仕入日
  purchase_price INTEGER,                       -- 仕入価格
  other_cost INTEGER DEFAULT 0,                 -- その他経費

  -- 管理情報
  inventory_number VARCHAR(50),                 -- 管理番号
  image_url TEXT,                               -- 画像URL
  status VARCHAR(20) DEFAULT 'in_stock',        -- ステータス: in_stock, listed, sold
  memo TEXT,                                    -- メモ

  -- 出品情報
  listing_date DATE,                            -- 出品日
  listing_price INTEGER,                        -- 出品価格

  -- 売却情報
  sale_date DATE,                               -- 売却日
  sale_destination VARCHAR(100),                -- 販売先（販路）
  sale_price INTEGER,                           -- 売価
  commission INTEGER DEFAULT 0,                 -- 手数料
  shipping_cost INTEGER DEFAULT 0,              -- 送料
  deposit_amount INTEGER,                       -- 入金額

  -- 利益計算（自動）
  profit INTEGER GENERATED ALWAYS AS (
    COALESCE(sale_price, 0) - COALESCE(purchase_price, 0) - COALESCE(other_cost, 0) - COALESCE(commission, 0) - COALESCE(shipping_cost, 0)
  ) STORED,

  -- 外部連携用（重複チェック）
  external_id VARCHAR(200),                     -- 外部システムのID（GmailのmessageIdなど）
  external_source VARCHAR(50),                  -- 外部ソース（kaitorioukoku, shopify等）

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier ON inventory(supplier);
CREATE INDEX IF NOT EXISTS idx_inventory_brand_name ON inventory(brand_name);
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_date ON inventory(purchase_date);
CREATE INDEX IF NOT EXISTS idx_inventory_sale_date ON inventory(sale_date);
CREATE INDEX IF NOT EXISTS idx_inventory_external_id ON inventory(external_id);

-- 外部ID + ソースでユニーク制約（重複防止）
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_external_unique
  ON inventory(external_source, external_id)
  WHERE external_id IS NOT NULL;

-- RLS設定
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON inventory
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();
