-- Add turnover goal columns to monthly_goals table
ALTER TABLE monthly_goals
ADD COLUMN IF NOT EXISTS stock_count_turnover_goal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_turnover_goal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_turnover_goal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS overall_profitability_goal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS gmri_goal numeric DEFAULT 0;
