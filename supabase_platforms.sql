-- 販路マスタテーブル
-- Supabaseのダッシュボードで実行してください

CREATE TABLE IF NOT EXISTS platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,           -- 販路名
  color_class VARCHAR(200),                   -- Tailwindのカラークラス
  sort_order INT DEFAULT 0,                   -- 表示順
  is_active BOOLEAN DEFAULT true,             -- 有効/無効
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLSを有効にする
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;

-- 全員に読み書きを許可（認証なしの場合）
CREATE POLICY "Allow all access" ON platforms
  FOR ALL USING (true) WITH CHECK (true);
