/**
 * 共通型定義
 * アプリケーション全体で使用される型を集約
 */

// ========================================
// 在庫関連
// ========================================

export type InventoryItem = {
  id: string
  inventory_number: string | null
  product_name: string
  brand_name: string | null
  category: string | null
  image_url: string | null
  saved_image_url: string | null
  purchase_price: number | null
  purchase_total: number | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  other_cost: number | null
  deposit_amount: number | null
  status: string
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  purchase_source: string | null
  sale_destination: string | null
  memo: string | null
  created_at: string
  refund_status: string | null
  refund_date: string | null
  refund_amount: number | null
  profit: number | null
  profit_rate: number | null
  turnover_days: number | null
}

export type InventoryStatus = 'in_stock' | 'listed' | 'sold' | 'refund_pending' | 'refund_completed'

// ========================================
// 売上関連
// ========================================

export type ManualSale = {
  id: string
  inventory_number: string | null
  product_name: string
  brand_name: string | null
  category: string | null
  purchase_price: number | null
  purchase_total: number | null
  sale_price: number | null
  commission: number | null
  shipping_cost: number | null
  other_cost: number | null
  deposit_amount: number | null
  purchase_date: string | null
  listing_date: string | null
  sale_date: string | null
  purchase_source: string | null
  sale_destination: string | null
  memo: string | null
  profit: number | null
  profit_rate: number | null
  turnover_days: number | null
  sale_type: 'main' | 'bulk'
  image_url: string | null
  cost_recovered: boolean | null
  created_at: string
}

// ========================================
// まとめ仕入れ関連
// ========================================

export type BulkPurchase = {
  id: string
  purchase_date: string
  genre: string
  supplier: string
  quantity: number
  total_cost: number
  memo: string | null
  created_at: string
}

export type BulkSale = {
  id: string
  bulk_purchase_id: string
  sale_date: string
  platform: string
  sale_price: number
  commission: number
  shipping_cost: number
  other_cost: number | null
  deposit_amount: number | null
  quantity: number
  product_name: string | null
  memo: string | null
  profit: number | null
  cost_recovered: boolean | null
  created_at: string
}

// ========================================
// マスタ関連
// ========================================

export type Platform = {
  id: string
  name: string
  color_class: string
  commission_rate: number
  sales_type: 'toB' | 'toC'
  sort_order: number
  is_active: boolean
  is_hidden: boolean
  created_at: string
  // 古物台帳用フィールド
  address: string | null
  representative_name: string | null
  occupation: string | null
  phone: string | null
  email: string | null
  website: string | null
  verification_method: string | null
  is_anonymous: boolean
}

export type PlatformSimple = {
  id: string
  name: string
  color_class: string
}

export type Supplier = {
  id: string
  name: string
  color_class: string
  sort_order: number
  is_active: boolean
  is_hidden: boolean
  created_at: string
  // 古物台帳用フィールド
  address: string | null
  representative_name: string | null
  occupation: string | null
  phone: string | null
  email: string | null
  website: string | null
  verification_method: string | null
  is_anonymous: boolean
}

export type SupplierSimple = {
  id: string
  name: string
  color_class: string
}

// ========================================
// 目標関連
// ========================================

export type MonthlyGoal = {
  id: string
  year_month: string
  sales_goal: number | null
  profit_goal: number | null
  created_at: string
}

// ========================================
// ユーザー関連
// ========================================

export type UserTodo = {
  id: string
  user_id: string
  content: string
  is_completed: boolean
  created_at: string
}

// ========================================
// CSVインポート用型
// ========================================

export type YahooAuctionCSV = {
  'オークション画像URL': string
  '商品名': string
  '落札価格': string
  '終了日時': string
  '出品者ID': string
  '最新のメッセージ': string
}

export type EcoAucCSV = {
  buyout_number: string
  item_name: string
  bid_price: string
  bid_price_tax: string
  purchase_commission: string
  purchase_commission_tax: string
  buy_total: string
  image_01: string
}

export type StarBuyersCSV = {
  '開催日': string
  'オークション名': string
  'カテゴリ': string
  'ロット番号': string
  '管理番号': string
  '商品ID': string
  '商品名': string
  '落札金額': string
  '消費税（落札）': string
  '手数料': string
  '消費税（手数料）': string
  '越境事務手数料': string
  '消費税（越境事務手数料）': string
  '合計': string
  '写真希望（希望の場合は〇）': string
  '配送方法': string
}

export type SecondStreetCSV = {
  '購入日(YYYY/MM/DD)': string
  'お支払い金額': string
  'ブランド名': string
  '商品名': string
  '画像URL': string
}

export type MonobankCSV = {
  '分類': string
  '取引日': string
  '箱番': string
  '枝番': string
  'カテゴリー': string
  '中分類': string
  'ブランド': string
  '個数': string
  '素材': string
  '詳細': string
  '備考': string
  'コメント': string
  '付属品': string
  '金額': string
}

// ========================================
// 送料関連
// ========================================

export type ShippingMethod = {
  id: string
  name: string
  size_60: number | null
  size_80: number | null
  size_100: number | null
  size_120: number | null
  size_140: number | null
  size_160: number | null
  size_180: number | null
  size_200: number | null
  notes: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

// ========================================
// 統合売上型（分析用）
// ========================================

export type UnifiedSale = {
  id: string
  source: 'inventory' | 'manual' | 'bulk'
  sale_date: string
  product_name: string
  brand_name: string | null
  category: string | null
  purchase_source: string | null
  sale_destination: string
  sale_price: number
  purchase_price: number
  commission: number
  shipping_cost: number
  other_cost: number
  profit: number
  profit_rate: number
  turnover_days: number | null
  quantity: number
}
