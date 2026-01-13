// ユーザー権限設定

// 管理者（全機能使用可能）
export const ADMIN_EMAIL = 'retrend.brand@gmail.com'

// 閲覧専用ユーザー（ホワイトリスト）
// メールアドレスを入力するだけでログイン可能、閲覧のみ
export const VIEWER_EMAILS = [
  'd.sakurai1993@gmail.com',
]

// ユーザーが管理者かどうか
export function isAdmin(email: string | undefined | null): boolean {
  return email === ADMIN_EMAIL
}

// ユーザーが閲覧専用かどうか
export function isViewer(email: string | undefined | null): boolean {
  if (!email) return false
  return VIEWER_EMAILS.includes(email)
}

// ユーザーが編集権限を持っているか（管理者のみ）
export function canEdit(email: string | undefined | null): boolean {
  return isAdmin(email)
}
