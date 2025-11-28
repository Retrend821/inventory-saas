-- まとめ仕入れマスタ
CREATE TABLE IF NOT EXISTS bulk_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  genre VARCHAR(100) NOT NULL,           -- ジャンル（ネクタイ、スカーフなど）
  purchase_date DATE NOT NULL,            -- 仕入日
  purchase_source VARCHAR(100),           -- 仕入先
  total_amount INTEGER NOT NULL,          -- 仕入総額
  total_quantity INTEGER NOT NULL,        -- 総数量
  unit_cost INTEGER GENERATED ALWAYS AS (CASE WHEN total_quantity > 0 THEN total_amount / total_quantity ELSE 0 END) STORED,  -- 1個あたり原価（自動計算）
  memo TEXT,                              -- メモ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- まとめ仕入れ売上履歴
CREATE TABLE IF NOT EXISTS bulk_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bulk_purchase_id UUID NOT NULL REFERENCES bulk_purchases(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,                -- 売却日
  sale_destination VARCHAR(100),          -- 販売先（販路）
  quantity INTEGER NOT NULL,              -- 販売数量
  sale_amount INTEGER NOT NULL,           -- 売上額
  commission INTEGER DEFAULT 0,           -- 手数料
  shipping_cost INTEGER DEFAULT 0,        -- 送料
  memo TEXT,                              -- メモ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_bulk_purchases_genre ON bulk_purchases(genre);
CREATE INDEX IF NOT EXISTS idx_bulk_purchases_purchase_date ON bulk_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_bulk_sales_bulk_purchase_id ON bulk_sales(bulk_purchase_id);
CREATE INDEX IF NOT EXISTS idx_bulk_sales_sale_date ON bulk_sales(sale_date);
