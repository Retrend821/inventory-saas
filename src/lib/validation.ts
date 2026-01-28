import { z } from 'zod'

/**
 * バリデーションスキーマ
 * フォーム入力値の検証に使用
 */

// 在庫データのバリデーション
export const inventorySchema = z.object({
  product_name: z.string().min(1, '商品名は必須です'),
  brand_name: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  purchase_price: z.number().min(0, '仕入価格は0以上で入力してください').nullable().optional(),
  purchase_total: z.number().min(0, '仕入総額は0以上で入力してください').nullable().optional(),
  sale_price: z.number().min(0, '売価は0以上で入力してください').nullable().optional(),
  commission: z.number().min(0, '手数料は0以上で入力してください').nullable().optional(),
  shipping_cost: z.number().min(0, '送料は0以上で入力してください').nullable().optional(),
  other_cost: z.number().min(0, 'その他費用は0以上で入力してください').nullable().optional(),
  deposit_amount: z.number().min(0, '入金額は0以上で入力してください').nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  listing_date: z.string().nullable().optional(),
  sale_date: z.string().nullable().optional(),
  purchase_source: z.string().nullable().optional(),
  sale_destination: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
})

// 売上データのバリデーション
export const manualSaleSchema = z.object({
  product_name: z.string().min(1, '商品名は必須です'),
  brand_name: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  purchase_price: z.number().min(0, '仕入価格は0以上で入力してください').nullable().optional(),
  purchase_total: z.number().min(0, '仕入総額は0以上で入力してください').nullable().optional(),
  sale_price: z.number().min(0, '売価は0以上で入力してください').nullable().optional(),
  commission: z.number().min(0, '手数料は0以上で入力してください').nullable().optional(),
  shipping_cost: z.number().min(0, '送料は0以上で入力してください').nullable().optional(),
  other_cost: z.number().min(0, 'その他費用は0以上で入力してください').nullable().optional(),
  deposit_amount: z.number().min(0, '入金額は0以上で入力してください').nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  listing_date: z.string().nullable().optional(),
  sale_date: z.string().nullable().optional(),
  purchase_source: z.string().nullable().optional(),
  sale_destination: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
})

// まとめ仕入れのバリデーション
export const bulkPurchaseSchema = z.object({
  purchase_date: z.string().min(1, '仕入日は必須です'),
  genre: z.string().min(1, 'ジャンルは必須です'),
  supplier: z.string().min(1, '仕入先は必須です'),
  quantity: z.number().min(1, '数量は1以上で入力してください'),
  total_cost: z.number().min(0, '仕入金額は0以上で入力してください'),
  memo: z.string().nullable().optional(),
})

// まとめ売上のバリデーション
export const bulkSaleSchema = z.object({
  sale_date: z.string().min(1, '売却日は必須です'),
  platform: z.string().min(1, '販売先は必須です'),
  sale_price: z.number().min(0, '売価は0以上で入力してください'),
  commission: z.number().min(0, '手数料は0以上で入力してください'),
  shipping_cost: z.number().min(0, '送料は0以上で入力してください'),
  other_cost: z.number().min(0, 'その他費用は0以上で入力してください').nullable().optional(),
  deposit_amount: z.number().min(0, '入金額は0以上で入力してください').nullable().optional(),
  quantity: z.number().min(1, '数量は1以上で入力してください'),
  product_name: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
})

// 型をエクスポート
export type InventoryInput = z.infer<typeof inventorySchema>
export type ManualSaleInput = z.infer<typeof manualSaleSchema>
export type BulkPurchaseInput = z.infer<typeof bulkPurchaseSchema>
export type BulkSaleInput = z.infer<typeof bulkSaleSchema>

/**
 * バリデーションヘルパー関数
 * 既存のコードに影響を与えずにバリデーションを追加できる
 */
export function validateInventory(data: unknown): { success: true; data: InventoryInput } | { success: false; errors: string[] } {
  const result = inventorySchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map(e => e.message)
  }
}

export function validateManualSale(data: unknown): { success: true; data: ManualSaleInput } | { success: false; errors: string[] } {
  const result = manualSaleSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map(e => e.message)
  }
}

export function validateBulkPurchase(data: unknown): { success: true; data: BulkPurchaseInput } | { success: false; errors: string[] } {
  const result = bulkPurchaseSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map(e => e.message)
  }
}

export function validateBulkSale(data: unknown): { success: true; data: BulkSaleInput } | { success: false; errors: string[] } {
  const result = bulkSaleSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map(e => e.message)
  }
}

/**
 * 数値フィールドのバリデーション（単一フィールド用）
 * インライン編集時に使用
 */
export function validateNumber(value: string | number | null | undefined, fieldName: string): { valid: true; value: number | null } | { valid: false; error: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: true, value: null }
  }

  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName}は数値で入力してください` }
  }

  if (num < 0) {
    return { valid: false, error: `${fieldName}は0以上で入力してください` }
  }

  return { valid: true, value: num }
}

/**
 * 日付フィールドのバリデーション
 */
export function validateDate(value: string | null | undefined): { valid: true; value: string | null } | { valid: false; error: string } {
  if (!value || value === '') {
    return { valid: true, value: null }
  }

  // YYYY-MM-DD形式のチェック
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(value)) {
    return { valid: false, error: '日付はYYYY-MM-DD形式で入力してください' }
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return { valid: false, error: '無効な日付です' }
  }

  return { valid: true, value }
}
