-- ラクマ手数料設定テーブル
-- Supabaseのダッシュボードで実行してください

CREATE TABLE IF NOT EXISTS rakuma_commission_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year_month VARCHAR(7) NOT NULL UNIQUE, -- 例: '2024-01'
  commission_rate DECIMAL(5, 2) NOT NULL, -- 例: 10.00 (10%)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLSを有効にする（必要に応じて）
ALTER TABLE rakuma_commission_settings ENABLE ROW LEVEL SECURITY;

-- 全員に読み書きを許可（認証なしの場合）
CREATE POLICY "Allow all access" ON rakuma_commission_settings
  FOR ALL USING (true) WITH CHECK (true);
