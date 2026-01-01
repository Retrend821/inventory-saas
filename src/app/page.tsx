'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo, startTransition, useDeferredValue } from 'react'
import { useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import Papa from 'papaparse'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type InventoryItem = {
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

type YahooAuctionCSV = {
  'オークション画像URL': string
  '商品名': string
  '落札価格': string
  '終了日時': string
  '出品者ID': string
  '最新のメッセージ': string
}

type EcoAucCSV = {
  buyout_number: string
  item_name: string
  bid_price: string
  bid_price_tax: string
  purchase_commission: string
  purchase_commission_tax: string
  buy_total: string
  image_01: string
}

type StarBuyersCSV = {
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

type SecondStreetCSV = {
  '購入日(YYYY/MM/DD)': string
  'お支払い金額': string
  'ブランド名': string
  '商品名': string
  '画像URL': string
}

type MonobankCSV = {
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

// ブランド変換辞書
const brandDictionary: Record<string, string[]> = {
  "エルメス": ["hermes", "hermès", "えるめす", "エルメス"],
  "ルイヴィトン": ["louisvuitton", "louis vuitton", "るいゔぃとん", "ルイヴィトン", "ヴィトン", "vuitton"],
  "シャネル": ["chanel", "しゃねる", "シャネル"],
  "グッチ": ["gucci", "ぐっち", "グッチ"],
  "プラダ": ["prada", "ぷらだ", "プラダ"],
  "フェンディ": ["fendi", "ふぇんでぃ", "フェンディ"],
  "ボッテガヴェネタ": ["bottegaveneta", "bottega veneta", "ぼってが", "ボッテガヴェネタ", "ボッテガ"],
  "ロエベ": ["loewe", "ろえべ", "ロエベ"],
  "セリーヌ": ["celine", "céline", "せりーぬ", "セリーヌ", "セリンヌ"],
  "ディオール": ["dior", "christiandior", "christian dior", "cdior", "ディオール", "クリスチャンディオール"],
  "サンローラン": ["ysl", "yvessaintlaurent", "yves saint laurent", "saintlaurent", "saint laurent", "slp", "サンローラン", "イヴサンローラン", "イヴ・サン・ローラン", "イブサンローラン"],
  "バーバリー": ["burberry", "burberrys", "バーバリー", "バーバリーズ"],
  "ヴァレンティノ": ["valentino", "valentino garavani", "ヴァレンティノ", "バレンティノ"],
  "ヴェルサーチ": ["versace", "gianniversace", "ヴェルサーチ", "ヴェルサーチェ"],
  "フェラガモ": ["ferragamo", "salvatoreferragamo", "サルヴァトーレフェラガモ", "フェラガモ"],
  "ジバンシィ": ["givenchy", "gibanchi", "ジバンシィ", "ジバンシー"],
  "ブルガリ": ["bvlgari", "bulgari", "ブルガリ"],
  "ブリオーニ": ["brioni", "ブリオーニ"],
  "ゼニア": ["zegna", "ermenegildozegna", "エルメネジルドゼニア", "ゼニア", "エルメネジルド ゼニア"],
  "ブリックハウス": ["brickhouse", "ブリックハウス"],
  "ブルックスブラザーズ": ["brooksbrothers", "ブルックスブラザーズ", "ブルックス"],
  "ラルフローレン": ["ralphlauren", "ralph lauren", "poloralphlauren", "polo ralph lauren", "ラルフローレン", "ポロラルフローレン"],
  "トミーヒルフィガー": ["tommyhilfiger", "tommy hilfiger", "トミーヒルフィガー", "トミー"],
  "タケオキクチ": ["takeokikuchi", "takeo kikuchi", "タケオキクチ"],
  "ダックス": ["daks", "ダックス"],
  "ダンヒル": ["dunhill", "ダンヒル"],
  "カルバンクライン": ["calvinklein", "calvin klein", "カルバンクライン", "カルヴァンクライン"],
  "ポールスミス": ["paulsmith", "paul smith", "ポールスミス"],
  "ポールスチュアート": ["paulstuart", "paul stuart", "ポールスチュアート"],
  "ピエールカルダン": ["pierrecardin", "pierre cardin", "ピエールカルダン", "ピエカ"],
  "ピエールバルマン": ["pierrebalmain", "pierre balmain", "ピエールバルマン", "バルマン"],
  "ミラショーン": ["milaschön", "mila schon", "milaschon", "ミラショーン"],
  "ミッソーニ": ["missoni", "ミッソーニ"],
  "エトロ": ["etro", "エトロ"],
  "イッセイミヤケ": ["isseymiyake", "issey miyake", "イッセイミヤケ"],
  "コムデギャルソン": ["commedesgarcons", "comme des garcons", "cdg", "コムデギャルソン"],
  "ヨウジヤマモト": ["yohjiyamamoto", "yohji yamamoto", "ヨウジヤマモト", "ヨージヤマモト"],
  "アクアスキュータム": ["aquascutum", "アクアスキュータム"],
  "MCM": ["mcm", "エムシーエム"],
  "ヴィヴィアンウエストウッド": ["viviennewestwood", "vivienne westwood", "ヴィヴィアン", "ヴィヴィアンウエストウッド"],
  "ロンシャン": ["longchamp", "ロンシャン"],
  "カルティエ": ["cartier", "カルティエ"],
  "ハンティングワールド": ["huntingworld", "ハンティングワールド"],
  "ランバン": ["lanvin", "ランバン"],
  "ランセル": ["lancel", "ランセル"],
  "ケンゾー": ["kenzo", "ケンゾー"],
  "マイケルコース": ["michaelkors", "michael kors", "マイケルコース"],
  "モスキーノ": ["moschino", "モスキーノ"],
  "トラサルディ": ["trussardi", "トラサルディ"],
  "ジムトンプソン": ["jimthompson", "jim thompson", "ジムトンプソン"],
  "ジャンフランコフェレ": ["gianfrancoferre", "gianfranco ferré", "gianfranco ferre", "ジャンフランコフェレ", "フェレ"],
  "ダーバン": ["durban", "ダーバン"],
  "セオリー": ["theory", "セオリー"],
  "プリマクラッセ": ["primaclasse", "prima classe", "プリマクラッセ"],
  "レノマ": ["renoma", "レノマ"],
  "レオナール": ["leonard", "レオナール"],
  "ニューヨーカー": ["newyorker", "ニューヨーカー"],
  "ノーティカ": ["nautica", "ノーティカ"],
  "シャルルジョルダン": ["charlesjourdan", "charles jourdan", "シャルルジョルダン"],
  "ジェイプレス": ["jpress", "j. press", "j press", "ジェイプレス"],
  "アテストーニ": ["testoni", "a.testoni", "テストーニ"],
  "アラミス": ["aramis", "アラミス"],
  "アルマーニ": ["armani", "giorgioarmani", "emporioarmani", "ea7", "アルマーニ", "ジョルジオアルマーニ", "エンポリオアルマーニ"],
  "ドミニクフランス": ["dominique france", "dominiquefrance", "ドミニクフランス"],
  "パスカルフェロー": ["pascal ferreaux", "pascalferreaux", "パスカルフェロー", "パスカル フェロー"],
  "ダナキャラン": ["donnakaran", "donna karan", "dkny", "ダナキャラン", "ディーケーエヌワイ"],
  "デュポン": ["s.t.dupont", "s t dupont", "デュポン", "dupont"],
  "鎌倉シャツ": ["鎌倉"],
  "コーチ": ["coach", "コーチ"],
  "五大陸": ["gotairiku", "五大陸"],
  "銀座田屋": ["ginzaya", "銀座田屋", "ギンザタヤ"],
  "ビームス": ["beams", "beamsf", "ビームス", "ビームスエフ", "ビームスハート"],
  "カルヴェン": ["carven", "calven", "カルペン", "カルヴェン"],
  "ミツミネ": ["mitsumine", "ミツミネ"],
  "ユキコハナイ": ["yukikohanai", "ユキコハナイ"],
  "ヨシエイナバ": ["yoshieinaba", "ヨシエイナバ"],
  "ステファノリッチ": ["stefanoricci", "ステファノリッチ"],
  "バレンシアガ": ["balenciaga", "バレンシアガ"],
  "クレージュ": ["courreges", "courrèges", "クレージュ", "クレージェ"],
  "ジャンポールゴルチエ": ["jean paul gaultier", "jean-paul gaultier", "jpg", "ジャンポールゴルチエ", "ジャンポール・ゴルチエ", "ジャンポール ゴルチエ", "ジャンポールゴルチェ"],
  "ニナリッチ": ["ninaricci", "nina ricci", "nina-ricci", "ニナリッチ"],
  "ステラマッカートニー": ["stella mccartney", "stellamccartney", "ステラマッカートニー", "ステラ マッカートニー"],
}

// 商品名がまとめ仕入れかどうかを判定する関数
const isBulkItem = (productName: string): boolean => {
  if (!productName) return false
  const normalizedName = productName.toLowerCase()
  // 「セット」「まとめ」「○本」「○点」などを検出
  const bulkKeywords = ['セット', 'まとめ', 'set', '本セット', '点セット', '枚セット', '個セット']
  for (const keyword of bulkKeywords) {
    if (normalizedName.includes(keyword.toLowerCase())) {
      return true
    }
  }
  // 「○本」「○点」「○枚」などの数量表現を検出（例: 10本、5点）
  if (/\d+本|\d+点|\d+枚|\d+個/.test(productName)) {
    return true
  }
  return false
}

// 商品名から数量を抽出する関数
const extractQuantityFromName = (productName: string): number => {
  // 「10本セット」「5点まとめ」などから数量を抽出
  const match = productName.match(/(\d+)\s*(本|点|枚|個)/)
  if (match) {
    return parseInt(match[1], 10)
  }
  return 1
}

// 商品名からジャンル/カテゴリを推測する関数
const detectGenreFromName = (productName: string): string => {
  const lower = productName.toLowerCase()
  if (lower.includes('ネクタイ') || lower.includes('タイ') || lower.includes('tie')) return 'ネクタイ'
  if (lower.includes('スカーフ') || lower.includes('scarf')) return 'スカーフ'
  if (lower.includes('ベルト') || lower.includes('belt')) return 'ベルト'
  if (lower.includes('財布') || lower.includes('ウォレット') || lower.includes('wallet')) return '財布'
  if (lower.includes('バッグ') || lower.includes('bag') || lower.includes('鞄')) return 'バッグ'
  if (lower.includes('靴') || lower.includes('シューズ') || lower.includes('shoes')) return '靴'
  if (lower.includes('時計') || lower.includes('watch')) return '時計'
  if (lower.includes('アクセサリー') || lower.includes('accessory')) return 'アクセサリー'
  return 'その他'
}

// 商品名からブランド名を検出する関数
const detectBrand = (productName: string): string | null => {
  if (!productName) return null
  const normalizedName = productName.toLowerCase().replace(/\s+/g, '')

  for (const [brandName, keywords] of Object.entries(brandDictionary)) {
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, '')
      if (normalizedName.includes(normalizedKeyword)) {
        return brandName
      }
    }
  }
  return null
}

// カテゴリー（ジャンル）の選択肢
const categoryOptions = ['バッグ', '財布', 'アクセサリー', '時計', 'ベルト', 'ネクタイ']

// カテゴリー検出用の辞書
const categoryDictionary: Record<string, string[]> = {
  'バッグ': ['バッグ', 'bag', 'トート', 'ショルダー', 'ハンドバッグ', 'リュック', 'ボストン', 'クラッチ', 'ポーチ', 'ブリーフケース', 'ビジネスバッグ', 'メッセンジャー', 'ボディバッグ', 'ウエストバッグ', 'サック'],
  '財布': ['財布', 'wallet', 'ウォレット', '長財布', '二つ折り', '三つ折り', 'コインケース', 'カードケース', 'キーケース', 'マネークリップ'],
  'アクセサリー': ['アクセサリー', 'ネックレス', 'ブレスレット', 'リング', 'ピアス', 'イヤリング', 'ペンダント', 'チョーカー', 'バングル', 'ブローチ', 'カフス', 'タイピン'],
  '時計': ['時計', 'watch', 'ウォッチ', 'クロノ', 'クォーツ', '腕時計'],
  'ベルト': ['ベルト', 'belt'],
  'ネクタイ': ['ネクタイ', 'タイ', 'tie', 'ネクタイピン'],
}

// 商品名からカテゴリーを検出する関数
const detectCategory = (productName: string): string | null => {
  if (!productName) return null
  const normalizedName = productName.toLowerCase().replace(/\s+/g, '')

  for (const [category, keywords] of Object.entries(categoryDictionary)) {
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, '')
      if (normalizedName.includes(normalizedKeyword)) {
        return category
      }
    }
  }
  return null
}

// 画像URLをプロキシ経由に変換（Googleドライブ以外の外部URL）
const getProxiedImageUrl = (url: string | null): string | null => {
  if (!url) return null

  // Base64画像データはそのまま返す
  if (url.startsWith('data:')) {
    return url
  }

  // GoogleドライブのURLを直接表示形式に変換
  if (url.includes('drive.google.com')) {
    // 共有リンク形式: https://drive.google.com/file/d/FILE_ID/view... → 直接表示形式に変換
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (fileIdMatch) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`
    }
    // uc?export形式はそのまま
    if (url.includes('uc?export=view') || url.includes('uc?id=')) {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
      if (idMatch) {
        return `https://lh3.googleusercontent.com/d/${idMatch[1]}`
      }
    }
    return url
  }

  // googleusercontentはそのまま
  if (url.includes('googleusercontent.com')) {
    return url
  }

  // 外部画像はプロキシ経由
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

// メモ化されたチェックボックスコンポーネント（パフォーマンス最適化）
const MemoizedCheckbox = memo(function MemoizedCheckbox({
  checked,
  itemId,
  index,
  onSelect,
}: {
  checked: boolean
  itemId: string
  index: number
  onSelect: (id: string, index: number, shiftKey: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onClick={(e) => onSelect(itemId, index, e.shiftKey)}
      onChange={() => {}}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
  )
})

export default function Home() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ stage: string; current: number; total: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ id: string; field: keyof InventoryItem } | null>(null)
  const [selectionRange, setSelectionRange] = useState<{
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  const [autoFillRange, setAutoFillRange] = useState<{
    sourceRow: number
    sourceCol: number
    endRow: number
    endCol: number
  } | null>(null)
  // Undo/Redo履歴管理
  const [undoStack, setUndoStack] = useState<{ id: string; field: string; oldValue: unknown; newValue: unknown }[][]>([])
  const [redoStack, setRedoStack] = useState<{ id: string; field: string; oldValue: unknown; newValue: unknown }[][]>([])
  const MAX_HISTORY = 50
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof InventoryItem } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const editCellRef = useRef<HTMLTableCellElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const fixedScrollbarRef = useRef<HTMLDivElement>(null)
  const [tableScrollWidth, setTableScrollWidth] = useState(0)
  const [modalEdit, setModalEdit] = useState<{ id: string; field: keyof InventoryItem; value: string } | null>(null)
  const [imageModal, setImageModal] = useState<string | null>(null)
  const [imageEditModal, setImageEditModal] = useState<{ id: string; currentUrl: string | null } | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [pendingCSV, setPendingCSV] = useState<{ file: File; needsDate: boolean; type?: string } | null>(null)
  const [csvPurchaseDate, setCsvPurchaseDate] = useState<string>('')
  const [starBuyersImageCSV, setStarBuyersImageCSV] = useState<File | null>(null)
  const [aucnetImageFile, setAucnetImageFile] = useState<File | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  // URLパラメータから検索キーワードの初期値を取得
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '')
  // 検索キーワード変更時にURLパラメータを更新
  const updateSearchQuery = useCallback((value: string) => {
    setSearchQuery(value)
    const url = new URL(window.location.href)
    if (value) {
      url.searchParams.set('q', value)
    } else {
      url.searchParams.delete('q')
    }
    window.history.replaceState({}, '', url.toString())
  }, [])
  // URLパラメータから初期フィルターを設定（ダッシュボードからのリンク対応）
  const initialQuickFilter = (): 'all' | 'unsold' | 'unlisted' | 'stale30' | 'stale90' => {
    const quickFilterParam = searchParams.get('quickFilter')
    if (quickFilterParam === 'unsold') return 'unsold'
    if (quickFilterParam === 'unlisted') return 'unlisted'
    if (quickFilterParam === 'stale30') return 'stale30'
    if (quickFilterParam === 'stale90' || quickFilterParam === 'stale') return 'stale90'
    const status = searchParams.get('status')
    if (status === '未出品') return 'unlisted'
    if (status === '未販売') return 'unsold'
    return 'all'
  }
  const [quickFilter, setQuickFilter] = useState<'all' | 'unsold' | 'unlisted' | 'stale30' | 'stale90' | 'returns'>(initialQuickFilter)
  // チェック済みのみ表示
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  // ドロップダウン検索用
  const [dropdownSearchQuery, setDropdownSearchQuery] = useState('')
  // クイックフィルター変更時にURLパラメータを更新
  const updateQuickFilter = useCallback((value: 'all' | 'unsold' | 'unlisted' | 'stale30' | 'stale90' | 'returns') => {
    setQuickFilter(value)
    const url = new URL(window.location.href)
    if (value !== 'all') {
      url.searchParams.set('quickFilter', value)
    } else {
      url.searchParams.delete('quickFilter')
    }
    url.searchParams.delete('status') // 古いパラメータを削除
    window.history.replaceState({}, '', url.toString())
  }, [])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 選択がなくなったらフィルターを自動オフ
  useEffect(() => {
    if (selectedIds.size === 0 && showSelectedOnly) {
      setShowSelectedOnly(false)
    }
  }, [selectedIds.size, showSelectedOnly])
  // 選択状態の遅延値（UIの応答性を維持）
  const deferredSelectedIds = useDeferredValue(selectedIds)
  // 選択状態チェック用のメモ化関数（パフォーマンス最適化）
  const isItemSelected = useCallback((id: string) => deferredSelectedIds.has(id), [deferredSelectedIds])
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [selectedPurchaseSources, setSelectedPurchaseSources] = useState<Set<string>>(new Set())
  const [selectedSaleDestinations, setSelectedSaleDestinations] = useState<Set<string>>(new Set())
  const [dateFilters, setDateFilters] = useState<{
    purchase_date: { year: string; month: string }
    listing_date: { year: string; month: string }
    sale_date: { year: string; month: string }
  }>({
    purchase_date: { year: '', month: '' },
    listing_date: { year: '', month: '' },
    sale_date: { year: '', month: '' },
  })

  // 期間フィルター
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    dateType: 'purchase_date' | 'listing_date' | 'sale_date'
    startDate: string
    endDate: string
  }>({
    dateType: 'purchase_date',
    startDate: '',
    endDate: '',
  })
  const [openDateFilter, setOpenDateFilter] = useState<string | null>(null)
  const [turnoverDaysFilter, setTurnoverDaysFilter] = useState<'' | '30' | '90'>('')
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left?: number; right?: number } | null>(null)
  const [importResult, setImportResult] = useState<{
    source: string
    newItems: { product_name: string; purchase_total: number | null }[]
    skippedItems: { product_name: string; purchase_total: number | null }[]
  } | null>(null)

  // ラクマ手数料設定
  const [rakumaCommissionSettings, setRakumaCommissionSettings] = useState<Record<string, number>>({})
  const [rakumaSettingsLoaded, setRakumaSettingsLoaded] = useState(false)
  const [showRakumaModal, setShowRakumaModal] = useState(false)
  const [rakumaModalYearMonth, setRakumaModalYearMonth] = useState('')
  const [rakumaModalRate, setRakumaModalRate] = useState('')
  const [showRakumaSettingsModal, setShowRakumaSettingsModal] = useState(false)

  // オークション出品モーダル
  const [showAuctionExportModal, setShowAuctionExportModal] = useState(false)
  const [auctionManagementField, setAuctionManagementField] = useState<'inventory_number' | 'memo'>('memo')
  const [selectedAuctionCompany, setSelectedAuctionCompany] = useState<string | null>(null)
  const [selectedAuctionCategory, setSelectedAuctionCategory] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // ページネーション（URLパラメータから初期値を取得）
  const [currentPage, setCurrentPageState] = useState(() => {
    const page = searchParams.get('page')
    return page ? parseInt(page, 10) : 1
  })
  const [itemsPerPage, setItemsPerPage] = useState(-1)

  // ページ変更時にURLパラメータを更新
  const updateCurrentPage = useCallback((pageOrUpdater: number | ((prev: number) => number)) => {
    setCurrentPageState(prev => {
      const newPage = typeof pageOrUpdater === 'function' ? pageOrUpdater(prev) : pageOrUpdater
      return newPage
    })
  }, [])

  // currentPage変更時にURLを更新（副作用として）
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const url = new URL(window.location.href)
    if (currentPage > 1) {
      url.searchParams.set('page', String(currentPage))
    } else {
      url.searchParams.delete('page')
    }
    window.history.replaceState({}, '', url.toString())
  }, [currentPage])

  // 汎用CSVインポート用state
  const [genericImportModal, setGenericImportModal] = useState<{
    step: 'mapping' | 'preview' | 'importing'
    csvHeaders: string[]
    csvData: Record<string, string>[]
    mapping: Record<string, string>
    progress: number
  } | null>(null)

  // 手動商品追加モーダル
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [newItemForm, setNewItemForm] = useState({
    product_name: '',
    brand_name: '',
    category: '',
    purchase_price: '',
    purchase_total: '',
    purchase_date: '',
    purchase_source: '',
  })

  // 販路マスタのデータ
  const [masterPlatforms, setMasterPlatforms] = useState<{ name: string; color_class: string; is_active: boolean; sort_order: number }[]>([])

  // 非表示のプラットフォーム選択肢
  const [hiddenPlatforms, setHiddenPlatforms] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hiddenPlatforms')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    }
    return new Set()
  })

  // 列の順序管理（開発用）
  const defaultColumns = [
    { key: 'checkbox', label: '', draggable: false, width: 'w-8' },
    { key: 'index', label: 'No.', draggable: false, width: 'w-14' },
    { key: 'inventory_number', label: '管理\n番号', draggable: true, width: 'w-16' },
    { key: 'refund_status', label: '返金\n完了', draggable: false, width: 'w-14' },
    { key: 'image', label: '画像', draggable: true, width: 'w-16' },
    { key: 'category', label: 'ジャンル', draggable: true, width: 'w-20' },
    { key: 'brand_name', label: 'ブランド', draggable: true, width: 'w-28' },
    { key: 'product_name', label: '商品名', draggable: true, width: 'w-32' },
    { key: 'purchase_source', label: '仕入先', draggable: true, width: 'w-[140px]' },
    { key: 'sale_destination', label: '販売先', draggable: true, width: 'w-[140px]' },
    { key: 'sale_price', label: '売値', draggable: true, width: 'w-20' },
    { key: 'commission', label: '手数料', draggable: true, width: 'w-16' },
    { key: 'shipping_cost', label: '送料', draggable: true, width: 'w-16' },
    { key: 'other_cost', label: 'その他', draggable: true, width: 'w-16' },
    { key: 'purchase_price', label: '原価', draggable: true, width: 'w-20' },
    { key: 'purchase_total', label: '仕入\n総額', draggable: true, width: 'w-20' },
    { key: 'deposit_amount', label: '入金額', draggable: true, width: 'w-20' },
    { key: 'profit', label: '利益', draggable: true, width: 'w-20' },
    { key: 'profit_rate', label: '利益率', draggable: true, width: 'w-16' },
    { key: 'purchase_date', label: '仕入日', draggable: true, width: 'w-14' },
    { key: 'listing_date', label: '出品日', draggable: true, width: 'w-14' },
    { key: 'sale_date', label: '売却日', draggable: true, width: 'w-14' },
    { key: 'turnover_days', label: '回転\n日数', draggable: true, width: 'w-16' },
    { key: 'memo', label: 'メモ', draggable: true, width: 'w-40' },
  ]
  const [columns, setColumns] = useState(defaultColumns)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inventory-hidden-columns')
      if (saved) {
        try {
          return new Set(JSON.parse(saved))
        } catch {
          return new Set()
        }
      }
    }
    return new Set()
  })
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [draggedCol, setDraggedCol] = useState<number | null>(null)

  // 全列に区切り線を入れる
  const groupEndColumns = new Set(['checkbox', 'index', 'inventory_number', 'refund_status', 'image', 'category', 'brand_name', 'product_name', 'purchase_source', 'sale_destination', 'sale_price', 'commission', 'shipping_cost', 'other_cost', 'purchase_price', 'purchase_total', 'deposit_amount', 'profit', 'profit_rate', 'purchase_date', 'listing_date', 'sale_date', 'turnover_days'])

  // 非表示列をlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('inventory-hidden-columns', JSON.stringify(Array.from(hiddenColumns)))
  }, [hiddenColumns])

  // 表示する列をフィルタリング（返品タブ以外ではrefund_statusを非表示）
  const visibleColumns = columns.filter(col => {
    if (hiddenColumns.has(col.key)) return false
    if (col.key === 'refund_status' && quickFilter !== 'returns') return false
    return true
  })

  const handleColumnDragStart = (index: number) => {
    setDraggedCol(index)
  }

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedCol === null || draggedCol === index) return
    if (!columns[index].draggable || !columns[draggedCol].draggable) return

    const newColumns = [...columns]
    const [removed] = newColumns.splice(draggedCol, 1)
    newColumns.splice(index, 0, removed)
    startTransition(() => {
      setColumns(newColumns)
    })
    setDraggedCol(index)
  }

  const handleColumnDragEnd = () => {
    setDraggedCol(null)
  }

  const fetchInventory = useCallback(async () => {
    // Supabaseのデフォルト1000件制限を解除するため、rangeを使用
    let allData: InventoryItem[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('inventory_number', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('Error fetching inventory:', error)
        break
      }

      if (!data || data.length === 0) break

      allData = [...allData, ...data]
      if (data.length < pageSize) break
      from += pageSize
    }

    setInventory(allData)
    setLoading(false)
  }, [])

  // ラクマ手数料設定を取得
  const fetchRakumaSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('rakuma_commission_settings')
      .select('*')

    if (!error && data) {
      const settings: Record<string, number> = {}
      data.forEach((row: { year_month: string; commission_rate: number }) => {
        settings[row.year_month] = row.commission_rate
      })
      setRakumaCommissionSettings(settings)
    }
    setRakumaSettingsLoaded(true)
  }, [])

  // 販路マスタを取得
  const fetchPlatforms = useCallback(async () => {
    const { data, error } = await supabase
      .from('platforms')
      .select('name, color_class, is_active, sort_order')
      .order('sort_order', { ascending: true })

    if (!error && data) {
      setMasterPlatforms(data)
    }
  }, [])

  // 26日かどうかチェックして、来月の手数料が未設定なら通知
  useEffect(() => {
    // データ取得完了前はモーダルを表示しない
    if (!rakumaSettingsLoaded) return

    const today = new Date()
    const day = today.getDate()

    if (day >= 26) {
      // 来月の年月を計算
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      const yearMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`

      // 来月の設定がなければモーダル表示
      if (!rakumaCommissionSettings[yearMonth]) {
        // localStorage でその月の通知を既に閉じたかチェック
        const dismissed = localStorage.getItem(`rakuma_dismissed_${yearMonth}`)
        if (!dismissed) {
          setRakumaModalYearMonth(yearMonth)
          setRakumaModalRate('')
          setShowRakumaModal(true)
        }
      }
    }
  }, [rakumaCommissionSettings, rakumaSettingsLoaded])

  useEffect(() => {
    fetchInventory()
    fetchRakumaSettings()
    fetchPlatforms()
  }, [fetchInventory, fetchRakumaSettings, fetchPlatforms])

  // 画像自動移行（バックグラウンドで実行）
  const isMigratingRef = useRef(false)
  useEffect(() => {
    if (inventory.length === 0 || isMigratingRef.current) return

    // 外部URLの画像を持つアイテムを抽出
    const itemsToMigrate = inventory.filter(item => {
      const imageUrl = item.saved_image_url || item.image_url
      if (!imageUrl) return false
      if (imageUrl.includes('supabase.co/storage')) return false
      if (imageUrl.startsWith('data:')) return false
      if (imageUrl.includes('googleusercontent.com')) return false
      return true
    })

    if (itemsToMigrate.length === 0) return

    // バックグラウンドで移行開始
    isMigratingRef.current = true
    const migrateImages = async () => {
      const batchSize = 5
      for (let i = 0; i < itemsToMigrate.length; i += batchSize) {
        const batch = itemsToMigrate.slice(i, i + batchSize)
        const items = batch.map(item => ({
          id: item.id,
          imageUrl: item.saved_image_url || item.image_url || ''
        }))

        try {
          const response = await fetch('/api/upload-image', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          })

          if (response.ok) {
            const { results } = await response.json()
            for (const result of results) {
              if (result.success && result.url) {
                await supabase
                  .from('inventory')
                  .update({ saved_image_url: result.url })
                  .eq('id', result.id)
                // ローカルstateも更新
                setInventory(prev => prev.map(item =>
                  item.id === result.id ? { ...item, saved_image_url: result.url } : item
                ))
              }
            }
          }
        } catch (error) {
          console.error('Auto image migration error:', error)
        }

        // 少し待機（サーバー負荷軽減）
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      console.log(`画像自動移行完了: ${itemsToMigrate.length}件処理`)
    }

    migrateImages()
  }, [inventory.length])

  // 固定スクロールバーとテーブルの同期
  useEffect(() => {
    const tableContainer = tableContainerRef.current
    const fixedScrollbar = fixedScrollbarRef.current
    if (!tableContainer || !fixedScrollbar) return

    // テーブルの幅を更新（遅延実行）
    let resizeTimeout: NodeJS.Timeout
    const updateScrollWidth = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (tableContainer.scrollWidth > 0) {
          setTableScrollWidth(tableContainer.scrollWidth)
        }
      }, 100)
    }
    updateScrollWidth()

    // ResizeObserverでテーブルサイズ変更を監視
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(tableContainer)

    let isSyncing = false
    let rafId: number

    const syncTableToScrollbar = () => {
      if (isSyncing) return
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        isSyncing = true
        fixedScrollbar.scrollLeft = tableContainer.scrollLeft
        isSyncing = false
      })
    }

    const syncScrollbarToTable = () => {
      if (isSyncing) return
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        isSyncing = true
        tableContainer.scrollLeft = fixedScrollbar.scrollLeft
        isSyncing = false
      })
    }

    tableContainer.addEventListener('scroll', syncTableToScrollbar, { passive: true })
    fixedScrollbar.addEventListener('scroll', syncScrollbarToTable, { passive: true })

    return () => {
      clearTimeout(resizeTimeout)
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      tableContainer.removeEventListener('scroll', syncTableToScrollbar)
      fixedScrollbar.removeEventListener('scroll', syncScrollbarToTable)
    }
  }, [inventory.length])

  // セル編集を保存する関数
  const saveEditingCell = useCallback(async () => {
    if (!editingCell) return

    const { id, field } = editingCell
    let value: string | number | null = editValue

    // 数値フィールドの変換
    const numericFields = ['purchase_price', 'sale_price', 'commission', 'shipping_cost', 'other_cost', 'deposit_amount', 'purchase_total']
    if (numericFields.includes(field)) {
      value = editValue ? Number(editValue) : null
    }
    // 日付フィールド
    if (field === 'purchase_date' || field === 'sale_date') {
      value = editValue || null
    }

    // 現在のアイテムを取得
    const currentItem = inventory.find(item => item.id === id)
    if (!currentItem) return

    // 更新後の値を計算するためのオブジェクト
    let updateData: Record<string, string | number | null> = { [field]: value }

    // 各フィールドの最新値を取得（更新される場合は新しい値を使用）
    const getUpdatedValue = (fieldName: keyof InventoryItem) => {
      if (fieldName === field) return value
      if (updateData[fieldName] !== undefined) return updateData[fieldName]
      return currentItem[fieldName]
    }

    // 販売先または売値が変更された場合、手数料を自動計算
    if (field === 'sale_destination' || field === 'sale_price') {
      const newDestination = field === 'sale_destination' ? (value as string) : currentItem.sale_destination
      const newSalePrice = field === 'sale_price' ? (value as number) : currentItem.sale_price
      const newCommission = calculateCommission(newDestination || null, newSalePrice || null, currentItem.sale_date)
      updateData.commission = newCommission
    }

    // 販売先または売却日が入力されたらステータスを売却済みに自動変更
    if (field === 'sale_destination' || field === 'sale_date') {
      if (value) {
        updateData.status = '売却済み'
      } else {
        // 両方とも空なら在庫ありに戻す
        const otherField = field === 'sale_destination' ? 'sale_date' : 'sale_destination'
        const otherValue = currentItem[otherField]
        if (!otherValue) {
          updateData.status = '在庫あり'
        }
      }
    }

    // 入金額を自動計算: 売値 - 手数料 - 送料（販売先から実際に入金される金額）
    const autoCalcFields = ['sale_price', 'sale_destination', 'commission', 'shipping_cost']
    if (autoCalcFields.includes(field)) {
      const salePrice = getUpdatedValue('sale_price') as number | null
      const commission = updateData.commission !== undefined
        ? updateData.commission as number | null
        : currentItem.commission
      const shippingCost = getUpdatedValue('shipping_cost') as number | null

      if (salePrice !== null && salePrice !== 0) {
        updateData.deposit_amount = salePrice - (commission || 0) - (shippingCost || 0)
      } else {
        // 売値が0またはnullの場合、入金額もリセット
        updateData.deposit_amount = null
      }
    }

    // 仕入総額が更新された場合、メモを自動更新（管理番号）仕入総額）
    if (field === 'purchase_total' && currentItem.inventory_number) {
      const newPurchaseTotal = value as number | null
      updateData.memo = `${currentItem.inventory_number}）${newPurchaseTotal || 0}`
    }

    // 履歴に記録（変更されたフィールドのみ）
    const historyChanges: { id: string; field: string; oldValue: unknown; newValue: unknown }[] = []
    for (const [key, newVal] of Object.entries(updateData)) {
      const oldVal = currentItem[key as keyof InventoryItem]
      if (oldVal !== newVal) {
        historyChanges.push({ id, field: key, oldValue: oldVal, newValue: newVal })
      }
    }
    if (historyChanges.length > 0) {
      setUndoStack(prev => {
        const newStack = [...prev, historyChanges]
        if (newStack.length > MAX_HISTORY) {
          return newStack.slice(-MAX_HISTORY)
        }
        return newStack
      })
      setRedoStack([])
    }

    // 商品名に「まとめ」が含まれる場合、まとめ在庫に移動
    if (field === 'product_name' && value && typeof value === 'string' && value.includes('まとめ')) {
      // まとめ仕入れを取得して選択ダイアログを表示
      const { data: bulkPurchases } = await supabase
        .from('bulk_purchases')
        .select('*')
        .order('purchase_date', { ascending: false })

      if (bulkPurchases && bulkPurchases.length > 0) {
        // 確認ダイアログ
        const purchaseOptions = bulkPurchases.map((p, i) => `${i + 1}. ${p.genre} (${p.purchase_date})`).join('\n')
        const selectedIndex = prompt(`「まとめ」が含まれています。まとめ在庫に移動しますか？\n移動先の番号を入力してください（キャンセルで移動しない）:\n\n${purchaseOptions}`)

        if (selectedIndex !== null && selectedIndex !== '') {
          const idx = parseInt(selectedIndex) - 1
          if (idx >= 0 && idx < bulkPurchases.length) {
            const selectedPurchase = bulkPurchases[idx]

            // bulk_salesに追加
            const { error: insertError } = await supabase
              .from('bulk_sales')
              .insert({
                bulk_purchase_id: selectedPurchase.id,
                sale_date: currentItem.sale_date || new Date().toISOString().split('T')[0],
                sale_destination: currentItem.sale_destination || null,
                quantity: 1,
                sale_amount: currentItem.sale_price || 0,
                commission: currentItem.commission || 0,
                shipping_cost: currentItem.shipping_cost || 0,
                memo: currentItem.memo || null,
                product_name: value,
                brand_name: currentItem.brand_name || null,
                category: currentItem.category || null,
                image_url: currentItem.image_url || currentItem.saved_image_url || null,
                purchase_price: currentItem.purchase_price || null,
                other_cost: currentItem.other_cost || 0,
                deposit_amount: currentItem.deposit_amount || null,
                listing_date: currentItem.listing_date || null,
                user_id: user?.id
              })

            if (!insertError) {
              // inventoryから削除
              await supabase.from('inventory').delete().eq('id', id)
              setInventory(prev => prev.filter(item => item.id !== id))
              setEditingCell(null)
              setEditValue('')
              alert('まとめ在庫に移動しました')
              return
            }
          }
        }
      }
    }

    const { error } = await supabase
      .from('inventory')
      .update(updateData)
      .eq('id', id)

    if (!error) {
      setInventory(prev => prev.map(item =>
        item.id === id ? { ...item, ...updateData } : item
      ))
    }
    setEditingCell(null)
    setEditValue('')
  }, [editingCell, editValue, inventory, MAX_HISTORY])

  // 販売先をクリアする関数
  const clearSaleDestination = async (id: string) => {
    const { error } = await supabase
      .from('inventory')
      .update({
        sale_destination: null,
        status: '在庫あり',
        commission: null
      })
      .eq('id', id)

    if (!error) {
      setInventory(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, sale_destination: null, status: '在庫あり', commission: null }
            : item
        )
      )
    }
  }

  // エンターキーで保存
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEditingCell()
    }
  }

  // 枠外クリックで自動保存 & 日付フィルターを閉じる & 選択解除
  useEffect(() => {
    const handleClickOutside = async (e: MouseEvent) => {
      if (editingCell && editCellRef.current && !editCellRef.current.contains(e.target as Node)) {
        saveEditingCell()
      }
      // 日付フィルタードロップダウンを閉じる
      if (openDateFilter) {
        const target = e.target as HTMLElement
        if (!target.closest('.date-filter-dropdown') && !target.closest('button')) {
          setOpenDateFilter(null)
          setDropdownPosition(null)
          setDropdownSearchQuery('')
        }
      }
      // テーブルセル以外をクリックしたら選択解除
      const target = e.target as HTMLElement
      if (selectedCell && !target.closest('td') && !target.closest('.fixed')) {
        setSelectedCell(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCell, saveEditingCell, openDateFilter, selectedCell])

  const parseYahooDate = (dateStr: string): string | null => {
    // "11月24日 23時36分" -> "2024-11-24"
    const match = dateStr.match(/(\d+)月(\d+)日/)
    if (match) {
      const month = match[1].padStart(2, '0')
      const day = match[2].padStart(2, '0')
      const year = new Date().getFullYear()
      return `${year}-${month}-${day}`
    }
    return null
  }

  // CSVの種類を判定
  const detectCSVType = (file: File): Promise<'ecoauc' | 'starbuyers' | 'yahoo' | 'secondstreet' | 'monobank' | 'aucnet' | 'unknown'> => {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Papa.parse<any>(file, {
        header: true,
        preview: 1,
        encoding: 'Shift_JIS',
        complete: (results) => {
          const firstRow = results.data[0]
          const headers = firstRow ? Object.keys(firstRow) : []
          // 引用符を除去してチェック
          const cleanHeaders = headers.map(h => h.replace(/^"|"$/g, ''))

          if (firstRow && 'item_name' in firstRow) {
            resolve('ecoauc')
          } else if (firstRow && '管理番号' in firstRow && '落札金額' in firstRow) {
            resolve('starbuyers')
          } else if (firstRow && '商品名' in firstRow && 'オークション画像URL' in firstRow) {
            resolve('yahoo')
          } else if (firstRow && '購入日(YYYY/MM/DD)' in firstRow && 'お支払い金額' in firstRow) {
            resolve('secondstreet')
          } else if (firstRow && '箱番' in firstRow && '枝番' in firstRow && '金額' in firstRow) {
            resolve('monobank')
          } else if (cleanHeaders.includes('受付番号') && cleanHeaders.includes('請求商品代')) {
            resolve('aucnet')
          } else {
            resolve('unknown')
          }
        },
        error: () => resolve('unknown')
      })
    })
  }

  // オークネット2ファイルインポート処理
  const handleAucnetImport = async (mainFile: File, imageFile: File | null) => {
    // Shift-JISで読む
    const readShiftJIS = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsText(file, 'Shift_JIS')
      })
    }

    // 画像CSV: 受付番号 → URL マップ
    const imageMap = new Map<string, string>()
    if (imageFile) {
      const imageText = await readShiftJIS(imageFile)
      console.log('画像CSVの内容:', imageText.substring(0, 500))
      for (const line of imageText.trim().split('\n')) {
        const url = line.replace(/^"|"$/g, '').trim()
        if (url.startsWith('http')) {
          const match = url.match(/J\d+_(\d+-\d+)_/)
          if (match) {
            console.log(`画像マッチ: 受付番号=[${match[1]}], URL=[${url.substring(0, 80)}...]`)
            imageMap.set(match[1], url)
          }
        }
      }
      console.log(`画像CSV: ${imageMap.size}件マッチ`)
      console.log('画像マップのキー:', Array.from(imageMap.keys()))
    }

    // ファイル名から日付を抽出（20251212_オークネット計算書.csv → 2025-12-12）
    let purchaseDate: string | null = null
    const dateMatch = mainFile.name.match(/^(\d{4})(\d{2})(\d{2})/)
    if (dateMatch) {
      purchaseDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    }

    // 計算書CSV
    const mainText = await readShiftJIS(mainFile)
    Papa.parse(mainText, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as Record<string, string>[]
        const getCol = (row: Record<string, string>, col: string) => row[col] || row[`"${col}"`] || ''

        // 有効データのみ（受付番号あり、請求商品代 > 0）
        const valid = data.filter(row => {
          const num = getCol(row, '受付番号').trim()
          const price = parseFloat((getCol(row, '請求商品代') || '0').replace(/,/g, ''))
          return num && price > 0
        })

        if (valid.length === 0) {
          alert('インポート対象のデータがありません')
          return
        }

        // 既存の最大管理番号を取得
        const { data: maxData } = await supabase
          .from('inventory')
          .select('inventory_number')
          .order('inventory_number', { ascending: false })
          .limit(1)
          .single()
        let nextNumber = (maxData?.inventory_number || 0) + 1

        // マッピング: ジャンル→category, ブランド名→brand_name, 商品名→product_name, 請求商品代→purchase_price, 支払/請求税込合計→purchase_total
        const records = valid.map(row => {
          const receiptNum = getCol(row, '受付番号').trim()
          console.log(`受付番号: [${receiptNum}], 画像URL: [${imageMap.get(receiptNum) || '無し'}]`)

          // ブランド名をCSVから取得し、辞書で正規化
          let rawBrand = getCol(row, 'ブランド名').replace(/\s+/g, ' ').trim()
          rawBrand = rawBrand.replace(/[（\(][^）\)]*[）\)]$/, '').trim()
          // 全角英数字を半角に変換
          const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
          const halfWidthBrand = toHalfWidth(rawBrand)
          // ブランド名だけを抽出（最初のスペースまで、またはライン名の前まで）
          const brandOnly = halfWidthBrand.split(/\s+/)[0]
          const normalizedBrand = detectBrand(brandOnly) || detectBrand(halfWidthBrand)
          console.log(`ブランド変換: [${rawBrand}] → [${normalizedBrand || rawBrand}]`)
          const finalBrand = normalizedBrand || rawBrand || null

          const inventoryNumber = nextNumber++

          const purchaseTotal = parseFloat((getCol(row, '支払/請求税込合計') || '0').replace(/,/g, '')) || 0

          return {
            user_id: user?.id,
            inventory_number: inventoryNumber,
            category: getCol(row, 'ジャンル').trim() || null,
            brand_name: finalBrand,
            product_name: getCol(row, '商品名').trim() || null,
            purchase_price: parseFloat((getCol(row, '請求商品代') || '0').replace(/,/g, '')) || 0,
            purchase_total: purchaseTotal,
            purchase_source: 'オークネット',
            purchase_date: purchaseDate,
            image_url: imageMap.get(receiptNum) || null,
            status: '在庫あり',
            memo: `${inventoryNumber}）${purchaseTotal}`,
          }
        }).filter(r => r.product_name || r.brand_name)

        const { error } = await supabase.from('inventory').insert(records)
        if (error) {
          console.error('インポートエラー:', error)
          alert(`エラー: ${error.message}`)
        } else {
          alert(`オークネットCSVインポート完了: ${records.length}件`)
          setAucnetImageFile(null)
          fetchInventory()
        }
      }
    })
  }

  const handleCSVSelect = async (file: File) => {
    const csvType = await detectCSVType(file)

    if (csvType === 'ecoauc') {
      // エコオク形式：仕入日入力ダイアログを表示
      setPendingCSV({ file, needsDate: true, type: 'ecoauc' })
      setCsvPurchaseDate(new Date().toISOString().split('T')[0])
    } else if (csvType === 'starbuyers') {
      // スターバイヤーズ形式：画像CSV選択ダイアログを表示
      setPendingCSV({ file, needsDate: false, type: 'starbuyers' })
      setStarBuyersImageCSV(null)
    } else if (csvType === 'monobank') {
      // モノバンク形式：画像CSV選択ダイアログを表示
      setPendingCSV({ file, needsDate: false, type: 'monobank' })
      setStarBuyersImageCSV(null)
    } else if (csvType === 'yahoo') {
      // ヤフオク形式：そのまま処理
      handleCSVUpload(file, null, null)
    } else if (csvType === 'secondstreet') {
      // セカスト形式：そのまま処理
      handleCSVUpload(file, null, null)
    } else if (csvType === 'aucnet') {
      // オークネット形式：画像CSVがあれば一緒にインポート
      handleAucnetImport(file, aucnetImageFile)
    } else {
      // 不明な形式は汎用インポートモーダルを表示
      handleGenericCSVImport(file)
    }
  }

  // 汎用CSVインポート処理
  // メイン在庫表と同じ順番
  const GENERIC_IMPORT_COLUMNS = [
    { key: 'inventory_number', label: '管理番号' },
    { key: 'image_url', label: '画像URL' },
    { key: 'category', label: 'ジャンル' },
    { key: 'brand_name', label: 'ブランド' },
    { key: 'product_name', label: '商品名' },
    { key: 'purchase_source', label: '仕入先' },
    { key: 'sale_destination', label: '販売先' },
    { key: 'sale_price', label: '売値' },
    { key: 'commission', label: '手数料' },
    { key: 'shipping_cost', label: '送料' },
    { key: 'other_cost', label: 'その他' },
    { key: 'purchase_price', label: '原価' },
    { key: 'purchase_total', label: '仕入総額' },
    { key: 'deposit_amount', label: '入金額' },
    { key: 'profit', label: '利益' },
    { key: 'profit_rate', label: '利益率' },
    { key: 'purchase_date', label: '仕入日' },
    { key: 'listing_date', label: '出品日' },
    { key: 'sale_date', label: '売却日' },
    { key: 'turnover_days', label: '回転日数' },
    { key: 'memo', label: 'メモ' },
    { key: 'status', label: 'ステータス' },
  ]

  const GENERIC_MAPPING_KEYWORDS: Record<string, string[]> = {
    product_name: ['商品名', '品名', 'アイテム名', 'item_name', 'name', '商品', '品目', '詳細', '商品タイトル', '啓上タイトル'],
    brand_name: ['ブランド', 'brand', 'メーカー', 'maker'],
    category: ['カテゴリ', 'category', '種類', '分類', '中分類', '商品区分'],
    image_url: ['画像', 'image', 'photo', '写真', 'url', 'image_01', 'オークション画像', '商品画像'],
    purchase_price: ['原価', '正味仕入値', '正味仕入額'],
    purchase_total: ['手数料・送料・税込', '手数料・送料・税込み', '手数料・送料・ 税込み', '手数料・送料・  税込み', '手数料・送料・ 税込', '手数料・送料', '仕入総額', '総額', 'total', '合計', 'buy_total', 'お支払い金額'],
    sale_price: ['販売価格', '売価', '出品価格', 'selling_price'],
    commission: ['写真・販売手数料', '販売手数料', 'commission', 'fee'],
    shipping_cost: ['送料', 'shipping', '配送料'],
    other_cost: ['経費', 'その他', 'other', '諸経費'],
    deposit_amount: ['入金', '入金額', 'deposit'],
    status: ['ステータス', 'status', '状態'],
    purchase_date: ['仕入日', '購入日', 'purchase_date', '取引日', '開催日', '終了日', '落札日'],
    listing_date: ['出品日', 'listing_date'],
    sale_date: ['売却日', '販売日', 'sale_date', '売上日'],
    purchase_source: ['仕入先', '仕入れ先', 'source', '出品者', '店舗'],
    sale_destination: ['販路', '販売先', '出品先', 'destination', '最終販路'],
    memo: ['メモ', 'memo', 'note', '備考', 'コメント'],
    inventory_number: ['管理番号', '番号', 'number', 'id', '商品ID', 'ロット番号', '箱番', 'No.'],
    profit: ['利益', 'profit', '粗利', '純利益'],
    profit_rate: ['利益率', 'profit_rate', '粗利率'],
    turnover_days: ['回転日数', 'turnover', '回転', '在庫日数'],
  }

  const autoMappingGeneric = (headers: string[]): Record<string, string> => {
    const result: Record<string, string> = {}

    // スペースを正規化する関数（全角・半角スペースを統一して削除）
    const normalizeSpaces = (str: string) => str.replace(/[\s\u3000]+/g, '')

    // 1. まず完全一致を優先
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().trim()
      const normalizedHeader = normalizeSpaces(lowerHeader)
      for (const [column, keywords] of Object.entries(GENERIC_MAPPING_KEYWORDS)) {
        const exactMatch = keywords.some(keyword => {
          const lowerKeyword = keyword.toLowerCase()
          const normalizedKeyword = normalizeSpaces(lowerKeyword)
          return lowerHeader === lowerKeyword || normalizedHeader === normalizedKeyword
        })
        if (exactMatch && !Object.values(result).includes(column)) {
          result[header] = column
          break
        }
      }
    })

    // 2. 次に部分一致（長いキーワードを優先）
    headers.forEach(header => {
      if (result[header]) return // 既にマッチ済みはスキップ
      const lowerHeader = header.toLowerCase().trim()
      const normalizedHeader = normalizeSpaces(lowerHeader)

      let bestMatch: { column: string; matchLength: number } | null = null

      for (const [column, keywords] of Object.entries(GENERIC_MAPPING_KEYWORDS)) {
        if (Object.values(result).includes(column)) continue // 既に使用済みはスキップ

        for (const keyword of keywords) {
          const lowerKeyword = keyword.toLowerCase()
          const normalizedKeyword = normalizeSpaces(lowerKeyword)
          if (lowerHeader.includes(lowerKeyword) || lowerKeyword.includes(lowerHeader) ||
              normalizedHeader.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedHeader)) {
            if (!bestMatch || keyword.length > bestMatch.matchLength) {
              bestMatch = { column, matchLength: keyword.length }
            }
          }
        }
      }

      if (bestMatch) {
        result[header] = bestMatch.column
      }
    })

    return result
  }

  const findHeaderRow = (rows: string[][]): number => {
    const headerKeywords = ['No.', '商品', '仕入', 'ブランド', '販売', '価格', '日付', 'ID', '名前', '名称']
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i]
      if (!row || row.length < 3) continue
      const rowText = row.join(',')
      const matchCount = headerKeywords.filter(kw => rowText.includes(kw)).length
      const nonEmptyCells = row.filter(cell => cell && cell.trim()).length
      if (matchCount >= 2 && nonEmptyCells >= 5) {
        return i
      }
    }
    return 0
  }

  const handleGenericCSVImport = (file: File) => {
    console.log('handleGenericCSVImport called:', file.name, file.size)

    // オークネット画像CSVかチェック（1行目からURLの場合はスキップ）
    const checkAndProcess = (text: string) => {
      const lines = text.trim().split('\n').slice(0, 5)
      const isImageCSV = lines.some(line => line.includes('image.brand-auc.com'))
      if (isImageCSV) {
        alert('オークネット画像CSVは「在庫管理」→「単品仕入一覧」から計算書CSVと一緒にインポートしてください。')
        return
      }
      tryParse(text)
    }

    const tryParse = (text: string) => {
      console.log('tryParse called, text length:', text.length)
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][]
          if (rows.length === 0) {
            alert('データがありません')
            return
          }
          const headerRowIndex = findHeaderRow(rows)
          const headerRow = rows[headerRowIndex]
          const dataRows = rows.slice(headerRowIndex + 1)

          const data = dataRows
            .filter(row => row.some(cell => cell && cell.trim()))
            .map(row => {
              const obj: Record<string, string> = {}
              headerRow.forEach((header, i) => {
                const key = header?.trim() || `列${i + 1}`
                if (key && row[i] !== undefined) {
                  obj[key] = row[i]?.trim() || ''
                }
              })
              return obj
            })

          if (data.length === 0) {
            alert('データがありません')
            return
          }

          const headers = headerRow.map((h, i) => h?.trim() || `列${i + 1}`).filter(h => h)
          const autoMapped = autoMappingGeneric(headers)

          setGenericImportModal({
            step: 'mapping',
            csvHeaders: headers,
            csvData: data,
            mapping: autoMapped,
            progress: 0,
          })
        }
      })
    }

    // まずUTF-8で読み込み、文字化けがあればShift-JISで再試行
    const reader = new FileReader()
    reader.onload = (event) => {
      console.log('FileReader onload triggered')
      const text = event.target?.result as string
      console.log('Text loaded, length:', text?.length, 'first 100 chars:', text?.substring(0, 100))
      // 文字化けの検出（よく使われる日本語が含まれているかチェック）
      const hasJapanese = /[あ-んア-ン一-龯]/.test(text)
      const hasGarbage = /[\ufffd\u0000-\u001f]/.test(text) && !hasJapanese
      console.log('hasJapanese:', hasJapanese, 'hasGarbage:', hasGarbage)

      if (hasGarbage || (!hasJapanese && text.includes('�'))) {
        console.log('Trying Shift-JIS...')
        // Shift-JISで再読み込み
        const sjisReader = new FileReader()
        sjisReader.onload = (e) => {
          const sjisText = e.target?.result as string
          console.log('Shift-JIS loaded, length:', sjisText?.length)
          checkAndProcess(sjisText)
        }
        sjisReader.onerror = (e) => {
          console.error('Shift-JIS read error:', e)
        }
        sjisReader.readAsText(file, 'Shift_JIS')
      } else {
        checkAndProcess(text)
      }
    }
    reader.onerror = (e) => {
      console.error('FileReader error:', e)
    }
    console.log('Starting to read file as UTF-8...')
    reader.readAsText(file, 'UTF-8')
  }

  const parseGenericDate = (value: string): string | null => {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null

    const formats = [
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})/,
      /^(\d{4})-(\d{1,2})-(\d{1,2})/,
      /^(\d{4})年(\d{1,2})月(\d{1,2})日/,
    ]
    for (const format of formats) {
      const match = trimmed.match(format)
      if (match) {
        const year = parseInt(match[1])
        const month = parseInt(match[2])
        const day = parseInt(match[3])
        if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
      }
    }
    // 日付形式でない場合も文字列としてそのまま保存（「返品」「不明」など）
    return trimmed
  }

  const parseGenericNumber = (value: string): number | null => {
    if (!value) return null
    // 括弧で囲まれた数値はマイナス（会計表記）→ 絶対値として取り込む
    const isNegative = /^\s*[\(（].*[\)）]\s*$/.test(value)
    // 括弧、円記号、カンマなどを除去
    const cleaned = value.replace(/[\(（\)）,￥¥円$]/g, '').trim()
    const num = parseFloat(cleaned)
    if (isNaN(num)) return null
    // 送料や手数料は正の値として保存（マイナス表記でも絶対値を使う）
    return Math.abs(num)
  }

  const executeGenericImport = async () => {
    if (!user || !genericImportModal) return
    const { csvData, mapping } = genericImportModal

    // 重複マッピングのチェック
    const mappedValues = Object.values(mapping).filter(v => v !== '')
    const duplicates = mappedValues.filter((v, i, arr) => arr.indexOf(v) !== i)
    if (duplicates.length > 0) {
      const duplicateLabels = [...new Set(duplicates)].map(key =>
        GENERIC_IMPORT_COLUMNS.find(col => col.key === key)?.label || key
      )
      alert(`マッピングが重複しています: ${duplicateLabels.join(', ')}\n同じ項目に複数の列をマッピングすることはできません。`)
      return
    }

    setGenericImportModal({ ...genericImportModal, step: 'importing', progress: 0 })

    // 最大の管理番号を取得して、その次から連番を割り当て
    const { data: maxData } = await supabase
      .from('inventory')
      .select('inventory_number')
      .order('inventory_number', { ascending: false })
      .limit(1)
      .single()
    let nextNumber = (maxData?.inventory_number || 0) + 1

    let success = 0
    let failed = 0
    const batchSize = 50

    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize)

      const records = batch.map(row => {
        const invNum = nextNumber++
        const record: Record<string, string | number | null> = {
          user_id: user.id,
          status: '在庫あり',
          inventory_number: invNum,
        }

        Object.entries(mapping).forEach(([csvHeader, inventoryColumn]) => {
          // profit/profit_rate/inventory_number/memoは自動で設定するのでインポートしない
          if (['profit', 'profit_rate', 'inventory_number', 'memo'].includes(inventoryColumn)) return
          let value = row[csvHeader]
          if (['purchase_price', 'purchase_total', 'sale_price', 'commission', 'shipping_cost', 'other_cost', 'deposit_amount'].includes(inventoryColumn)) {
            record[inventoryColumn] = parseGenericNumber(value)
          } else if (inventoryColumn === 'turnover_days') {
            const numVal = parseGenericNumber(value)
            record[inventoryColumn] = numVal !== null ? Math.round(numVal) : null
          } else if (['purchase_date', 'listing_date', 'sale_date'].includes(inventoryColumn)) {
            record[inventoryColumn] = parseGenericDate(value)
          } else if (inventoryColumn === 'purchase_source') {
            // 仕入れ先の名称変換
            if (value === 'エコリング') {
              value = 'エコオク'
            } else if (value === 'ペイペイ') {
              value = 'ヤフーフリマ'
            }
            record[inventoryColumn] = value || null
          } else {
            record[inventoryColumn] = value || null
          }
        })

        // 売却日または販売先があれば「売却済み」に自動設定
        if (record.sale_date || record.sale_destination) {
          record.status = '売却済み'
        }

        // メモを自動設定（管理番号）仕入総額）
        record.memo = `${invNum}）${record.purchase_total || 0}`

        return record
      }).filter(record => record.product_name) // 商品名がない行はスキップ

      if (records.length === 0) continue

      const { error } = await supabase.from('inventory').insert(records)
      if (error) {
        console.error('Import error:', JSON.stringify(error, null, 2))
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        console.error('First record:', JSON.stringify(records[0], null, 2))
        failed += records.length
      } else {
        success += records.length
      }

      setGenericImportModal(prev => prev ? { ...prev, progress: Math.round(((i + batch.length) / csvData.length) * 100) } : null)
    }

    setGenericImportModal(null)
    const skipped = csvData.length - success - failed
    alert(`インポート完了: ${success}件成功${failed > 0 ? `、${failed}件失敗` : ''}${skipped > 0 ? `、${skipped}件スキップ（商品名なし）` : ''}`)
    fetchInventory()
  }

  // 画像CSVをパースして管理番号→URL のマップを作成（スターバイヤーズ用）
  const parseImageCSV = (file: File): Promise<Map<string, string>> => {
    return new Promise((resolve) => {
      const imageMap = new Map<string, string>()
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'Shift_JIS',
        complete: (results) => {
          for (const row of results.data as Record<string, string>[]) {
            // Image URL列からURLを取得
            const url = row['Image URL'] || Object.values(row)[0] || ''
            if (url && url.startsWith('http')) {
              // URLから管理番号を抽出: https://image.nanboya.com/items/8357118/A3979810.JPG
              const match = url.match(/\/([A-Z0-9]+)\.(JPG|jpg|jpeg|png|webp)/i)
              if (match) {
                imageMap.set(match[1], url)
              }
            }
          }
          resolve(imageMap)
        },
        error: () => resolve(imageMap)
      })
    })
  }

  // モノバンク画像CSVをパース: 箱番-枝番 → URL のマップを作成
  const parseMonobankImageCSV = (file: File): Promise<Map<string, string>> => {
    return new Promise((resolve) => {
      const imageMap = new Map<string, string>()
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        encoding: 'Shift_JIS',
        complete: (results) => {
          for (const row of results.data as string[][]) {
            // ヘッダーなしなので row[0] がURL
            const url = (row[0] || '').replace(/^"/, '').replace(/"$/, '')
            if (url && url.startsWith('http')) {
              // URLから箱番-枝番を抽出: 1125-96-2-7A7MPB.jpg → 96-2
              // パターン: /日付-箱番-枝番(-追加ID)?-ID.jpg
              const match = url.match(/\/\d+-(\d+)-(\d+)(?:-\d+)?-[A-Z0-9]+\.jpg/i)
              if (match) {
                const key = `${match[1]}-${match[2]}`
                imageMap.set(key, url)
              }
            }
          }
          resolve(imageMap)
        },
        error: () => resolve(imageMap)
      })
    })
  }

  // スターバイヤーズの日付パース: "2025-11-14 14:00:00" → "2025/11/14"
  const parseStarBuyersDate = (dateStr: string): string | null => {
    if (!dateStr) return null
    const cleanStr = dateStr.replace(/['']/g, '').trim()
    const datePart = cleanStr.split(' ')[0]
    if (datePart.includes('-')) {
      const [y, m, d] = datePart.split('-')
      if (y && m && d) return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`
    }
    return datePart
  }

  const handleCSVUpload = async (file: File, purchaseDate: string | null, imageMap: Map<string, string> | null) => {
    setUploading(true)
    setPendingCSV(null)
    setStarBuyersImageCSV(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'Shift_JIS',
      complete: async (results) => {
        const firstRow = results.data[0]
        let items: {
          product_name: string
          brand_name: string | null
          category: string | null
          image_url: string | null
          purchase_price: number | null
          purchase_total: number | null
          purchase_date: string | null
          purchase_source: string
          status: string
        }[] = []
        let source = ''

        // CSV形式を自動判別
        if (firstRow && 'item_name' in firstRow) {
          // エコオク形式（bid_priceがあるものが仕入れ、日本語ヘッダー行はスキップ）
          source = 'エコオク'
          items = (results.data as EcoAucCSV[])
            .filter(row => row.item_name && row.item_name.trim() !== '' && row.item_name !== '商品名' && row.bid_price)
            .map(row => {
              // 正味仕入値（税抜）
              const purchasePriceVal = row.bid_price ? parseInt(row.bid_price, 10) : null
              // 仕入総額（税込・手数料込み）
              const purchaseTotalVal = row.buy_total
                ? parseInt(row.buy_total, 10)
                : row.bid_price
                  ? parseInt(row.bid_price, 10) + parseInt(row.bid_price_tax || '0', 10) + parseInt(row.purchase_commission || '0', 10) + parseInt(row.purchase_commission_tax || '0', 10)
                  : null

              return {
                product_name: row.item_name,
                brand_name: detectBrand(row.item_name),
                category: detectCategory(row.item_name),
                image_url: row.image_01 || null,
                purchase_price: purchasePriceVal,
                purchase_total: purchaseTotalVal,
                purchase_date: purchaseDate,
                purchase_source: 'エコオク',
                status: '在庫あり',
              }
            })
        } else if (firstRow && '管理番号' in firstRow && '落札金額' in firstRow) {
          // スターバイヤーズ形式
          source = 'スターバイヤーズ'
          items = (results.data as StarBuyersCSV[])
            .filter(row => row['商品名'] && row['商品名'].trim() !== '' && row['落札金額'])
            .map(row => {
              // 管理番号から画像URLを取得（''SB06-71 → SB06-71 のクリーニングも不要、管理番号列を使う）
              const kanriNo = (row['管理番号'] || '').replace(/^'+/, '').trim()
              const imageUrl = imageMap?.get(kanriNo) || null

              // 正味仕入値（落札金額・税抜）
              const purchasePriceVal = row['落札金額'] ? parseInt(row['落札金額'].replace(/,/g, ''), 10) : null
              // 仕入総額（合計・税込手数料込み）
              const purchaseTotalVal = row['合計'] ? parseInt(row['合計'].replace(/,/g, ''), 10) : null

              return {
                product_name: row['商品名'],
                brand_name: detectBrand(row['商品名']),
                category: detectCategory(row['商品名']),
                image_url: imageUrl,
                purchase_price: purchasePriceVal,
                purchase_total: purchaseTotalVal,
                purchase_date: parseStarBuyersDate(row['開催日']),
                purchase_source: 'スターバイヤーズ',
                status: '在庫あり',
              }
            })
        } else if (firstRow && '商品名' in firstRow && 'オークション画像URL' in firstRow) {
          // ヤフオク形式（税込金額）
          source = 'ヤフオク'
          items = (results.data as YahooAuctionCSV[])
            .filter(row => row['商品名'] && row['商品名'].trim() !== '')
            .map(row => {
              const totalPrice = row['落札価格'] ? parseInt(row['落札価格'], 10) : null
              // 正味仕入値 = 税込金額 ÷ 1.1（税抜）
              const netPrice = totalPrice ? Math.round(totalPrice / 1.1) : null
              return {
                product_name: row['商品名'],
                brand_name: detectBrand(row['商品名']),
                category: detectCategory(row['商品名']),
                image_url: row['オークション画像URL'] || null,
                purchase_price: netPrice,
                purchase_total: totalPrice,
                purchase_date: row['終了日時'] ? parseYahooDate(row['終了日時']) : null,
                purchase_source: 'ヤフオク',
                status: '在庫あり',
              }
            })
        } else if (firstRow && '購入日(YYYY/MM/DD)' in firstRow && 'お支払い金額' in firstRow) {
          // セカスト/トレファク形式（税込金額、画像URLで判別）
          const firstImageUrl = (firstRow as SecondStreetCSV)['画像URL'] || ''
          const isTorefac = firstImageUrl.includes('trefac.jp')
          source = isTorefac ? 'トレファク' : 'セカスト'
          items = (results.data as SecondStreetCSV[])
            .filter(row => row['商品名'] && row['商品名'].trim() !== '')
            .map(row => {
              // お支払い金額をパース: "¥ 20,460" → 20460 or "22650" → 22650（税込）
              const priceStr = (row['お支払い金額'] || '').replace(/[¥￥\s,]/g, '')
              const totalPrice = priceStr ? parseInt(priceStr, 10) : null
              // 正味仕入値 = 税込金額 ÷ 1.1（税抜）
              const netPrice = totalPrice ? Math.round(totalPrice / 1.1) : null
              // 購入日をパース: "2025/11/19" → "2025-11-19"
              const dateStr = (row['購入日(YYYY/MM/DD)'] || '').replace(/\//g, '-')
              // ブランド名はCSVから取得して辞書で変換、なければ商品名から検出
              const csvBrand = row['ブランド名']
              const brandName = csvBrand ? (detectBrand(csvBrand) || csvBrand) : detectBrand(row['商品名'])
              // 画像URLで仕入先を判別
              const imageUrl = row['画像URL'] || ''
              const purchaseSource = imageUrl.includes('trefac.jp') ? 'トレファク' : 'セカスト'

              return {
                product_name: row['商品名'],
                brand_name: brandName,
                category: detectCategory(row['商品名']),
                image_url: imageUrl || null,
                purchase_price: netPrice,
                purchase_total: totalPrice,
                purchase_date: dateStr || null,
                purchase_source: purchaseSource,
                status: '在庫あり',
              }
            })
        } else if (firstRow && '箱番' in firstRow && '枝番' in firstRow && '金額' in firstRow) {
          // モノバンク形式
          source = 'モノバンク'
          items = (results.data as MonobankCSV[])
            .filter(row => row['詳細'] && row['詳細'].trim() !== '' && row['金額'])
            .map(row => {
              // 金額をパース（正味仕入値＝落札金額）
              const priceStr = (row['金額'] || '').replace(/[¥￥\s,]/g, '')
              const price = priceStr ? parseInt(priceStr, 10) : null
              // 仕入総額 = 落札金額 × 1.03（落札手数料3%） × 1.1（消費税10%）
              const purchaseTotal = price ? Math.round(price * 1.03 * 1.1) : null
              // 取引日をパース: "2025-11-13" → そのまま使用
              const dateStr = row['取引日'] || null
              // ブランド名はCSVから取得して辞書で変換
              const csvBrand = row['ブランド']
              const brandName = csvBrand ? (detectBrand(csvBrand) || csvBrand) : detectBrand(row['詳細'])
              // 箱番-枝番で画像URLをマッチング
              const boxNo = row['箱番']
              const branchNo = row['枝番']
              const imageKey = `${boxNo}-${branchNo}`
              const imageUrl = imageMap?.get(imageKey) || null

              // モノバンクはカテゴリ列があるので優先、なければ商品名から検出
              const csvCategory = row['カテゴリー']
              const category = csvCategory ? (detectCategory(csvCategory) || csvCategory) : detectCategory(row['詳細'])

              return {
                product_name: row['詳細'],
                brand_name: brandName,
                category: category,
                image_url: imageUrl,
                purchase_price: price,
                purchase_total: purchaseTotal,
                purchase_date: dateStr,
                purchase_source: 'モノバンク',
                status: '在庫あり',
              }
            })
        } else {
          // 不明な形式は汎用インポートモーダルを表示（このケースには到達しないはずだが念のため）
          setUploading(false)
          return
        }

        if (items.length > 0) {
          // ステップ1: 重複チェック
          setUploadProgress({ stage: '重複チェック中', current: 0, total: items.length })

          // 既存データを全件取得（Supabaseのデフォルト1000件制限を回避）
          let existingItems: { product_name: string; purchase_date: string | null; purchase_total: number | null; image_url: string | null }[] = []
          let offset = 0
          const batchSize = 1000
          while (true) {
            const { data } = await supabase
              .from('inventory')
              .select('product_name, purchase_date, purchase_total, image_url')
              .range(offset, offset + batchSize - 1)
            if (!data || data.length === 0) break
            existingItems = existingItems.concat(data)
            if (data.length < batchSize) break
            offset += batchSize
          }

          // 重複チェック用のキーを生成
          // 画像URLでも判定、商品名+仕入日+仕入総額でも判定（両方チェック）
          const existingImageUrls = new Set(
            (existingItems || []).filter(item => item.image_url).map(item => item.image_url)
          )
          const existingKeys = new Set(
            (existingItems || []).map(item => `${item.product_name}|${item.purchase_date}|${item.purchase_total}`)
          )

          console.log('=== 重複チェックデバッグ ===')
          console.log('既存データ件数:', existingItems?.length || 0)
          console.log('既存キー例（最初の3件）:', Array.from(existingKeys).slice(0, 3))
          console.log('CSVアイテム件数:', items.length)
          console.log('CSVアイテム例（最初の1件）:', items[0] ? `${items[0].product_name}|${items[0].purchase_date}|${items[0].purchase_total}` : 'なし')

          // 重複を除外し、スキップされたアイテムも記録
          const newItems: typeof items = []
          const skippedItems: typeof items = []

          for (const item of items) {
            const key = `${item.product_name}|${item.purchase_date}|${item.purchase_total}`
            // 画像URLが一致、または商品名+日付+金額が一致していれば重複
            if ((item.image_url && existingImageUrls.has(item.image_url)) || existingKeys.has(key)) {
              skippedItems.push(item)
            } else {
              newItems.push(item)
            }
          }

          console.log('新規アイテム:', newItems.length, '件')
          console.log('スキップ:', skippedItems.length, '件')

          if (newItems.length === 0) {
            setImportResult({
              source,
              newItems: [],
              skippedItems: skippedItems.map(i => ({ product_name: i.product_name, purchase_total: i.purchase_total }))
            })
            setUploadProgress(null)
            setUploading(false)
            return
          }

          // まとめ仕入れと単品を分離
          const bulkItems = newItems.filter(item => isBulkItem(item.product_name))
          const singleItems = newItems.filter(item => !isBulkItem(item.product_name))

          // ステップ2: DB登録
          setUploadProgress({ stage: 'データベースに登録中', current: 0, total: newItems.length })

          let insertedData: InventoryItem[] | null = null

          // まとめ仕入れをbulk_purchasesに登録
          if (bulkItems.length > 0) {
            const bulkPurchasesToInsert = bulkItems.map(item => ({
              genre: detectGenreFromName(item.product_name),
              purchase_date: item.purchase_date || new Date().toISOString().split('T')[0],
              purchase_source: item.purchase_source,
              total_amount: item.purchase_total || 0,
              total_quantity: extractQuantityFromName(item.product_name),
              memo: item.product_name, // 元の商品名をメモに保存
              user_id: user?.id
            }))

            const { error: bulkError } = await supabase
              .from('bulk_purchases')
              .insert(bulkPurchasesToInsert)

            if (bulkError) {
              console.error('Error inserting bulk purchases:', bulkError.message)
            }
          }

          // 単品をinventoryに登録
          if (singleItems.length > 0) {
            // 最大の管理番号を取得して、その次から連番を割り当て
            const { data: maxData } = await supabase
              .from('inventory')
              .select('inventory_number')
              .order('inventory_number', { ascending: false })
              .limit(1)
              .single()
            let nextNumber = (maxData?.inventory_number || 0) + 1

            const singleItemsWithUserId = singleItems.map(item => {
              const invNum = nextNumber++
              return {
                ...item,
                user_id: user?.id,
                inventory_number: invNum,
                memo: `${invNum}）${item.purchase_total || 0}`
              }
            })
            const { data, error } = await supabase
              .from('inventory')
              .insert(singleItemsWithUserId)
              .select()

            if (error) {
              console.error('Error inserting data:', error.message, error.details, error.hint)
              alert(`データの登録に失敗しました: ${error.message}`)
              setUploadProgress(null)
            } else {
              insertedData = data
            }
          }

          setUploadProgress({ stage: 'データベースに登録中', current: newItems.length, total: newItems.length })

          // ステップ3: 画像を保存（単品のみ）
          if (insertedData) {
            const itemsWithImages = insertedData.filter(item => item.image_url)
            const totalImages = itemsWithImages.length

            if (totalImages > 0) {
              setUploadProgress({ stage: '画像を保存中', current: 0, total: totalImages })

              for (let i = 0; i < itemsWithImages.length; i++) {
                const item = itemsWithImages[i]
                try {
                  await fetch('/api/save-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      imageUrl: item.image_url,
                      inventoryId: item.id,
                    }),
                  })
                } catch (e) {
                  console.error('Image save error:', e)
                }
                setUploadProgress({ stage: '画像を保存中', current: i + 1, total: totalImages })
              }
            }
          }

          fetchInventory()

          // 結果を表示（まとめ仕入れと単品を区別）
          const resultNewItems = [
            ...singleItems.map(i => ({ product_name: i.product_name, purchase_total: i.purchase_total })),
            ...bulkItems.map(i => ({ product_name: `【まとめ仕入れへ】${i.product_name}`, purchase_total: i.purchase_total }))
          ]
          setImportResult({
            source,
            newItems: resultNewItems,
            skippedItems: skippedItems.map(i => ({ product_name: i.product_name, purchase_total: i.purchase_total }))
          })
        }
        setUploadProgress(null)
        setUploading(false)
      },
      error: (error) => {
        console.error('CSV parse error:', error)
        alert('CSVの読み込みに失敗しました')
        setUploading(false)
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この商品を削除しますか？')) return

    const { error } = await supabase.from('inventory').delete().eq('id', id)
    if (error) {
      alert('削除に失敗しました')
    } else {
      fetchInventory()
    }
  }

  // 手動商品追加
  const handleAddItem = async () => {
    if (!newItemForm.product_name.trim()) {
      alert('商品名を入力してください')
      return
    }

    const productName = newItemForm.product_name.trim()

    // まとめ仕入れかどうかを判定
    if (isBulkItem(productName)) {
      // まとめ仕入れに振り分け
      const bulkItem = {
        genre: detectGenreFromName(productName),
        purchase_date: newItemForm.purchase_date || new Date().toISOString().split('T')[0],
        purchase_source: newItemForm.purchase_source || null,
        total_amount: newItemForm.purchase_total ? parseInt(newItemForm.purchase_total, 10) : 0,
        total_quantity: extractQuantityFromName(productName),
        purchase_price: newItemForm.purchase_price ? parseInt(newItemForm.purchase_price, 10) : null,
        memo: productName,
        user_id: user?.id
      }

      const { error } = await supabase.from('bulk_purchases').insert(bulkItem)

      if (error) {
        console.error('Error inserting bulk purchase:', error)
        alert('まとめ仕入れの登録に失敗しました')
      } else {
        alert('まとめ仕入れとして登録しました（まとめ仕入れ在庫一覧で確認できます）')
        setShowAddItemModal(false)
        setNewItemForm({
          product_name: '',
          brand_name: '',
          category: '',
          purchase_price: '',
          purchase_total: '',
          purchase_date: '',
          purchase_source: '',
        })
      }
    } else {
      // 単品仕入れに登録
      // 最大の管理番号を取得して、その次の番号を割り当て
      const { data: maxData } = await supabase
        .from('inventory')
        .select('inventory_number')
        .order('inventory_number', { ascending: false })
        .limit(1)
        .single()
      const nextNumber = (maxData?.inventory_number || 0) + 1

      const purchaseTotal = newItemForm.purchase_total ? parseInt(newItemForm.purchase_total, 10) : 0
      const singleItem = {
        product_name: productName,
        brand_name: newItemForm.brand_name || detectBrand(productName) || null,
        category: newItemForm.category || detectCategory(productName) || null,
        purchase_price: newItemForm.purchase_price ? parseInt(newItemForm.purchase_price, 10) : null,
        purchase_total: purchaseTotal || null,
        purchase_date: newItemForm.purchase_date || null,
        purchase_source: newItemForm.purchase_source || null,
        status: '在庫あり',
        user_id: user?.id,
        inventory_number: nextNumber,
        memo: `${nextNumber}）${purchaseTotal}`
      }

      const { error } = await supabase.from('inventory').insert(singleItem)

      if (error) {
        console.error('Error inserting inventory:', error)
        alert('商品の登録に失敗しました')
      } else {
        setShowAddItemModal(false)
        setNewItemForm({
          product_name: '',
          brand_name: '',
          category: '',
          purchase_price: '',
          purchase_total: '',
          purchase_date: '',
          purchase_source: '',
        })
        fetchInventory()
      }
    }
  }

  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('削除する商品を選択してください')
      return
    }
    if (!confirm(`${selectedIds.size}件の商品を削除しますか？`)) return

    const ids = Array.from(selectedIds)
    console.log('削除対象ID:', ids.length, '件')

    // 大量削除の場合は100件ずつバッチ処理
    const batchSize = 100
    let hasError = false
    let errorMessage = ''

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      console.log(`バッチ ${Math.floor(i / batchSize) + 1}: ${batch.length}件を削除中...`)
      const { error } = await supabase.from('inventory').delete().in('id', batch)
      if (error) {
        console.error('削除エラー:', error)
        hasError = true
        errorMessage = error.message
        break
      }
    }

    if (hasError) {
      alert(`削除に失敗しました: ${errorMessage}`)
    } else {
      setSelectedIds(new Set())
      fetchInventory()
    }
  }

  // 画像一括移行（Supabase Storageへ）
  const [isMigratingImages, setIsMigratingImages] = useState(false)
  const handleMigrateImages = async () => {
    if (selectedIds.size === 0) {
      alert('画像を移行する商品を選択してください')
      return
    }

    // 選択された商品のうち、外部画像URLを持つものを抽出
    const itemsToMigrate = inventory.filter(item => {
      if (!selectedIds.has(item.id)) return false
      const imageUrl = item.saved_image_url || item.image_url
      if (!imageUrl) return false
      // すでにSupabase StorageやBase64の場合はスキップ
      if (imageUrl.includes('supabase.co/storage')) return false
      if (imageUrl.startsWith('data:')) return false
      return true
    })

    if (itemsToMigrate.length === 0) {
      alert('移行対象の画像がありません（すでに移行済みか、画像がない商品です）')
      return
    }

    if (!confirm(`${itemsToMigrate.length}件の画像をSupabase Storageに移行しますか？\n\n※1件ずつ処理するため、時間がかかる場合があります`)) {
      return
    }

    setIsMigratingImages(true)
    let success = 0
    let failed = 0

    try {
      // 10件ずつバッチ処理
      const batchSize = 10
      for (let i = 0; i < itemsToMigrate.length; i += batchSize) {
        const batch = itemsToMigrate.slice(i, i + batchSize)
        const items = batch.map(item => ({
          id: item.id,
          imageUrl: item.saved_image_url || item.image_url || ''
        }))

        const response = await fetch('/api/upload-image', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        })

        if (response.ok) {
          const { results } = await response.json()
          for (const result of results) {
            if (result.success && result.url) {
              // DBを更新
              await supabase
                .from('inventory')
                .update({ saved_image_url: result.url })
                .eq('id', result.id)
              success++
            } else {
              failed++
            }
          }
        } else {
          failed += batch.length
        }
      }

      alert(`画像移行完了\n\n成功: ${success}件\n失敗: ${failed}件`)
      setSelectedIds(new Set())
      fetchInventory()
    } catch (error) {
      console.error('Image migration error:', error)
      alert('画像移行中にエラーが発生しました')
    } finally {
      setIsMigratingImages(false)
    }
  }

  // データ一括更新（ステータス・ブランド・カテゴリ自動検出）
  const [isAutoUpdating, setIsAutoUpdating] = useState(false)
  const handleAutoUpdate = async () => {
    if (!confirm('全在庫データに対して以下の自動更新を実行しますか？\n\n・売却ステータスの更新（売却日/販売先があれば「売却済み」に）\n・ブランド名の自動検出（未設定の商品のみ）\n・カテゴリの自動検出（未設定の商品のみ）')) {
      return
    }

    setIsAutoUpdating(true)
    let updated = 0
    let errors = 0
    const batchSize = 50

    try {
      for (let i = 0; i < inventory.length; i += batchSize) {
        const batch = inventory.slice(i, i + batchSize)

        for (const item of batch) {
          const updates: Record<string, string | null> = {}

          // ステータス自動更新
          if (item.sale_date || item.sale_destination) {
            if (item.status !== '売却済み') {
              updates.status = '売却済み'
            }
          } else {
            if (item.status === '売却済み') {
              updates.status = '在庫あり'
            }
          }

          // ブランド名自動検出（未設定の場合のみ）
          if (!item.brand_name && item.product_name) {
            const detectedBrand = detectBrand(item.product_name)
            if (detectedBrand) {
              updates.brand_name = detectedBrand
            }
          }

          // カテゴリ自動検出（未設定の場合のみ）
          if (!item.category && item.product_name) {
            const detectedCategory = detectCategory(item.product_name)
            if (detectedCategory) {
              updates.category = detectedCategory
            }
          }

          // 更新がある場合のみDB更新
          if (Object.keys(updates).length > 0) {
            const { error } = await supabase
              .from('inventory')
              .update(updates)
              .eq('id', item.id)

            if (error) {
              errors++
            } else {
              updated++
            }
          }
        }
      }

      alert(`データ更新が完了しました\n\n更新件数: ${updated}件\nエラー: ${errors}件`)
      fetchInventory()
    } catch (error) {
      console.error('Auto update error:', error)
      alert('更新中にエラーが発生しました')
    } finally {
      setIsAutoUpdating(false)
    }
  }

  // 空の行を追加
  const handleAddRow = async () => {
    try {
      // 現在の最大管理番号を取得
      const maxInventoryNumber = inventory.reduce((max, item) => {
        const num = parseInt(item.inventory_number || '0', 10)
        return isNaN(num) ? max : Math.max(max, num)
      }, 0)
      const newInventoryNumber = String(maxInventoryNumber + 1)

      const { data, error } = await supabase
        .from('inventory')
        .insert({
          product_name: '新規商品',
          status: '在庫中',
          inventory_number: newInventoryNumber,
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding row:', error)
        alert('行の追加に失敗しました: ' + error.message)
        return
      }

      // 追加した行を最後に追加
      setInventory(prev => [...prev, data])

      // 追加した行の商品名をモーダルで編集
      setModalEdit({ id: data.id, field: 'product_name', value: '新規商品' })
    } catch (error) {
      console.error('Error adding row:', error)
      alert('行の追加に失敗しました: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  // セルをクリックしたとき（1回目：選択、2回目：編集）
  const handleCellClick = (item: InventoryItem, field: keyof InventoryItem) => {
    // 既に編集中なら何もしない
    if (editingCell?.id === item.id && editingCell?.field === field) return

    // 入力フィールドからフォーカスを外す（直接入力を可能にするため）
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      const tag = document.activeElement.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        document.activeElement.blur()
      }
    }

    // 同じセルが選択されている場合は編集モードに入る
    if (selectedCell?.id === item.id && selectedCell?.field === field && !selectionRange) {
      startEditCell(item, field)
      return
    }

    // 別のセルをクリックした場合は選択状態にする
    setSelectedCell({ id: item.id, field })
    setSelectionRange(null) // 範囲選択をクリア
    // 編集中のセルがあれば保存
    if (editingCell) {
      saveEditingCell()
    }
  }

  // ダブルクリックで直接編集モードに入る
  const handleCellDoubleClick = (item: InventoryItem, field: keyof InventoryItem) => {
    if (editingCell?.id === item.id && editingCell?.field === field) return
    setSelectedCell({ id: item.id, field })
    setSelectionRange(null)
    startEditCell(item, field)
  }

  // ドラッグ開始
  const handleCellMouseDown = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    if (e.button !== 0) return // 左クリックのみ
    if (editingCell) return // 編集中は無視

    setIsDragging(true)
    setSelectionRange({
      startRow: rowIndex,
      startCol: colIndex,
      endRow: rowIndex,
      endCol: colIndex
    })
  }

  // ドラッグ中
  const handleCellMouseEnter = (rowIndex: number, colIndex: number) => {
    if (!isDragging || !selectionRange) return

    setSelectionRange(prev => prev ? {
      ...prev,
      endRow: rowIndex,
      endCol: colIndex
    } : null)
  }

  // オートフィルハンドル開始
  const handleAutoFillStart = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsAutoFilling(true)
    setAutoFillRange({
      sourceRow: rowIndex,
      sourceCol: colIndex,
      endRow: rowIndex,
      endCol: colIndex
    })
  }

  // オートフィル中のマウス移動
  const handleAutoFillMouseEnter = (rowIndex: number, colIndex: number) => {
    if (!isAutoFilling || !autoFillRange) return
    // 縦方向のみ（同じ列）のオートフィルに制限
    if (colIndex === autoFillRange.sourceCol) {
      setAutoFillRange(prev => prev ? {
        ...prev,
        endRow: rowIndex,
        endCol: colIndex
      } : null)
    }
  }

  // オートフィル範囲内かどうかチェック
  const isCellInAutoFillRange = (rowIndex: number, colIndex: number): boolean => {
    if (!autoFillRange) return false
    if (colIndex !== autoFillRange.sourceCol) return false
    const minRow = Math.min(autoFillRange.sourceRow, autoFillRange.endRow)
    const maxRow = Math.max(autoFillRange.sourceRow, autoFillRange.endRow)
    // ソースセルは含まない
    if (rowIndex === autoFillRange.sourceRow) return false
    return rowIndex >= minRow && rowIndex <= maxRow
  }

  // ドラッグ終了
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [isDragging])

  // 範囲内のセルかどうかチェック
  const isCellInRange = (rowIndex: number, colIndex: number): boolean => {
    if (!selectionRange) return false
    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)
    return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol
  }

  const startEditCell = (item: InventoryItem, field: keyof InventoryItem) => {
    if (editingCell?.id === item.id && editingCell?.field === field) return
    const value = item[field]
    const valueStr = value !== null && value !== undefined ? String(value) : ''

    // 商品名はモーダルで編集
    if (field === 'product_name') {
      setModalEdit({ id: item.id, field, value: valueStr })
      return
    }

    setEditingCell({ id: item.id, field })
    setEditValue(valueStr)
  }

  const saveModalEdit = async () => {
    if (!modalEdit) return
    const { id, field, value } = modalEdit

    console.log('saveModalEdit called:', { id, field, value })
    console.log('Checking for まとめ:', field === 'product_name', value, value?.includes('まとめ'))

    // 商品名に「まとめ」が含まれる場合、まとめ在庫に移動
    if (field === 'product_name' && value && value.includes('まとめ')) {
      console.log('まとめ detected!')
      const currentItem = inventory.find(item => item.id === id)
      console.log('currentItem:', currentItem)
      if (currentItem) {
        // まとめ仕入れを取得して選択ダイアログを表示
        const { data: bulkPurchases, error: fetchError } = await supabase
          .from('bulk_purchases')
          .select('*')
          .order('purchase_date', { ascending: false })

        console.log('bulkPurchases:', bulkPurchases, 'fetchError:', fetchError)

        let selectedPurchaseId: string | null = null

        if (bulkPurchases && bulkPurchases.length > 0) {
          console.log('Showing prompt dialog...')
          // 確認ダイアログ
          const purchaseOptions = bulkPurchases.map((p: { genre: string; purchase_date: string }, i: number) => `${i + 1}. ${p.genre} (${p.purchase_date})`).join('\n')
          const selectedIndex = prompt(`「まとめ」が含まれています。まとめ在庫に移動しますか？\n移動先の番号を入力してください（キャンセルで移動しない）:\n\n${purchaseOptions}\n\n0. 新規まとめ仕入れを作成`)

          if (selectedIndex === null || selectedIndex === '') {
            // キャンセル - 通常の保存処理へ
          } else if (selectedIndex === '0') {
            // 新規まとめ仕入れを作成 - 商品名からジャンルを自動推測
            let genre = detectGenreFromName(value)
            if (genre === 'その他') {
              const inputGenre = prompt('ジャンルを自動検出できませんでした。\nジャンルを入力してください（例: ネクタイ）')
              if (inputGenre) {
                genre = inputGenre
              } else {
                genre = ''
              }
            } else {
              const confirmed = confirm(`ジャンル「${genre}」で作成しますか？\n（キャンセルで別のジャンルを入力）`)
              if (!confirmed) {
                const inputGenre = prompt('ジャンルを入力してください（例: ネクタイ）')
                if (inputGenre) {
                  genre = inputGenre
                } else {
                  genre = ''
                }
              }
            }

            if (genre) {
              const { data: newPurchase, error: createError } = await supabase
                .from('bulk_purchases')
                .insert({
                  genre: genre,
                  purchase_date: new Date().toISOString().split('T')[0],
                  total_amount: 0,
                  total_quantity: 0,
                  user_id: user?.id
                })
                .select()
                .single()

              if (!createError && newPurchase) {
                selectedPurchaseId = newPurchase.id
              }
            }
          } else {
            const idx = parseInt(selectedIndex) - 1
            if (idx >= 0 && idx < bulkPurchases.length) {
              selectedPurchaseId = bulkPurchases[idx].id
            }
          }
        } else {
          // まとめ仕入れがない場合、新規作成するか確認
          const createNew = confirm('まとめ仕入れがありません。新規作成しますか？')
          if (createNew) {
            // 商品名からジャンルを自動推測
            let genre = detectGenreFromName(value)
            // 「その他」の場合は手動入力
            if (genre === 'その他') {
              const inputGenre = prompt('ジャンルを自動検出できませんでした。\nジャンルを入力してください（例: ネクタイ）')
              if (inputGenre) {
                genre = inputGenre
              } else {
                genre = '' // キャンセル
              }
            } else {
              // 推測されたジャンルを確認
              const confirmed = confirm(`ジャンル「${genre}」で作成しますか？\n（キャンセルで別のジャンルを入力）`)
              if (!confirmed) {
                const inputGenre = prompt('ジャンルを入力してください（例: ネクタイ）')
                if (inputGenre) {
                  genre = inputGenre
                } else {
                  genre = '' // キャンセル
                }
              }
            }

            if (genre) {
              const { data: newPurchase, error: createError } = await supabase
                .from('bulk_purchases')
                .insert({
                  genre: genre,
                  purchase_date: new Date().toISOString().split('T')[0],
                  total_amount: 0,
                  total_quantity: 0,
                  user_id: user?.id
                })
                .select()
                .single()

              if (!createError && newPurchase) {
                selectedPurchaseId = newPurchase.id
              }
            }
          }
        }

        // 選択されたまとめ仕入れに移動
        if (selectedPurchaseId) {
          const { error: insertError } = await supabase
            .from('bulk_sales')
            .insert({
              bulk_purchase_id: selectedPurchaseId,
              sale_date: currentItem.sale_date || new Date().toISOString().split('T')[0],
              sale_destination: currentItem.sale_destination || null,
              quantity: 1,
              sale_amount: currentItem.sale_price || 0,
              commission: currentItem.commission || 0,
              shipping_cost: currentItem.shipping_cost || 0,
              memo: currentItem.memo || null,
              product_name: value,
              brand_name: currentItem.brand_name || null,
              category: currentItem.category || null,
              image_url: currentItem.image_url || currentItem.saved_image_url || null,
              purchase_price: currentItem.purchase_price || null,
              other_cost: currentItem.other_cost || 0,
              deposit_amount: currentItem.deposit_amount || null,
              listing_date: currentItem.listing_date || null,
              user_id: user?.id
            })

          if (!insertError) {
            // inventoryから削除
            await supabase.from('inventory').delete().eq('id', id)
            setInventory(prev => prev.filter(item => item.id !== id))
            setModalEdit(null)
            alert('まとめ在庫に移動しました')
            return
          }
        }
      }
    }

    const { error } = await supabase
      .from('inventory')
      .update({ [field]: value || null })
      .eq('id', id)

    if (!error) {
      setInventory(prev => prev.map(item =>
        item.id === id ? { ...item, [field]: value || null } : item
      ))
    }
    setModalEdit(null)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'))
      if (files.length === 0) {
        alert('CSVファイルをアップロードしてください')
        return
      }
      handleCSVFilesSelect(files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      handleCSVFilesSelect(files)
      // 同じファイルを再度選択できるようにリセット
      e.target.value = ''
    }
  }

  // 複数ファイル対応: オークネットの場合は計算書CSVと画像CSVを同時選択可能
  const handleCSVFilesSelect = async (files: File[]) => {
    // オークネット画像CSVかチェック
    const checkImageCSV = (text: string): boolean => {
      const lines = text.trim().split('\n').slice(0, 5)
      return lines.some(line => line.includes('image.brand-auc.com'))
    }

    // ファイルを読み込んでテキストとして返す（エンコード自動判定）
    const readFileAsText = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const text = event.target?.result as string
          const hasJapanese = /[あ-んア-ン一-龯]/.test(text)
          const hasGarbage = /[\ufffd\u0000-\u001f]/.test(text) && !hasJapanese
          if (hasGarbage || (!hasJapanese && text.includes('�'))) {
            const sjisReader = new FileReader()
            sjisReader.onload = (e) => resolve(e.target?.result as string)
            sjisReader.readAsText(file, 'Shift_JIS')
          } else {
            resolve(text)
          }
        }
        reader.readAsText(file, 'UTF-8')
      })
    }

    // 1ファイルの場合は従来通り
    if (files.length === 1) {
      const text = await readFileAsText(files[0])
      if (checkImageCSV(text)) {
        alert('オークネット画像CSVだけでは取り込めません。計算書CSVも一緒に選択してください。')
        return
      }
      handleCSVSelect(files[0])
      return
    }

    // 2ファイル以上: オークネット計算書CSVと画像CSVを探す
    let mainFile: File | null = null
    let imageFile: File | null = null

    for (const file of files) {
      const text = await readFileAsText(file)
      if (checkImageCSV(text)) {
        imageFile = file
      } else {
        mainFile = file
      }
    }

    if (mainFile && imageFile) {
      // 両方ある場合は直接オークネットインポートを実行（state経由だと非同期で遅延する）
      console.log('オークネット2ファイルインポート開始:', mainFile.name, imageFile.name)
      handleAucnetImport(mainFile, imageFile)
    } else if (mainFile) {
      handleCSVSelect(mainFile)
    } else {
      alert('認識できるCSVファイルがありませんでした')
    }
  }

  // ドロップダウン用のユニーク値リスト
  const uniqueBrands = useMemo(() =>
    [...new Set(inventory.map(i => i.brand_name).filter(Boolean))].sort() as string[],
    [inventory]
  )
  const uniquePurchaseSources = useMemo(() =>
    [...new Set(inventory.map(i => i.purchase_source).filter(Boolean))].sort() as string[],
    [inventory]
  )

  // 在庫統計情報を計算
  const inventoryStats = useMemo(() => {
    // 有効な日付かどうかをチェック（YYYY-MM-DD形式で2000年以降）
    const isValidDate = (value: string | null) => {
      if (!value) return false
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!match) return false
      const year = parseInt(match[1])
      return year >= 2000 // 2000年以降のみ有効
    }

    // 除外すべき文字列かどうかをチェック
    const isExcludedText = (value: string | null) => {
      if (!value) return false
      return value.includes('返品') || value.includes('不明')
    }

    const totalCount = inventory.length // 累計在庫数

    // 除外対象：売却日または出品日に「返品」「不明」が含まれるもの
    const validItems = inventory.filter(i =>
      !isExcludedText(i.sale_date) && !isExcludedText(i.listing_date)
    )

    // 未販売：売却日が空のもの、かつ返品でないもの
    const unsoldItems = validItems.filter(i => !i.sale_date && i.sale_destination !== '返品')
    const unsoldCount = unsoldItems.length // 未販売数

    // 未出品：出品日が空のもの（スプシと同じ条件）
    const unlistedItems = unsoldItems.filter(i => !i.listing_date)
    const unlistedCount = unlistedItems.length // 未出品数

    // 未出品在庫額（未出品の仕入総額の合計）
    const unlistedStockValue = unlistedItems.reduce((sum, i) => sum + (i.purchase_total || 0), 0)

    // 合計正味在庫額（未販売の正味仕入値の合計）
    const totalNetStockValue = unsoldItems.reduce((sum, i) => sum + (i.purchase_price || 0), 0)

    // 合計仕入総額（未販売の仕入総額の合計）
    const totalPurchaseValue = unsoldItems.reduce((sum, i) => sum + (i.purchase_total || 0), 0)

    // 平均在庫単価（未販売の仕入総額の平均）
    const avgUnitPrice = unsoldCount > 0 ? Math.round(totalPurchaseValue / unsoldCount) : 0

    // 未出品率（未販売在庫のうち未出品の割合）
    const unlistedRate = unsoldCount > 0 ? Math.round((unlistedCount / unsoldCount) * 100) : 0

    // 未出品在庫額の割合（仕入総額に対する未出品在庫額の割合）
    const unlistedStockRate = totalPurchaseValue > 0 ? Math.round((unlistedStockValue / totalPurchaseValue) * 100) : 0

    // 滞留在庫数（出品からの経過日数でフィルタ）
    const now = new Date()
    const calcStaleDays = (listingDate: string) => {
      return Math.floor((now.getTime() - new Date(listingDate).getTime()) / (1000 * 60 * 60 * 24))
    }

    // 30日以上
    const stale30Items = unsoldItems.filter(i => {
      if (!i.listing_date) return false
      return calcStaleDays(i.listing_date) >= 30
    })
    const stale30Count = stale30Items.length
    const stale30StockValue = stale30Items.reduce((sum, i) => sum + (i.purchase_total || 0), 0)

    // 90日以上
    const stale90Items = unsoldItems.filter(i => {
      if (!i.listing_date) return false
      return calcStaleDays(i.listing_date) >= 90
    })
    const stale90Count = stale90Items.length
    const stale90StockValue = stale90Items.reduce((sum, i) => sum + (i.purchase_total || 0), 0)

    // 返品
    const returnsItems = inventory.filter(i => i.sale_destination === '返品')
    const returnsCount = returnsItems.length

    return {
      totalCount,
      unsoldCount,
      unlistedCount,
      unlistedStockValue,
      totalNetStockValue,
      totalPurchaseValue,
      avgUnitPrice,
      unlistedRate,
      unlistedStockRate,
      stale30Count,
      stale30StockValue,
      stale90Count,
      stale90StockValue,
      returnsCount,
    }
  }, [inventory])

  // 日付フィルター用のユニーク年月リストを取得
  const getUniqueDateOptions = useMemo(() => {
    const extractYearsMonths = (dates: (string | null)[]) => {
      const years = new Set<string>()
      const months = new Set<string>()
      dates.forEach(d => {
        if (d) {
          const match = d.match(/(\d{4})[-/](\d{1,2})/)
          if (match) {
            years.add(match[1])
            months.add(match[2].padStart(2, '0'))
          }
        }
      })
      return {
        years: [...years].sort().reverse(),
        months: [...months].sort()
      }
    }
    return {
      purchase_date: extractYearsMonths(inventory.map(i => i.purchase_date)),
      listing_date: extractYearsMonths(inventory.map(i => i.listing_date)),
      sale_date: extractYearsMonths(inventory.map(i => i.sale_date)),
    }
  }, [inventory])

  // ソート処理
  const handleSort = (key: string) => {
    // ソートできない列はスキップ
    if (['index', 'image', 'actions', 'profit', 'profit_rate', 'turnover_days'].includes(key)) return

    setSortConfig(prev => {
      if (prev?.key === key) {
        // 同じ列をクリック：昇順→降順→解除
        if (prev.direction === 'asc') return { key, direction: 'desc' }
        return null
      }
      return { key, direction: 'asc' }
    })
  }

  // 日付フィルターのチェック関数
  const matchesDateFilter = (dateStr: string | null, filter: { year: string; month: string }) => {
    if (!filter.year && !filter.month) return true
    if (!dateStr) return false
    const match = dateStr.match(/(\d{4})[-/](\d{1,2})/)
    if (!match) return false
    const year = match[1]
    const month = match[2].padStart(2, '0')
    if (filter.year && year !== filter.year) return false
    if (filter.month && month !== filter.month) return false
    return true
  }

  // 期間フィルターのチェック関数
  const matchesDateRangeFilter = (item: InventoryItem) => {
    const { dateType, startDate, endDate } = dateRangeFilter
    if (!startDate && !endDate) return true

    const dateStr = item[dateType]
    if (!dateStr) return false

    const itemDate = new Date(dateStr)
    if (isNaN(itemDate.getTime())) return false

    if (startDate) {
      const start = new Date(startDate)
      if (itemDate < start) return false
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999) // 終了日の終わりまで含める
      if (itemDate > end) return false
    }
    return true
  }

  // 利用可能なブランドリスト
  const availableBrands = useMemo(() => {
    const brands = new Set<string>()
    inventory.forEach(item => {
      if (item.brand_name) {
        brands.add(item.brand_name)
      }
    })
    return [...brands].sort((a, b) => a.localeCompare(b, 'ja'))
  }, [inventory])

  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    inventory.forEach(item => {
      if (item.category) {
        categories.add(item.category)
      }
    })
    return [...categories].sort((a, b) => a.localeCompare(b, 'ja'))
  }, [inventory])

  const availablePurchaseSources = useMemo(() => {
    const sources = new Set<string>()
    inventory.forEach(item => {
      if (item.purchase_source) {
        sources.add(item.purchase_source)
      }
    })
    return [...sources].sort((a, b) => a.localeCompare(b, 'ja'))
  }, [inventory])

  const availableSaleDestinations = useMemo(() => {
    const destinations = new Set<string>()
    inventory.forEach(item => {
      if (item.sale_destination) {
        destinations.add(item.sale_destination)
      }
    })
    return [...destinations].sort((a, b) => a.localeCompare(b, 'ja'))
  }, [inventory])

  // 検索・日付・回転日数・ブランドフィルター済みのインベントリ
  const filteredInventory = useMemo(() => {
    let result = inventory

    // テキスト検索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(item =>
        (item.inventory_number && String(item.inventory_number).toLowerCase().includes(query)) ||
        (item.product_name && item.product_name.toLowerCase().includes(query)) ||
        (item.brand_name && item.brand_name.toLowerCase().includes(query))
      )
    }

    // ブランドフィルター
    if (selectedBrands.size > 0) {
      result = result.filter(item =>
        item.brand_name && selectedBrands.has(item.brand_name)
      )
    }

    // カテゴリ（ジャンル）フィルター
    if (selectedCategories.size > 0) {
      result = result.filter(item =>
        item.category && selectedCategories.has(item.category)
      )
    }

    // 仕入先フィルター
    if (selectedPurchaseSources.size > 0) {
      result = result.filter(item =>
        item.purchase_source && selectedPurchaseSources.has(item.purchase_source)
      )
    }

    // 販売先フィルター
    if (selectedSaleDestinations.size > 0) {
      result = result.filter(item =>
        item.sale_destination && selectedSaleDestinations.has(item.sale_destination)
      )
    }

    // 日付フィルター
    result = result.filter(item =>
      matchesDateFilter(item.purchase_date, dateFilters.purchase_date) &&
      matchesDateFilter(item.listing_date, dateFilters.listing_date) &&
      matchesDateFilter(item.sale_date, dateFilters.sale_date)
    )

    // 期間フィルター
    result = result.filter(matchesDateRangeFilter)

    // 回転日数フィルター（保存値優先、なければ計算）
    if (turnoverDaysFilter) {
      const threshold = parseInt(turnoverDaysFilter, 10)
      result = result.filter(item => {
        let days: number | null = null
        if (item.turnover_days !== null && item.turnover_days !== undefined) {
          days = item.turnover_days
        } else if (item.purchase_date && item.sale_date) {
          days = Math.ceil((new Date(item.sale_date).getTime() - new Date(item.purchase_date).getTime()) / (1000 * 60 * 60 * 24))
        }
        if (days === null) return false
        return days >= threshold
      })
    }

    // クイックフィルター（未販売・未出品・滞留）
    if (quickFilter === 'unsold') {
      // 未販売：売却済みでないもの、かつ返品でないもの
      result = result.filter(item => item.status !== '売却済み' && item.sale_destination !== '返品')
    } else if (quickFilter === 'unlisted') {
      // 未出品：出品日が空欄のもの
      result = result.filter(item => !item.listing_date)
    } else if (quickFilter === 'stale30' || quickFilter === 'stale90') {
      // 滞留在庫：出品から指定日数以上経過、かつ未販売
      const now = new Date()
      const threshold = quickFilter === 'stale30' ? 30 : 90
      result = result.filter(item => {
        if (item.status === '売却済み') return false
        if (!item.listing_date) return false
        const listingDate = new Date(item.listing_date)
        const days = Math.floor((now.getTime() - listingDate.getTime()) / (1000 * 60 * 60 * 24))
        return days >= threshold
      })
    } else if (quickFilter === 'returns') {
      // 返品：販売先が「返品」のもの
      result = result.filter(item => item.sale_destination === '返品')
    }

    // チェック済みのみ表示
    if (showSelectedOnly && selectedIds.size > 0) {
      result = result.filter(item => selectedIds.has(item.id))
    }

    return result
  }, [inventory, searchQuery, selectedBrands, selectedCategories, selectedPurchaseSources, selectedSaleDestinations, dateFilters, dateRangeFilter, turnoverDaysFilter, quickFilter, showSelectedOnly, selectedIds])

  // ソート済みのインベントリ
  // 利益計算ヘルパー関数（常に計算で求める）
  const calcProfit = (item: InventoryItem): number | null => {
    // 売上日がある場合のみ計算（売却確定時）、返品は除外
    if (!item.sale_date || item.sale_date === '返品') return null
    // 入金額がある場合のみ計算
    return item.deposit_amount !== null
      ? Number(item.deposit_amount) - (item.purchase_total || 0) - (item.other_cost || 0)
      : null
  }

  // 利益率計算ヘルパー関数（常に計算で求める）
  const calcProfitRate = (item: InventoryItem): number | null => {
    const profit = calcProfit(item)
    return (profit !== null && item.sale_price)
      ? Math.round((profit / Number(item.sale_price)) * 100)
      : null
  }

  // 回転日数計算ヘルパー関数（保存値優先、なければ計算）
  const calcTurnoverDays = (item: InventoryItem): number | null => {
    if (item.turnover_days !== null && item.turnover_days !== undefined) {
      return item.turnover_days
    }
    if (item.purchase_date && item.sale_date) {
      const purchaseDate = new Date(item.purchase_date)
      const saleDate = new Date(item.sale_date)
      const diffTime = saleDate.getTime() - purchaseDate.getTime()
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }
    return null
  }

  const sortedInventory = useMemo(() => {
    if (!sortConfig) return filteredInventory

    return [...filteredInventory].sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null

      // 計算フィールドの場合
      if (sortConfig.key === 'profit') {
        aVal = calcProfit(a)
        bVal = calcProfit(b)
      } else if (sortConfig.key === 'profit_rate') {
        aVal = calcProfitRate(a)
        bVal = calcProfitRate(b)
      } else {
        aVal = a[sortConfig.key as keyof InventoryItem] as string | number | null
        bVal = b[sortConfig.key as keyof InventoryItem] as string | number | null
      }

      // null値は最後に
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      // 数値の比較
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      // 文字列の比較
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr, 'ja')
        : bStr.localeCompare(aStr, 'ja')
    })
  }, [filteredInventory, sortConfig])

  // ページネーション適用
  const effectiveItemsPerPage = itemsPerPage === -1 ? sortedInventory.length : itemsPerPage
  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(sortedInventory.length / itemsPerPage)
  const paginatedInventory = useMemo(() => {
    if (itemsPerPage === -1) return sortedInventory
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedInventory.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedInventory, currentPage, itemsPerPage])

  // 仮想スクロール用のvirtualizer
  const rowVirtualizer = useVirtualizer({
    count: paginatedInventory.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 41, // 行の高さ（px）
    overscan: 10, // 画面外に余分にレンダリングする行数
  })

  // フィルター変更時にページをリセット（初回ロード時は除く）
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    updateCurrentPage(1)
  }, [filteredInventory.length, updateCurrentPage])

  // 最後にクリックしたアイテムのインデックスを記録
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  // 全選択/全解除
  const handleSelectAll = useCallback(() => {
    startTransition(() => {
      setSelectedIds(prevSelectedIds => {
        if (prevSelectedIds.size === sortedInventory.length) {
          return new Set()
        } else {
          return new Set(sortedInventory.map(item => item.id))
        }
      })
    })
  }, [sortedInventory])

  // 個別選択（Shift+クリックで範囲選択対応）
  const handleSelectItem = useCallback((id: string, index: number, shiftKey: boolean) => {
    startTransition(() => {
      setSelectedIds(prevSelectedIds => {
        const newSet = new Set(prevSelectedIds)

        if (shiftKey && lastSelectedIndex !== null) {
          // Shift+クリック: 範囲選択
          const start = Math.min(lastSelectedIndex, index)
          const end = Math.max(lastSelectedIndex, index)
          for (let i = start; i <= end; i++) {
            newSet.add(sortedInventory[i].id)
          }
        } else {
          // 通常クリック: トグル
          if (newSet.has(id)) {
            newSet.delete(id)
          } else {
            newSet.add(id)
          }
        }
        return newSet
      })
    })
    if (!shiftKey) {
      setLastSelectedIndex(index)
    }
  }, [lastSelectedIndex, sortedInventory])

  // 画像URLを保存
  const handleSaveImageUrl = async (id: string, url: string) => {
    if (!url.trim()) return
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ image_url: url.trim() })
        .eq('id', id)
      if (error) throw error
      setInventory(prev => prev.map(item =>
        item.id === id ? { ...item, image_url: url.trim() } : item
      ))
      // 画像エラー状態をクリア
      setImageErrors(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setImageEditModal(null)
      setImageUrlInput('')
    } catch (error) {
      console.error('Error saving image URL:', error)
      alert('画像URLの保存に失敗しました')
    }
  }

  // 画像をBase64に変換してSupabaseに保存
  const handleImageDrop = async (id: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください')
      return
    }
    try {
      // Googleドライブにアップロード
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', `inventory_${id}_${Date.now()}.${file.type.split('/')[1] || 'jpg'}`)

      const response = await fetch('/api/google-drive/upload-file', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 401) {
          alert('Googleドライブにログインしてください。設定画面からGoogleアカウントを連携できます。')
          return
        }
        throw new Error(errorData.error || 'アップロードに失敗しました')
      }

      const { url } = await response.json()

      // DBに保存
      const { error } = await supabase
        .from('inventory')
        .update({ image_url: url })
        .eq('id', id)
      if (error) throw error

      setInventory(prev => prev.map(item =>
        item.id === id ? { ...item, image_url: url } : item
      ))
      // 画像エラー状態をクリア
      setImageErrors(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setImageEditModal(null)
      setImageUrlInput('')
      setIsDraggingImage(false)
    } catch (error) {
      console.error('Error saving image:', error)
      alert('画像の保存に失敗しました')
    }
  }

  // 選択セルをコピー
  const copySelectedCells = useCallback(() => {
    if (!selectionRange) return

    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)

    const rows: string[] = []
    for (let r = minRow; r <= maxRow; r++) {
      const item = sortedInventory[r]
      if (!item) continue

      const cols: string[] = []
      for (let c = minCol; c <= maxCol; c++) {
        const col = visibleColumns[c]
        if (!col) continue

        const field = col.key
        let value = ''

        // 特殊な列の処理（計算列 - 保存値優先）
        if (field === 'profit') {
          const profit = calcProfit(item)
          value = profit !== null ? String(profit) : ''
        } else if (field === 'profit_rate') {
          const profitRate = calcProfitRate(item)
          value = profitRate !== null ? `${profitRate}%` : ''
        } else if (field === 'turnover_days') {
          const turnoverDays = calcTurnoverDays(item)
          value = turnoverDays !== null ? String(turnoverDays) : ''
        } else if (field in item) {
          const cellValue = item[field as keyof InventoryItem]
          value = cellValue !== null && cellValue !== undefined ? String(cellValue) : ''
        }
        cols.push(value)
      }
      rows.push(cols.join('\t'))
    }

    const text = rows.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      // コピー成功のフィードバック（オプション）
    }).catch(err => {
      console.error('Copy failed:', err)
    })
  }, [selectionRange, sortedInventory, visibleColumns])

  // Ctrl+C でコピー
  useEffect(() => {
    const handleCopyKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectionRange) {
        e.preventDefault()
        copySelectedCells()
      }
    }
    document.addEventListener('keydown', handleCopyKey)
    return () => document.removeEventListener('keydown', handleCopyKey)
  }, [selectionRange, copySelectedCells])

  // 選択セルの削除（単一セル or 範囲選択）
  const deleteSelectedCells = useCallback(async () => {
    // 単一セル選択の場合
    if (selectedCell && !selectionRange) {
      const item = sortedInventory.find(i => i.id === selectedCell.id)
      if (!item) return

      const field = selectedCell.field
      const nonEditableFields = ['id', 'created_at', 'checkbox', 'index', 'image', 'profit', 'profit_rate', 'turnover_days', 'deposit_amount', 'commission', 'inventory_number']
      if (nonEditableFields.includes(field)) return

      const oldValue = item[field as keyof InventoryItem]
      if (oldValue === null) return // 既にnullなら何もしない

      // 販売先が「返品」の場合、出品日・売却日も連動してクリア
      if (field === 'sale_destination' && item.sale_destination === '返品') {
        // 履歴に記録
        const historyChanges = [
          { id: item.id, field: 'sale_destination', oldValue: item.sale_destination, newValue: null },
          { id: item.id, field: 'listing_date', oldValue: item.listing_date, newValue: null },
          { id: item.id, field: 'sale_date', oldValue: item.sale_date, newValue: null }
        ]
        setUndoStack(prev => {
          const newStack = [...prev, historyChanges]
          if (newStack.length > MAX_HISTORY) {
            return newStack.slice(-MAX_HISTORY)
          }
          return newStack
        })
        setRedoStack([])

        // データベース更新
        const { error } = await supabase
          .from('inventory')
          .update({ sale_destination: null, listing_date: null, sale_date: null })
          .eq('id', item.id)

        if (!error) {
          setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: null, listing_date: null, sale_date: null } : inv))
        }
        return
      }

      // 通常のクリア処理
      // 履歴に記録
      setUndoStack(prev => {
        const newStack = [...prev, [{ id: item.id, field, oldValue, newValue: null }]]
        if (newStack.length > MAX_HISTORY) {
          return newStack.slice(-MAX_HISTORY)
        }
        return newStack
      })
      setRedoStack([])

      // データベース更新
      const { error } = await supabase
        .from('inventory')
        .update({ [field]: null })
        .eq('id', item.id)

      if (!error) {
        setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, [field]: null } : inv))
      }
      return
    }

    // 範囲選択の場合
    if (!selectionRange) return

    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)

    // 編集不可フィールド
    const nonEditableFields = ['id', 'created_at', 'checkbox', 'index', 'image', 'profit', 'profit_rate', 'turnover_days', 'deposit_amount', 'commission', 'inventory_number']

    // 更新対象を収集
    const updates: { id: string; fields: Record<string, null> }[] = []
    // 履歴用の変更記録
    const historyChanges: { id: string; field: string; oldValue: unknown; newValue: unknown }[] = []

    for (let r = minRow; r <= maxRow; r++) {
      const item = sortedInventory[r]
      if (!item) continue

      const fieldsToDelete: Record<string, null> = {}
      for (let c = minCol; c <= maxCol; c++) {
        const col = visibleColumns[c]
        if (!col) continue

        const field = col.key
        if (nonEditableFields.includes(field)) continue

        // 履歴に記録
        const oldValue = item[field as keyof InventoryItem]
        if (oldValue !== null) {
          historyChanges.push({ id: item.id, field, oldValue, newValue: null })
        }
        fieldsToDelete[field] = null
      }

      if (Object.keys(fieldsToDelete).length > 0) {
        updates.push({ id: item.id, fields: fieldsToDelete })
      }
    }

    if (historyChanges.length > 0) {
      setUndoStack(prev => {
        const newStack = [...prev, historyChanges]
        if (newStack.length > MAX_HISTORY) {
          return newStack.slice(-MAX_HISTORY)
        }
        return newStack
      })
      setRedoStack([])
    }

    // データベース更新
    for (const update of updates) {
      const { error } = await supabase
        .from('inventory')
        .update(update.fields)
        .eq('id', update.id)

      if (error) {
        console.error('Delete cells error:', error)
      }
    }

    // ローカル状態を更新
    setInventory(prev => prev.map(item => {
      const updateItem = updates.find(u => u.id === item.id)
      if (updateItem) {
        return { ...item, ...updateItem.fields }
      }
      return item
    }))
  }, [selectedCell, selectionRange, sortedInventory, visibleColumns, MAX_HISTORY])

  // Delete/Backspaceで選択セルを削除
  useEffect(() => {
    const handleDeleteKey = (e: KeyboardEvent) => {
      // 編集中は無視
      if (editingCell) return
      // 入力フィールドにフォーカスがある場合は無視
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') return

      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectionRange || selectedCell)) {
        e.preventDefault()
        deleteSelectedCells()
      }
    }
    document.addEventListener('keydown', handleDeleteKey)
    return () => document.removeEventListener('keydown', handleDeleteKey)
  }, [selectionRange, selectedCell, editingCell, deleteSelectedCells])

  // セルのコピー機能 (Ctrl+C / Cmd+C)
  useEffect(() => {
    const handleCopy = (e: KeyboardEvent) => {
      // 編集中は無視
      if (editingCell) return
      // 入力フィールドにフォーカスがある場合は無視
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedCell) {
        e.preventDefault()
        const item = sortedInventory.find(i => i.id === selectedCell.id)
        if (!item) return

        const value = item[selectedCell.field]
        const textValue = value !== null && value !== undefined ? String(value) : ''

        navigator.clipboard.writeText(textValue).catch(err => {
          console.error('Failed to copy:', err)
        })
      }
    }
    document.addEventListener('keydown', handleCopy)
    return () => document.removeEventListener('keydown', handleCopy)
  }, [selectedCell, editingCell, sortedInventory])

  // セルのペースト機能 (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = async (e: KeyboardEvent) => {
      // 編集中は無視
      if (editingCell) return
      // 入力フィールドにフォーカスがある場合は無視
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && (selectedCell || selectionRange)) {
        e.preventDefault()

        try {
          const clipboardText = await navigator.clipboard.readText()
          const nonEditableFields = ['id', 'user_id', 'created_at', 'profit', 'profit_rate', 'turnover_days']
          const numericFields = ['inventory_number', 'purchase_price', 'purchase_total', 'sale_price', 'commission', 'shipping_cost', 'other_cost', 'deposit_amount']

          // 範囲選択がある場合は複数セルにペースト
          if (selectionRange) {
            const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
            const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
            const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
            const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)

            const updates: { id: string; field: string; value: string | number | null }[] = []

            for (let row = minRow; row <= maxRow; row++) {
              for (let col = minCol; col <= maxCol; col++) {
                const item = sortedInventory[row]
                const column = visibleColumns[col]
                if (!item || !column) continue

                const field = column.key
                if (nonEditableFields.includes(field)) continue

                let newValue: string | number | null = clipboardText.trim()
                if (numericFields.includes(field)) {
                  const num = parseFloat(newValue.replace(/,/g, ''))
                  newValue = isNaN(num) ? null : num
                }

                updates.push({ id: item.id, field, value: newValue })
              }
            }

            // 一括更新
            for (const update of updates) {
              // 返品処理：販売先に「返品」を設定した場合
              if (update.field === 'sale_destination' && update.value === '返品') {
                await supabase.from('inventory').update({
                  sale_destination: '返品',
                  listing_date: '返品',
                  sale_date: '返品',
                  sale_price: null,
                  commission: null,
                  profit: null,
                  profit_rate: null
                }).eq('id', update.id)
              } else {
                await supabase.from('inventory').update({ [update.field]: update.value }).eq('id', update.id)
              }
            }
            setInventory(prev => prev.map(item => {
              const itemUpdates = updates.filter(u => u.id === item.id)
              if (itemUpdates.length === 0) return item
              const newItem = { ...item }
              for (const u of itemUpdates) {
                // 返品処理
                if (u.field === 'sale_destination' && u.value === '返品') {
                  newItem.sale_destination = '返品'
                  newItem.listing_date = '返品'
                  newItem.sale_date = '返品'
                  newItem.sale_price = null
                  newItem.commission = null
                  newItem.profit = null
                  newItem.profit_rate = null
                } else {
                  (newItem as Record<string, unknown>)[u.field] = u.value
                }
              }
              return newItem as InventoryItem
            }))
          } else if (selectedCell) {
            // 単一セルにペースト
            const item = sortedInventory.find(i => i.id === selectedCell.id)
            if (!item) return

            const field = selectedCell.field
            if (nonEditableFields.includes(field as string)) return

            let newValue: string | number | null = clipboardText.trim()
            if (numericFields.includes(field as string)) {
              const num = parseFloat(newValue.replace(/,/g, ''))
              newValue = isNaN(num) ? null : num
            }

            // 返品処理：販売先に「返品」をペーストした場合
            if (field === 'sale_destination' && newValue === '返品') {
              const { error } = await supabase.from('inventory').update({
                sale_destination: '返品',
                listing_date: '返品',
                sale_date: '返品',
                sale_price: null,
                commission: null,
                profit: null,
                profit_rate: null
              }).eq('id', item.id)
              if (!error) {
                setInventory(prev => prev.map(i => i.id === item.id ? {
                  ...i,
                  sale_destination: '返品',
                  listing_date: '返品',
                  sale_date: '返品',
                  sale_price: null,
                  commission: null,
                  profit: null,
                  profit_rate: null
                } : i))
              }
            } else {
              const { error } = await supabase.from('inventory').update({ [field]: newValue }).eq('id', item.id)
              if (!error) {
                setInventory(prev => prev.map(i => i.id === item.id ? { ...i, [field]: newValue } : i))
              }
            }
          }
        } catch (err) {
          console.error('Failed to paste:', err)
        }
      }
    }
    document.addEventListener('keydown', handlePaste)
    return () => document.removeEventListener('keydown', handlePaste)
  }, [selectedCell, selectionRange, editingCell, sortedInventory, visibleColumns])

  // Undo実行
  const executeUndo = useCallback(async () => {
    if (undoStack.length === 0) return

    const lastChanges = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))

    // データベースを元に戻す
    for (const change of lastChanges) {
      const updateData: Record<string, unknown> = { [change.field]: change.oldValue }

      // sale_dateが変更された場合、statusも更新
      if (change.field === 'sale_date') {
        if (!change.oldValue || change.oldValue === '') {
          updateData.status = '在庫あり'
        } else if (change.oldValue !== '返品') {
          updateData.status = '売却済み'
        }
      }

      const { error } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('id', change.id)

      if (error) {
        console.error('Undo error:', error)
      }
    }

    // ローカル状態を更新
    setInventory(prev => prev.map(item => {
      const change = lastChanges.find(c => c.id === item.id)
      if (change) {
        const updates: Record<string, unknown> = { [change.field]: change.oldValue }
        // sale_dateが変更された場合、statusも更新
        if (change.field === 'sale_date') {
          if (!change.oldValue || change.oldValue === '') {
            updates.status = '在庫あり'
          } else if (change.oldValue !== '返品') {
            updates.status = '売却済み'
          }
        }
        return { ...item, ...updates }
      }
      return item
    }))

    // Redoスタックに追加
    setRedoStack(prev => [...prev, lastChanges])
  }, [undoStack])

  // Redo実行
  const executeRedo = useCallback(async () => {
    if (redoStack.length === 0) return

    const lastChanges = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))

    // データベースを再適用
    for (const change of lastChanges) {
      const updateData: Record<string, unknown> = { [change.field]: change.newValue }

      // sale_dateが変更された場合、statusも更新
      if (change.field === 'sale_date') {
        if (!change.newValue || change.newValue === '') {
          updateData.status = '在庫あり'
        } else if (change.newValue !== '返品') {
          updateData.status = '売却済み'
        }
      }

      const { error } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('id', change.id)

      if (error) {
        console.error('Redo error:', error)
      }
    }

    // ローカル状態を更新
    setInventory(prev => prev.map(item => {
      const change = lastChanges.find(c => c.id === item.id)
      if (change) {
        const updates: Record<string, unknown> = { [change.field]: change.newValue }
        // sale_dateが変更された場合、statusも更新
        if (change.field === 'sale_date') {
          if (!change.newValue || change.newValue === '') {
            updates.status = '在庫あり'
          } else if (change.newValue !== '返品') {
            updates.status = '売却済み'
          }
        }
        return { ...item, ...updates }
      }
      return item
    }))

    // Undoスタックに追加
    setUndoStack(prev => [...prev, lastChanges])
  }, [redoStack])

  // Ctrl+Z / Ctrl+Y でUndo/Redo
  useEffect(() => {
    const handleUndoRedoKey = (e: KeyboardEvent) => {
      // 編集中は無視
      if (editingCell) return
      // 入力フィールドにフォーカスがある場合は無視
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        executeUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        executeRedo()
      }
    }
    document.addEventListener('keydown', handleUndoRedoKey)
    return () => document.removeEventListener('keydown', handleUndoRedoKey)
  }, [editingCell, executeUndo, executeRedo])

  // 矢印キーでセル移動
  useEffect(() => {
    const handleArrowKey = (e: KeyboardEvent) => {
      // 編集中は無視
      if (editingCell) return
      // セルが選択されていない場合は無視
      if (!selectedCell) return
      // 矢印キー以外は無視
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return

      e.preventDefault()

      // 現在の行と列のインデックスを取得
      const currentRowIndex = sortedInventory.findIndex(item => item.id === selectedCell.id)
      const currentColIndex = visibleColumns.findIndex(col => col.key === selectedCell.field)

      if (currentRowIndex === -1 || currentColIndex === -1) return

      let newRowIndex = currentRowIndex
      let newColIndex = currentColIndex

      switch (e.key) {
        case 'ArrowUp':
          newRowIndex = Math.max(0, currentRowIndex - 1)
          break
        case 'ArrowDown':
          newRowIndex = Math.min(sortedInventory.length - 1, currentRowIndex + 1)
          break
        case 'ArrowLeft':
          newColIndex = Math.max(0, currentColIndex - 1)
          break
        case 'ArrowRight':
          newColIndex = Math.min(visibleColumns.length - 1, currentColIndex + 1)
          break
      }

      // 移動先のセルを選択
      const newItem = sortedInventory[newRowIndex]
      const newCol = visibleColumns[newColIndex]
      if (newItem && newCol) {
        setSelectedCell({ id: newItem.id, field: newCol.key as keyof InventoryItem })
        setSelectionRange(null)
      }
    }
    document.addEventListener('keydown', handleArrowKey)
    return () => document.removeEventListener('keydown', handleArrowKey)
  }, [editingCell, selectedCell, sortedInventory, visibleColumns])

  // セル選択中に直接入力で編集開始
  useEffect(() => {
    const handleDirectInput = (e: KeyboardEvent) => {
      // 編集中は無視
      if (editingCell) return
      // セルが選択されていない場合は無視
      if (!selectedCell) return
      // 入力フィールドにフォーカスがある場合は無視
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') return
      // モーダルが開いている場合は無視
      if (modalEdit || imageEditModal) return
      // 修飾キーが押されている場合は無視（ショートカット用）
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // 特殊キーは無視
      if (['Escape', 'Tab', 'Enter', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(e.key)) return

      // 編集不可フィールドは無視
      const nonEditableFields = ['id', 'created_at', 'checkbox', 'index', 'image', 'profit', 'profit_rate', 'turnover_days', 'deposit_amount', 'commission', 'inventory_number']
      if (nonEditableFields.includes(selectedCell.field)) return

      // 現在のアイテムを取得
      const currentItem = sortedInventory.find(item => item.id === selectedCell.id)
      if (!currentItem) return

      // 商品名はモーダルで編集
      if (selectedCell.field === 'product_name') {
        setModalEdit({ id: currentItem.id, field: 'product_name', value: e.key })
        e.preventDefault()
        return
      }

      // 仕入先・販売先はドロップダウンなので直接入力は無視
      if (selectedCell.field === 'purchase_source' || selectedCell.field === 'sale_destination') return

      // 編集モードを開始し、入力された文字をセット
      setEditingCell({ id: selectedCell.id, field: selectedCell.field })
      setEditValue(e.key)
      e.preventDefault()
    }
    document.addEventListener('keydown', handleDirectInput)
    return () => document.removeEventListener('keydown', handleDirectInput)
  }, [editingCell, selectedCell, sortedInventory, modalEdit, imageEditModal])

  // オートフィル実行
  const executeAutoFill = useCallback(async () => {
    if (!autoFillRange) return
    if (autoFillRange.sourceRow === autoFillRange.endRow) return // 範囲なし

    const sourceItem = sortedInventory[autoFillRange.sourceRow]
    if (!sourceItem) return

    const col = visibleColumns[autoFillRange.sourceCol]
    if (!col) return

    const field = col.key as keyof InventoryItem
    // 編集不可フィールドはスキップ
    const nonEditableFields = ['id', 'created_at', 'checkbox', 'index', 'image', 'profit', 'profit_rate', 'turnover_days', 'deposit_amount', 'commission']
    if (nonEditableFields.includes(field)) return

    const sourceValue = sourceItem[field]

    const minRow = Math.min(autoFillRange.sourceRow, autoFillRange.endRow)
    const maxRow = Math.max(autoFillRange.sourceRow, autoFillRange.endRow)

    // 更新対象のIDと値を収集
    const updates: { id: string; value: unknown }[] = []
    // 履歴用の変更記録
    const historyChanges: { id: string; field: string; oldValue: unknown; newValue: unknown }[] = []
    for (let r = minRow; r <= maxRow; r++) {
      if (r === autoFillRange.sourceRow) continue // ソースはスキップ
      const item = sortedInventory[r]
      if (!item) continue
      const oldValue = item[field]
      historyChanges.push({ id: item.id, field, oldValue, newValue: sourceValue })
      updates.push({ id: item.id, value: sourceValue })
    }

    if (historyChanges.length > 0) {
      setUndoStack(prev => {
        const newStack = [...prev, historyChanges]
        if (newStack.length > MAX_HISTORY) {
          return newStack.slice(-MAX_HISTORY)
        }
        return newStack
      })
      setRedoStack([])
    }

    // 一括更新（同じ値を複数IDに適用）
    const ids = updates.map(u => u.id)
    if (ids.length > 0) {
      const { error } = await supabase
        .from('inventory')
        .update({ [field]: sourceValue })
        .in('id', ids)

      if (error) {
        console.error('AutoFill error:', error)
      }
    }

    // ローカル状態を更新
    setInventory(prev => prev.map(item => {
      const updateItem = updates.find(u => u.id === item.id)
      if (updateItem) {
        return { ...item, [field]: updateItem.value }
      }
      return item
    }))

    setAutoFillRange(null)
    setIsAutoFilling(false)
  }, [autoFillRange, sortedInventory, visibleColumns, MAX_HISTORY])

  // オートフィル終了時にデータをコピー
  useEffect(() => {
    const handleMouseUp = () => {
      if (isAutoFilling && autoFillRange) {
        executeAutoFill()
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [isAutoFilling, autoFillRange, executeAutoFill])

  // 販売先・仕入先の色とオプションを販路マスタから取得
  const platformColors: Record<string, string> = useMemo(() => {
    const colors: Record<string, string> = {}
    masterPlatforms.forEach(p => {
      colors[p.name] = p.color_class
    })
    return colors
  }, [masterPlatforms])

  const saleDestinationColors: Record<string, string> = { ...platformColors, '返品': 'bg-red-100 text-red-800' }

  // 有効な販路のみ表示（sort_order順）
  const platformOptions = useMemo(() => {
    return masterPlatforms
      .filter(p => p.is_active)
      .map(p => p.name)
  }, [masterPlatforms])

  const visiblePlatformOptions = platformOptions.filter(p => !hiddenPlatforms.has(p))
  // 「返品」がマスタにない場合のみ追加
  const saleDestinationOptions = visiblePlatformOptions.includes('返品')
    ? visiblePlatformOptions
    : [...visiblePlatformOptions, '返品']

  // チップ列の幅を最長の名前に基づいて計算（仕入先・販売先で共通）
  const chipColumnWidth = useMemo(() => {
    const allNames = masterPlatforms.map(p => p.name)
    if (allNames.length === 0) return 120 // デフォルト
    const maxLength = Math.max(...allNames.map(name => name.length))
    // 日本語1文字あたり約14px + パディング(24px) + ×ボタン(24px)
    const calculatedWidth = maxLength * 14 + 48
    return Math.max(100, Math.min(200, calculatedWidth)) // 100px〜200pxの範囲
  }, [masterPlatforms])

  // Tailwindの幅クラスをピクセルに変換するマップ
  const widthMap: Record<string, number> = {
    'w-8': 32, 'w-10': 40, 'w-12': 48, 'w-14': 56, 'w-16': 64,
    'w-20': 80, 'w-24': 96, 'w-28': 112, 'w-32': 128, 'w-40': 160,
    'w-[140px]': 140
  }

  // 列幅の配列をメモ化（スクロール時の再計算を防ぐ）
  const columnWidths = useMemo(() => {
    return visibleColumns.map(col => {
      if (col.key === 'purchase_source' || col.key === 'sale_destination') {
        return chipColumnWidth
      }
      return widthMap[col.width] || 80
    })
  }, [visibleColumns, chipColumnWidth])

  // テーブル全体の幅を計算
  const tableWidth = useMemo(() => {
    return columnWidths.reduce((sum, w) => sum + w, 0)
  }, [columnWidths])

  // 列の幅を取得（チップ列は動的に計算）
  const getColumnWidth = useCallback((col: { key: string; width: string }) => {
    if (col.key === 'purchase_source' || col.key === 'sale_destination') {
      return { width: `${chipColumnWidth}px`, minWidth: `${chipColumnWidth}px`, maxWidth: `${chipColumnWidth}px` }
    }
    return {}
  }, [chipColumnWidth])

  const hidePlatform = (platform: string) => {
    const newHidden = new Set(hiddenPlatforms)
    newHidden.add(platform)
    setHiddenPlatforms(newHidden)
    localStorage.setItem('hiddenPlatforms', JSON.stringify([...newHidden]))
  }

  const resetHiddenPlatforms = () => {
    setHiddenPlatforms(new Set())
    localStorage.removeItem('hiddenPlatforms')
  }
  // 仕入先は固定リスト + 既存データのユニークな仕入先を追加
  const purchaseSourceOptions = [...new Set([...visiblePlatformOptions, ...uniquePurchaseSources.filter(s => !hiddenPlatforms.has(s))])]

  // 販売先に応じた手数料計算（正の数で返す）
  // saleDateは売却日（yyyy-mm-dd形式）、ラクマの場合はその月の手数料率を使用
  // 計算式はスプレッドシートに基づく
  const calculateCommission = (destination: string | null, salePrice: number | null, saleDate?: string | null): number | null => {
    if (!destination || !salePrice) return null
    const price = salePrice

    switch (destination) {
      case 'エコオク':
        // 〜10,000円→550円、〜50,000円→1,100円、50,000円超→2,200円
        if (price <= 10000) return 550
        if (price <= 50000) return 1100
        return 2200
      case 'モノバンク':
        // 5%
        return Math.round(price * 0.05)
      case 'スターバイヤーズ':
        // 固定1,100円
        return 1100
      case 'アプレ':
        // 3%
        return Math.round(price * 0.03)
      case 'タイムレス':
        // 10,000円未満→10%、10,000円以上→5%
        return price < 10000 ? Math.round(price * 0.1) : Math.round(price * 0.05)
      case 'ヤフーフリマ':
      case 'ペイペイ':
        // 5%
        return Math.round(price * 0.05)
      case 'ラクマ': {
        // 売却日がある場合はその月の設定、なければ現在月の設定を使用
        let yearMonth: string
        if (saleDate) {
          const match = saleDate.match(/(\d{4})[-/](\d{1,2})/)
          if (match) {
            yearMonth = `${match[1]}-${match[2].padStart(2, '0')}`
          } else {
            const now = new Date()
            yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          }
        } else {
          const now = new Date()
          yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        }
        const rate = rakumaCommissionSettings[yearMonth] ?? 10 // デフォルト10%
        return Math.round(price * rate / 100)
      }
      case 'メルカリ':
        // 10%
        return Math.round(price * 0.1)
      case 'ヤフオク':
        // 10%
        return Math.round(price * 0.1)
      case 'オークネット':
        // 3% + 330円（最低770円+330円=1,100円）
        const base = price * 0.03
        if (base >= 700) return Math.round(base + 330)
        return Math.round(770 + 330) // 最低1,100円
      case 'エコトレ':
        // 10%
        return Math.round(price * 0.1)
      case 'JBA':
        // 3% + 550円
        return Math.round(price * 0.03 + 550)
      case '仲卸':
        // 手数料なし
        return 0
      default:
        return null
    }
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return `¥${price.toLocaleString()}`
  }

  // 日付を年と月日で改行して表示
  const formatDateWithBreak = (dateStr: string | null) => {
    if (!dateStr) return '-'
    // "2025-11-26" or "2025/11/26" 形式に対応
    const match = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (match) {
      const year = match[1]
      const month = match[2].padStart(2, '0')
      const day = match[3].padStart(2, '0')
      return (
        <span className="text-sm text-gray-900">
          <span className="text-xs text-gray-500">{year}</span>
          <br />
          {month}/{day}
        </span>
      )
    }
    return <span className="text-sm text-gray-900">{dateStr}</span>
  }

  return (
      <div className="min-h-screen bg-gray-50">
      <main className={`px-4 py-6 ${modalEdit ? 'pb-32' : ''}`}>
        {/* CSVアップロードエリア */}
        <div
          className={`mb-6 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="space-y-3">
              <p className="text-gray-600 font-medium">
                {uploadProgress ? uploadProgress.stage : 'アップロード中...'}
              </p>
              {uploadProgress && (
                <>
                  <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    {uploadProgress.current} / {uploadProgress.total} ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-2">
                CSVファイルをドラッグ&ドロップ
              </p>
              <p className="text-gray-400 text-sm mb-4">または</p>
              <div className="flex justify-center gap-3">
                <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                  ファイルを選択
                  <input
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  手動で追加
                </button>
              </div>
            </>
          )}
        </div>

        {/* 在庫テーブル */}
        <div className="rounded-lg shadow bg-white">
          {/* タブ */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => updateQuickFilter('all')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  quickFilter === 'all'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                全件 ({inventory.length})
              </button>
              <button
                onClick={() => updateQuickFilter('unsold')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  quickFilter === 'unsold'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                未販売 ({inventoryStats.unsoldCount})
              </button>
              <button
                onClick={() => updateQuickFilter('unlisted')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  quickFilter === 'unlisted'
                    ? 'border-orange-600 text-orange-600 bg-orange-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                未出品 ({inventoryStats.unlistedCount})
              </button>
              <button
                onClick={() => updateQuickFilter('stale30')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  quickFilter === 'stale30'
                    ? 'border-yellow-600 text-yellow-600 bg-yellow-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                滞留30日以上 ({inventoryStats.stale30Count})
              </button>
              <button
                onClick={() => updateQuickFilter('stale90')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  quickFilter === 'stale90'
                    ? 'border-red-600 text-red-600 bg-red-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                滞留90日以上 ({inventoryStats.stale90Count})
              </button>
              <button
                onClick={() => updateQuickFilter('returns')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  quickFilter === 'returns'
                    ? 'border-purple-600 text-purple-600 bg-purple-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                返品 ({inventoryStats.returnsCount})
              </button>
              <button
                onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                disabled={selectedIds.size === 0}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  showSelectedOnly
                    ? 'border-green-600 text-green-600 bg-green-50'
                    : selectedIds.size > 0
                      ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      : 'border-transparent text-gray-300 cursor-not-allowed'
                }`}
              >
                選択中 ({selectedIds.size})
              </button>
              {/* タブに応じた金額表示 */}
              <div className="ml-auto flex items-center gap-4 pr-4 text-sm">
                {quickFilter === 'all' && (
                  <span className="text-gray-600">
                    {sortedInventory.length !== inventory.length ? (
                      <>絞り込み: <span className="font-semibold text-blue-600">{sortedInventory.length}</span> / <span className="font-semibold text-gray-900">{inventory.length}件</span></>
                    ) : (
                      <>累計: <span className="font-semibold text-gray-900">{inventory.length}件</span></>
                    )}
                  </span>
                )}
                {quickFilter === 'unsold' && (
                  <>
                    <span className="text-gray-600">
                      総額ベース: <span className="font-semibold text-blue-600">¥{inventoryStats.totalPurchaseValue.toLocaleString()}</span>
                    </span>
                    <span className="text-gray-600">
                      原価ベース: <span className="font-semibold text-blue-600">¥{inventoryStats.totalNetStockValue.toLocaleString()}</span>
                    </span>
                  </>
                )}
                {quickFilter === 'unlisted' && (
                  <span className="text-gray-600">
                    未出品在庫額: <span className="font-semibold text-orange-600">¥{inventoryStats.unlistedStockValue.toLocaleString()}</span>
                  </span>
                )}
                {quickFilter === 'stale30' && (
                  <span className="text-gray-600">
                    滞留在庫額: <span className="font-semibold text-yellow-600">¥{inventoryStats.stale30StockValue.toLocaleString()}</span>
                  </span>
                )}
                {quickFilter === 'stale90' && (
                  <span className="text-gray-600">
                    滞留在庫額: <span className="font-semibold text-red-600">¥{inventoryStats.stale90StockValue.toLocaleString()}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  updateCurrentPage(1)
                }}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white"
              >
                <option value={50}>50件</option>
                <option value={100}>100件</option>
                <option value={200}>200件</option>
                <option value={500}>500件</option>
                <option value={1000}>1000件</option>
                <option value={-1}>全件</option>
              </select>
              <div className="relative">
                <input
                  type="text"
                  placeholder="管理番号・商品名・ブランドで検索"
                  value={searchQuery}
                  onChange={(e) => updateSearchQuery(e.target.value)}
                  className="w-64 px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => updateSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              {/* 期間フィルター */}
              <div className="flex items-center gap-2 border-l pl-3 ml-1">
                <select
                  value={dateRangeFilter.dateType}
                  onChange={(e) => setDateRangeFilter(prev => ({ ...prev, dateType: e.target.value as 'purchase_date' | 'listing_date' | 'sale_date' }))}
                  className="text-xs px-2 py-1.5 border border-gray-300 rounded bg-white text-gray-900"
                >
                  <option value="purchase_date">仕入日</option>
                  <option value="listing_date">出品日</option>
                  <option value="sale_date">販売日</option>
                </select>
                <input
                  type="date"
                  value={dateRangeFilter.startDate}
                  onChange={(e) => setDateRangeFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  className="text-xs px-2 py-1.5 border border-gray-300 rounded bg-white text-gray-900"
                />
                <span className="text-gray-500 text-xs">〜</span>
                <input
                  type="date"
                  value={dateRangeFilter.endDate}
                  onChange={(e) => setDateRangeFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  className="text-xs px-2 py-1.5 border border-gray-300 rounded bg-white text-gray-900"
                />
                {(dateRangeFilter.startDate || dateRangeFilter.endDate) && (
                  <button
                    onClick={() => setDateRangeFilter(prev => ({ ...prev, startDate: '', endDate: '' }))}
                    className="text-xs text-gray-400 hover:text-gray-600"
                    title="期間フィルターをクリア"
                  >
                    ✕
                  </button>
                )}
              </div>
              {/* フィルター全リセットボタン */}
              <button
                onClick={() => {
                  updateSearchQuery('')
                  setSelectedBrands(new Set())
                  setSelectedCategories(new Set())
                  setSelectedPurchaseSources(new Set())
                  setSelectedSaleDestinations(new Set())
                  setDateFilters({
                    purchase_date: { year: '', month: '' },
                    listing_date: { year: '', month: '' },
                    sale_date: { year: '', month: '' },
                  })
                  setDateRangeFilter(prev => ({ ...prev, startDate: '', endDate: '' }))
                  setTurnoverDaysFilter('')
                }}
                className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                title="全フィルターをリセット"
              >
                フィルター全解除
              </button>
              {/* Undo/Redoボタン */}
              <div className="flex items-center gap-1">
                <button
                  onClick={executeUndo}
                  disabled={undoStack.length === 0}
                  className={`p-1.5 rounded transition-colors ${
                    undoStack.length > 0
                      ? 'text-gray-900 hover:bg-gray-200'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title="元に戻す (Ctrl+Z)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                  </svg>
                </button>
                <button
                  onClick={executeRedo}
                  disabled={redoStack.length === 0}
                  className={`p-1.5 rounded transition-colors ${
                    redoStack.length > 0
                      ? 'text-gray-900 hover:bg-gray-200'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title="やり直す (Ctrl+Y)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                  </svg>
                </button>
              </div>
            </div>
            {/* アクションボタン */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddRow}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + 行追加
              </button>
              <button
                onClick={handleAutoUpdate}
                disabled={isAutoUpdating}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAutoUpdating ? '更新中...' : 'データ更新'}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  selectedIds.size > 0
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {selectedIds.size > 0 ? `${selectedIds.size}件を削除` : '削除'}
              </button>
              <button
                onClick={() => {
                  if (selectedIds.size === 0) {
                    alert('出品する商品を選択してください')
                    return
                  }
                  setShowAuctionExportModal(true)
                }}
                disabled={selectedIds.size === 0}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  selectedIds.size > 0
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {selectedIds.size > 0 ? `${selectedIds.size}件をオークション出品` : 'オークション出品'}
              </button>
              <button
                onClick={() => {
                  setRakumaModalYearMonth('')
                  setRakumaModalRate('')
                  setShowRakumaSettingsModal(true)
                }}
                className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded hover:bg-pink-600 transition-colors"
              >
                ラクマ手数料
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  列の編集
                </button>
                {showColumnSettings && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowColumnSettings(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[200px] max-h-[400px] overflow-y-auto">
                      <div className="text-xs font-medium text-gray-500 mb-2">表示する列</div>
                      {columns.filter(col => col.key !== 'checkbox' && col.key !== 'index').map(col => (
                        <label key={col.key} className="flex items-center gap-2 py-1 hover:bg-gray-50 px-1 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.has(col.key)}
                            onChange={() => {
                              const newHidden = new Set(hiddenColumns)
                              if (newHidden.has(col.key)) {
                                newHidden.delete(col.key)
                              } else {
                                newHidden.add(col.key)
                              }
                              setHiddenColumns(newHidden)
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{col.label.replace('\n', '')}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">読み込み中...</div>
          ) : inventory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              データがありません。CSVをアップロードしてください。
            </div>
          ) : (
            <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] table-scroll-container">
              <table className="divide-y divide-gray-200 select-none" style={{ tableLayout: 'fixed', width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}>
                <colgroup>
                  {columnWidths.map((width, index) => (
                    <col key={visibleColumns[index]?.key || index} style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-20" style={{ backgroundColor: '#334155' }}>
                  <tr>
                    {visibleColumns.map((col, colIndex) => {
                      const colWidth = columnWidths[colIndex]
                      const cellStyle = { width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px`, backgroundColor: '#334155', color: '#ffffff' }

                      if (col.key === 'checkbox') {
                        return (
                          <th key={col.key} style={cellStyle} className={`px-2 py-2 ${groupEndColumns.has(col.key) ? 'border-r border-slate-500' : ''}`}>
                            <input
                              type="checkbox"
                              checked={sortedInventory.length > 0 && deferredSelectedIds.size === sortedInventory.length}
                              onChange={handleSelectAll}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                        )
                      }
                      const isSortable = !['index', 'image', 'actions', 'turnover_days', 'checkbox', 'brand_name', 'category', 'purchase_source', 'sale_destination'].includes(col.key)
                      const isSorted = sortConfig?.key === col.key
                      const isDateColumn = ['purchase_date', 'listing_date', 'sale_date'].includes(col.key)
                      const isTurnoverDays = col.key === 'turnover_days'
                      const isBrandColumn = col.key === 'brand_name'
                      const isCategoryColumn = col.key === 'category'
                      const isPurchaseSourceColumn = col.key === 'purchase_source'
                      const isSaleDestinationColumn = col.key === 'sale_destination'
                      const dateKey = col.key as 'purchase_date' | 'listing_date' | 'sale_date'
                      const hasDateFilter = isDateColumn && (dateFilters[dateKey]?.year || dateFilters[dateKey]?.month)

                      return (
                        <th
                          key={col.key}
                          draggable={col.draggable}
                          onDragStart={() => col.draggable && handleColumnDragStart(colIndex)}
                          onDragOver={(e) => handleColumnDragOver(e, colIndex)}
                          onDragEnd={handleColumnDragEnd}
                          style={cellStyle}
                          className={`px-2 py-2 text-xs font-medium uppercase whitespace-nowrap select-none group relative text-center ${col.draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${isSortable ? 'hover:bg-slate-600 cursor-pointer' : ''} ${draggedCol === colIndex ? 'bg-slate-500' : ''} ${groupEndColumns.has(col.key) ? 'border-r border-slate-500' : ''}`}
                        >
                          <span
                            className="inline-flex items-center"
                            onClick={() => !isDateColumn && !isTurnoverDays && !isBrandColumn && !isCategoryColumn && !isPurchaseSourceColumn && !isSaleDestinationColumn && isSortable && handleSort(col.key)}
                          >
                            {col.label}
                            {isSortable && !isDateColumn && (
                              <span className={`ml-0.5 text-[10px] ${isSorted ? 'text-blue-300' : 'text-slate-400'}`}>
                                {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '▼'}
                              </span>
                            )}
                            {isDateColumn && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateFilter === col.key) {
                                    setOpenDateFilter(null)
                                    setDropdownPosition(null)
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setDropdownPosition({
                                      top: rect.bottom + 4,
                                      right: window.innerWidth - rect.right
                                    })
                                    setOpenDateFilter(col.key)
                                  }
                                }}
                                className={`ml-1 text-[10px] ${hasDateFilter || isSorted ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                              >
                                {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '▼'}
                              </button>
                            )}
                            {isTurnoverDays && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateFilter === 'turnover_days') {
                                    setOpenDateFilter(null)
                                    setDropdownPosition(null)
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setDropdownPosition({
                                      top: rect.bottom + 4,
                                      right: window.innerWidth - rect.right
                                    })
                                    setOpenDateFilter('turnover_days')
                                  }
                                }}
                                className={`ml-1 text-[10px] ${turnoverDaysFilter ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                              >
                                ▼
                              </button>
                            )}
                            {isBrandColumn && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateFilter === 'brand_filter') {
                                    setOpenDateFilter(null)
                                    setDropdownPosition(null)
                                    setDropdownSearchQuery('')
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setDropdownPosition({
                                      top: rect.bottom + 4,
                                      right: window.innerWidth - rect.right
                                    })
                                    setOpenDateFilter('brand_filter')
                                    setDropdownSearchQuery('')
                                  }
                                }}
                                className={`ml-1 text-[10px] ${selectedBrands.size > 0 ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                              >
                                ▼
                              </button>
                            )}
                            {isCategoryColumn && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateFilter === 'category_filter') {
                                    setOpenDateFilter(null)
                                    setDropdownPosition(null)
                                    setDropdownSearchQuery('')
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setDropdownPosition({
                                      top: rect.bottom + 4,
                                      right: window.innerWidth - rect.right
                                    })
                                    setOpenDateFilter('category_filter')
                                    setDropdownSearchQuery('')
                                  }
                                }}
                                className={`ml-1 text-[10px] ${selectedCategories.size > 0 ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                              >
                                ▼
                              </button>
                            )}
                            {isPurchaseSourceColumn && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateFilter === 'purchase_source_filter') {
                                    setOpenDateFilter(null)
                                    setDropdownPosition(null)
                                    setDropdownSearchQuery('')
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setDropdownPosition({
                                      top: rect.bottom + 4,
                                      right: window.innerWidth - rect.right
                                    })
                                    setOpenDateFilter('purchase_source_filter')
                                    setDropdownSearchQuery('')
                                  }
                                }}
                                className={`ml-1 text-[10px] ${selectedPurchaseSources.size > 0 ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                              >
                                ▼
                              </button>
                            )}
                            {isSaleDestinationColumn && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openDateFilter === 'sale_destination_filter') {
                                    setOpenDateFilter(null)
                                    setDropdownPosition(null)
                                    setDropdownSearchQuery('')
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setDropdownPosition({
                                      top: rect.bottom + 4,
                                      right: window.innerWidth - rect.right
                                    })
                                    setOpenDateFilter('sale_destination_filter')
                                    setDropdownSearchQuery('')
                                  }
                                }}
                                className={`ml-1 text-[10px] ${selectedSaleDestinations.size > 0 ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
                              >
                                ▼
                              </button>
                            )}
                          </span>
                          {/* 回転日数フィルタードロップダウン */}
                          {isTurnoverDays && openDateFilter === 'turnover_days' && dropdownPosition && (
                            <div
                              className="date-filter-dropdown fixed bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-[9999] min-w-[100px]"
                              style={{
                                top: dropdownPosition.top,
                                right: dropdownPosition.right,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-1">
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                                  <input
                                    type="radio"
                                    name="turnoverDays"
                                    checked={turnoverDaysFilter === ''}
                                    onChange={() => { setTurnoverDaysFilter(''); setOpenDateFilter(null); setDropdownPosition(null) }}
                                    className="text-blue-600"
                                  />
                                  <span className="text-xs text-gray-700">全て</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                                  <input
                                    type="radio"
                                    name="turnoverDays"
                                    checked={turnoverDaysFilter === '30'}
                                    onChange={() => { setTurnoverDaysFilter('30'); setOpenDateFilter(null); setDropdownPosition(null) }}
                                    className="text-blue-600"
                                  />
                                  <span className="text-xs text-gray-700">30日以上</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                                  <input
                                    type="radio"
                                    name="turnoverDays"
                                    checked={turnoverDaysFilter === '90'}
                                    onChange={() => { setTurnoverDaysFilter('90'); setOpenDateFilter(null); setDropdownPosition(null) }}
                                    className="text-blue-600"
                                  />
                                  <span className="text-xs text-gray-700">90日以上</span>
                                </label>
                              </div>
                            </div>
                          )}
                          {/* ブランドフィルタードロップダウン */}
                          {isBrandColumn && openDateFilter === 'brand_filter' && dropdownPosition && (
                            <div
                              className="date-filter-dropdown fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] w-56 max-h-80 overflow-hidden flex flex-col"
                              style={{
                                top: dropdownPosition.top,
                                right: dropdownPosition.right,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                <input
                                  type="text"
                                  value={dropdownSearchQuery}
                                  onChange={(e) => setDropdownSearchQuery(e.target.value)}
                                  placeholder="ブランドを検索..."
                                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  autoFocus
                                />
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-500">
                                    {availableBrands.filter(b => b.toLowerCase().includes(dropdownSearchQuery.toLowerCase())).length}件
                                  </span>
                                  {selectedBrands.size > 0 && (
                                    <button
                                      onClick={() => setSelectedBrands(new Set())}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      クリア
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="p-1 overflow-y-auto flex-1">
                                {availableBrands
                                  .filter(brand => brand.toLowerCase().includes(dropdownSearchQuery.toLowerCase()))
                                  .map(brand => (
                                  <label
                                    key={brand}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedBrands.has(brand)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedBrands)
                                        if (e.target.checked) {
                                          newSelected.add(brand)
                                        } else {
                                          newSelected.delete(brand)
                                        }
                                        setSelectedBrands(newSelected)
                                      }}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{brand}</span>
                                  </label>
                                ))}
                                {availableBrands.filter(b => b.toLowerCase().includes(dropdownSearchQuery.toLowerCase())).length === 0 && (
                                  <p className="text-sm text-gray-500 px-2 py-2">
                                    {dropdownSearchQuery ? '該当するブランドがありません' : 'ブランドがありません'}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {/* カテゴリフィルタードロップダウン */}
                          {isCategoryColumn && openDateFilter === 'category_filter' && dropdownPosition && (
                            <div
                              className="date-filter-dropdown fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] w-48 max-h-80 overflow-hidden flex flex-col"
                              style={{
                                top: dropdownPosition.top,
                                right: dropdownPosition.right,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                <input
                                  type="text"
                                  value={dropdownSearchQuery}
                                  onChange={(e) => setDropdownSearchQuery(e.target.value)}
                                  placeholder="ジャンルを検索..."
                                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  autoFocus
                                />
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-500">
                                    {availableCategories.filter(c => c.toLowerCase().includes(dropdownSearchQuery.toLowerCase())).length}件
                                  </span>
                                  {selectedCategories.size > 0 && (
                                    <button
                                      onClick={() => setSelectedCategories(new Set())}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      クリア
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="p-1 overflow-y-auto flex-1">
                                {availableCategories
                                  .filter(category => category.toLowerCase().includes(dropdownSearchQuery.toLowerCase()))
                                  .map(category => (
                                  <label
                                    key={category}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedCategories.has(category)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedCategories)
                                        if (e.target.checked) {
                                          newSelected.add(category)
                                        } else {
                                          newSelected.delete(category)
                                        }
                                        setSelectedCategories(newSelected)
                                      }}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{category}</span>
                                  </label>
                                ))}
                                {availableCategories.filter(c => c.toLowerCase().includes(dropdownSearchQuery.toLowerCase())).length === 0 && (
                                  <p className="text-sm text-gray-500 px-2 py-2">
                                    {dropdownSearchQuery ? '該当するジャンルがありません' : 'ジャンルがありません'}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {/* 仕入先フィルタードロップダウン */}
                          {isPurchaseSourceColumn && openDateFilter === 'purchase_source_filter' && dropdownPosition && (
                            <div
                              className="date-filter-dropdown fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] w-48 max-h-80 overflow-hidden flex flex-col"
                              style={{
                                top: dropdownPosition.top,
                                right: dropdownPosition.right,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                <input
                                  type="text"
                                  value={dropdownSearchQuery}
                                  onChange={(e) => setDropdownSearchQuery(e.target.value)}
                                  placeholder="仕入先を検索..."
                                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  autoFocus
                                />
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-500">
                                    {availablePurchaseSources.filter(s => s.toLowerCase().includes(dropdownSearchQuery.toLowerCase())).length}件
                                  </span>
                                  {selectedPurchaseSources.size > 0 && (
                                    <button
                                      onClick={() => setSelectedPurchaseSources(new Set())}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      クリア
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="p-1 overflow-y-auto flex-1">
                                {availablePurchaseSources
                                  .filter(source => source.toLowerCase().includes(dropdownSearchQuery.toLowerCase()))
                                  .map(source => (
                                  <label
                                    key={source}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedPurchaseSources.has(source)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedPurchaseSources)
                                        if (e.target.checked) {
                                          newSelected.add(source)
                                        } else {
                                          newSelected.delete(source)
                                        }
                                        setSelectedPurchaseSources(newSelected)
                                      }}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{source}</span>
                                  </label>
                                ))}
                                {availablePurchaseSources.filter(s => s.toLowerCase().includes(dropdownSearchQuery.toLowerCase())).length === 0 && (
                                  <p className="text-sm text-gray-500 px-2 py-2">
                                    {dropdownSearchQuery ? '該当する仕入先がありません' : '仕入先がありません'}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {/* 販売先フィルタードロップダウン */}
                          {isSaleDestinationColumn && openDateFilter === 'sale_destination_filter' && dropdownPosition && (
                            <div
                              className="date-filter-dropdown fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] w-48 max-h-80 overflow-hidden flex flex-col"
                              style={{
                                top: dropdownPosition.top,
                                right: dropdownPosition.right,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                                <input
                                  type="text"
                                  value={dropdownSearchQuery}
                                  onChange={(e) => setDropdownSearchQuery(e.target.value)}
                                  placeholder="販売先を検索..."
                                  className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  autoFocus
                                />
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-500">
                                    {availableSaleDestinations.filter(d => d.toLowerCase().includes(dropdownSearchQuery.toLowerCase())).length}件
                                  </span>
                                  {selectedSaleDestinations.size > 0 && (
                                    <button
                                      onClick={() => setSelectedSaleDestinations(new Set())}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      クリア
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="p-1 overflow-y-auto flex-1">
                                {availableSaleDestinations
                                  .filter(destination => destination.toLowerCase().includes(dropdownSearchQuery.toLowerCase()))
                                  .map(destination => (
                                  <label
                                    key={destination}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedSaleDestinations.has(destination)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedSaleDestinations)
                                        if (e.target.checked) {
                                          newSelected.add(destination)
                                        } else {
                                          newSelected.delete(destination)
                                        }
                                        setSelectedSaleDestinations(newSelected)
                                      }}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{destination}</span>
                                  </label>
                                ))}
                                {availableSaleDestinations.filter(d => d.toLowerCase().includes(dropdownSearchQuery.toLowerCase())).length === 0 && (
                                  <p className="text-sm text-gray-500 px-2 py-2">
                                    {dropdownSearchQuery ? '該当する販売先がありません' : '販売先がありません'}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {/* 日付フィルタードロップダウン */}
                          {isDateColumn && openDateFilter === col.key && dropdownPosition && (
                            <div
                              className="date-filter-dropdown fixed bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-[9999] min-w-[120px]"
                              style={{
                                top: dropdownPosition.top,
                                right: dropdownPosition.right,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="mb-2">
                                <label className="block text-[10px] text-gray-500 mb-1">年</label>
                                <select
                                  value={dateFilters[dateKey].year}
                                  onChange={(e) => setDateFilters(prev => ({
                                    ...prev,
                                    [dateKey]: { ...prev[dateKey], year: e.target.value }
                                  }))}
                                  className="w-full text-xs border border-gray-300 rounded px-1 py-0.5 text-gray-900"
                                >
                                  <option value="">全て</option>
                                  {getUniqueDateOptions[dateKey].years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="mb-2">
                                <label className="block text-[10px] text-gray-500 mb-1">月</label>
                                <select
                                  value={dateFilters[dateKey].month}
                                  onChange={(e) => setDateFilters(prev => ({
                                    ...prev,
                                    [dateKey]: { ...prev[dateKey], month: e.target.value }
                                  }))}
                                  className="w-full text-xs border border-gray-300 rounded px-1 py-0.5 text-gray-900"
                                >
                                  <option value="">全て</option>
                                  {getUniqueDateOptions[dateKey].months.map(m => (
                                    <option key={m} value={m}>{m}月</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => {
                                  setDateFilters(prev => ({
                                    ...prev,
                                    [dateKey]: { year: '', month: '' }
                                  }))
                                }}
                                className="w-full text-[10px] text-gray-500 hover:text-gray-700 mb-2"
                              >
                                フィルタークリア
                              </button>
                              <div className="border-t border-gray-200 pt-2">
                                <label className="block text-[10px] text-gray-500 mb-1">並び替え</label>
                                <div className="space-y-1">
                                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                                    <input
                                      type="radio"
                                      name={`sort-${col.key}`}
                                      checked={sortConfig?.key !== col.key}
                                      onChange={() => setSortConfig(null)}
                                      className="text-blue-600"
                                    />
                                    <span className="text-xs text-gray-700">なし</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                                    <input
                                      type="radio"
                                      name={`sort-${col.key}`}
                                      checked={sortConfig?.key === col.key && sortConfig.direction === 'asc'}
                                      onChange={() => setSortConfig({ key: col.key, direction: 'asc' })}
                                      className="text-blue-600"
                                    />
                                    <span className="text-xs text-gray-700">古い順 ▲</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                                    <input
                                      type="radio"
                                      name={`sort-${col.key}`}
                                      checked={sortConfig?.key === col.key && sortConfig.direction === 'desc'}
                                      onChange={() => setSortConfig({ key: col.key, direction: 'desc' })}
                                      className="text-blue-600"
                                    />
                                    <span className="text-xs text-gray-700">新しい順 ▼</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* 上部のスペーサー */}
                  {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getVirtualItems()[0].start > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}>
                      <td colSpan={visibleColumns.length}></td>
                    </tr>
                  )}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const index = virtualRow.index
                    const item = paginatedInventory[index]
                    const globalIndex = (currentPage - 1) * itemsPerPage + index
                    // 利益・利益率・回転日数（常に計算）
                    const profit = calcProfit(item)
                    const profitRate = calcProfitRate(item)
                    const turnoverDays = calcTurnoverDays(item)

                    const inputClass = "w-full h-full px-0 py-0 text-sm border-none outline-none bg-transparent text-black font-medium"
                    const numInputClass = "w-full h-full px-0 py-0 text-sm border-none outline-none bg-transparent text-black font-medium text-right"
                    const cellClass = "px-3 py-2 cursor-pointer hover:bg-blue-50 overflow-visible whitespace-nowrap"

                    const isEditingCell = (field: keyof InventoryItem) =>
                      editingCell?.id === item.id && editingCell?.field === field

                    const isSelectedCell = (field: keyof InventoryItem) =>
                      selectedCell?.id === item.id && selectedCell?.field === field

                    const renderCell = (field: keyof InventoryItem, displayValue: React.ReactNode, inputType: 'text' | 'number' | 'date' | 'select' | 'datalist' | 'sale_destination' | 'purchase_source' = 'text', datalistOptions?: string[], colIndex?: number) => {
                      const editing = isEditingCell(field)
                      const selected = isSelectedCell(field) && !editing && !selectionRange
                      const inRange = colIndex !== undefined && isCellInRange(index, colIndex)
                      const inAutoFillRange = colIndex !== undefined && isCellInAutoFillRange(index, colIndex)
                      const datalistId = `datalist-${field}-${item.id}`
                      const borderClass = groupEndColumns.has(field) ? 'border-r border-gray-300' : ''
                      const selectedClass = selected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''
                      const rangeClass = inRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''
                      const autoFillClass = inAutoFillRange ? 'bg-green-100 ring-1 ring-green-500 ring-inset' : ''
                      // オートフィルハンドルを表示するかどうか（選択中かつ範囲選択なし）
                      const showAutoFillHandle = selected && !selectionRange && colIndex !== undefined
                      return (
                        <td
                          key={field}
                          ref={editing ? editCellRef : null}
                          className={`${cellClass} ${editing ? 'ring-2 ring-blue-500 ring-inset' : ''} ${selectedClass} ${rangeClass} ${autoFillClass} ${borderClass} select-none relative`}
                          onClick={() => !editing && handleCellClick(item, field)}
                          onDoubleClick={() => !editing && handleCellDoubleClick(item, field)}
                          onMouseDown={(e) => colIndex !== undefined && handleCellMouseDown(index, colIndex, e)}
                          onMouseEnter={() => {
                            if (colIndex !== undefined) {
                              handleCellMouseEnter(index, colIndex)
                              handleAutoFillMouseEnter(index, colIndex)
                            }
                          }}
                        >
                          {/* オートフィルハンドル */}
                          {showAutoFillHandle && (
                            <div
                              className="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-crosshair z-10 hover:bg-blue-700"
                              style={{ transform: 'translate(50%, 50%)' }}
                              onMouseDown={(e) => handleAutoFillStart(index, colIndex, e)}
                            />
                          )}
                          {editing ? (
                            inputType === 'select' ? (
                              <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full px-1 py-1 text-xs border border-blue-400 rounded bg-white text-black font-medium"
                                autoFocus
                              >
                                <option value="在庫あり">在庫あり</option>
                                <option value="売却済み">売却済み</option>
                              </select>
                            ) : inputType === 'date' ? (
                              <input
                                type="date"
                                value={editValue}
                                onChange={async (e) => {
                                  const val = e.target.value || null

                                  // Build update data
                                  let updateData: Record<string, string | number | null> = { [field]: val }

                                  // If it's sale_date, update status and recalculate commission
                                  if (field === 'sale_date') {
                                    if (val && val !== '返品') {
                                      updateData.status = '売却済み'
                                      // Recalculate commission
                                      const newCommission = calculateCommission(item.sale_destination, item.sale_price, val)
                                      updateData.commission = newCommission
                                      // Recalculate deposit amount
                                      if (item.sale_price !== null) {
                                        updateData.deposit_amount = item.sale_price - (newCommission || 0) - (item.shipping_cost || 0)
                                      }
                                    } else if (!val) {
                                      // Clear sale_date - always revert to unsold status
                                      updateData.status = '在庫あり'
                                    }
                                  }

                                  // Save to database
                                  const { error } = await supabase.from('inventory').update(updateData).eq('id', item.id)
                                  if (!error) {
                                    setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, ...updateData } : inv))
                                  }

                                  setEditingCell(null)
                                  setEditValue('')
                                }}
                                onKeyDown={handleKeyDown}
                                onBlur={() => {
                                  setEditingCell(null)
                                  setEditValue('')
                                }}
                                className="w-full px-1 py-1 text-sm border-2 border-blue-500 rounded font-semibold cursor-pointer"
                                style={{ backgroundColor: '#ffffff', color: '#111827', colorScheme: 'light' }}
                                ref={(el) => {
                                  if (el) {
                                    el.focus()
                                    try {
                                      el.showPicker()
                                    } catch {
                                      // showPickerがサポートされていない場合は無視
                                    }
                                  }
                                }}
                              />
                            ) : inputType === 'sale_destination' ? (
                              <select
                                value={editValue}
                                onChange={async (e) => {
                                  const val = e.target.value || null
                                  // 直接保存
                                  const newCommission = calculateCommission(val, item.sale_price, item.sale_date)
                                  const newStatus = val ? '売却済み' : '在庫あり'
                                  const newDepositAmount = item.sale_price !== null
                                    ? item.sale_price - (newCommission || 0) - (item.shipping_cost || 0)
                                    : null

                                  const updateData = {
                                    sale_destination: val,
                                    status: newStatus,
                                    commission: newCommission,
                                    deposit_amount: newDepositAmount
                                  }

                                  const { error } = await supabase
                                    .from('inventory')
                                    .update(updateData)
                                    .eq('id', item.id)

                                  if (!error) {
                                    setInventory(prev => prev.map(inv =>
                                      inv.id === item.id ? { ...inv, ...updateData } : inv
                                    ))
                                  }
                                  setEditingCell(null)
                                  setEditValue('')
                                }}
                                onKeyDown={handleKeyDown}
                                className="w-auto px-1 py-0.5 text-xs border border-blue-400 rounded bg-white text-black font-medium"
                                autoFocus
                              >
                                <option value="">-</option>
                                {saleDestinationOptions.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : inputType === 'purchase_source' ? (
                              <select
                                value={editValue}
                                onChange={async (e) => {
                                  const val = e.target.value || null
                                  const { error } = await supabase
                                    .from('inventory')
                                    .update({ purchase_source: val })
                                    .eq('id', item.id)

                                  if (!error) {
                                    setInventory(prev => prev.map(inv =>
                                      inv.id === item.id ? { ...inv, purchase_source: val } : inv
                                    ))
                                  }
                                  setEditingCell(null)
                                  setEditValue('')
                                }}
                                onKeyDown={handleKeyDown}
                                className="w-auto px-1 py-0.5 text-xs border border-blue-400 rounded bg-white text-black font-medium"
                                autoFocus
                              >
                                <option value="">-</option>
                                {purchaseSourceOptions.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : inputType === 'datalist' ? (
                              <>
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  list={datalistId}
                                  className={inputClass}
                                  autoFocus
                                />
                                <datalist id={datalistId}>
                                  {datalistOptions?.map((opt, i) => (
                                    <option key={i} value={opt} />
                                  ))}
                                </datalist>
                              </>
                            ) : inputType === 'number' ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className={numInputClass}
                                autoFocus
                              />
                            ) : (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className={inputClass}
                                autoFocus
                              />
                            )
                          ) : (
                            displayValue
                          )}
                        </td>
                      )
                    }

                    // 各列のセル描画関数
                    const renderColumnCell = (col: { key: string; label: string; draggable: boolean; width: string }, colIndex: number) => {
                      const colKey = col.key
                      const inRange = isCellInRange(index, colIndex)
                      const inAutoFillRange = isCellInAutoFillRange(index, colIndex)
                      const rangeClass = inRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''
                      const autoFillClass = inAutoFillRange ? 'bg-green-100 ring-1 ring-green-500 ring-inset' : ''
                      switch (colKey) {
                        case 'checkbox':
                          return (
                            <td key={colKey} className={`px-2 py-2 ${col.width} ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''}`}>
                              <MemoizedCheckbox
                                checked={isItemSelected(item.id)}
                                itemId={item.id}
                                index={index}
                                onSelect={handleSelectItem}
                              />
                            </td>
                          )
                        case 'index':
                          const isIndexSelected = isSelectedCell('inventory_number') // indexはinventory_numberとして扱う（コピー用）
                          return (
                            <td
                              key={colKey}
                              className={`px-3 py-2 text-sm text-gray-900 text-center ${col.width} ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} cursor-pointer hover:bg-blue-50`}
                            >
                              {globalIndex + 1}
                            </td>
                          )
                        case 'inventory_number':
                          const isInvNumSelected = isSelectedCell('inventory_number') && !selectionRange
                          return (
                            <td
                              key={colKey}
                              className={`px-3 py-2 text-sm text-gray-500 text-center ${col.width} ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} cursor-pointer hover:bg-blue-50 ${isInvNumSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''}`}
                              onClick={() => {
                                setSelectedCell({ id: item.id, field: 'inventory_number' })
                                setSelectionRange(null)
                              }}
                            >
                              {item.inventory_number || '-'}
                            </td>
                          )
                        case 'refund_status':
                          const isRefundSelected = isSelectedCell('refund_status') && !selectionRange
                          const refundInRange = colIndex !== undefined && isCellInRange(index, colIndex)
                          return (
                            <td
                              key={colKey}
                              className={`px-3 py-2 text-center ${col.width} ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} cursor-pointer hover:bg-blue-50 ${isRefundSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${refundInRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''}`}
                              onClick={() => {
                                setSelectedCell({ id: item.id, field: 'refund_status' })
                                setSelectionRange(null)
                              }}
                              onMouseDown={(e) => colIndex !== undefined && handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => {
                                if (colIndex !== undefined) {
                                  handleCellMouseEnter(index, colIndex)
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={item.refund_status === '返金済み'}
                                onChange={async (e) => {
                                  // セル選択も行う
                                  setSelectedCell({ id: item.id, field: 'refund_status' })
                                  setSelectionRange(null)
                                  const newStatus = e.target.checked ? '返金済み' : null
                                  const { error } = await supabase
                                    .from('inventory')
                                    .update({ refund_status: newStatus })
                                    .eq('id', item.id)
                                  if (!error) {
                                    setInventory(prev => prev.map(inv =>
                                      inv.id === item.id ? { ...inv, refund_status: newStatus } : inv
                                    ))
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                            </td>
                          )
                        case 'image':
                          const isImageSelected = isSelectedCell('image_url') && !selectionRange
                          return (
                            <td
                              key={colKey}
                              className={`px-3 py-1 overflow-hidden ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} ${rangeClass} ${autoFillClass} select-none cursor-pointer hover:bg-blue-50 ${isImageSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''}`}
                              style={{ height: '41px', maxHeight: '41px' }}
                              onClick={() => {
                                setSelectedCell({ id: item.id, field: 'image_url' })
                                setSelectionRange(null)
                              }}
                              onMouseDown={(e) => handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => {
                                handleCellMouseEnter(index, colIndex)
                                handleAutoFillMouseEnter(index, colIndex)
                              }}
                            >
                              <div className="flex justify-center items-center" style={{ height: '40px' }}>
                                {(() => {
                                  const imageUrl = item.saved_image_url || item.image_url
                                  const proxiedUrl = getProxiedImageUrl(imageUrl)
                                  const hasImageError = imageErrors.has(item.id)

                                  // 画像URLがあり、エラーが発生していない場合
                                  if (imageUrl && !hasImageError) {
                                    return (
                                      <div className="relative group flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                                        <img
                                          src={proxiedUrl || ''}
                                          alt=""
                                          className="absolute inset-0 w-full h-full object-cover rounded cursor-pointer hover:opacity-80"
                                          onClick={() => setImageModal(proxiedUrl)}
                                          onError={() => setImageErrors(prev => new Set(prev).add(item.id))}
                                        />
                                        <button
                                          className="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 hover:bg-gray-700 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setImageEditModal({ id: item.id, currentUrl: imageUrl })
                                            setImageUrlInput(imageUrl || '')
                                          }}
                                          title="画像を編集"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                          </svg>
                                        </button>
                                      </div>
                                    )
                                  }

                                  // 画像URLがない、またはエラーが発生した場合
                                  return (
                                    <div
                                      className={`w-10 h-10 ${hasImageError ? 'bg-red-100 hover:bg-red-200' : 'bg-gray-200 hover:bg-gray-300'} rounded flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer transition-colors`}
                                      onClick={() => {
                                        setImageEditModal({ id: item.id, currentUrl: imageUrl })
                                        setImageUrlInput(imageUrl || '')
                                      }}
                                      title={hasImageError ? '画像の読み込みに失敗しました。クリックして編集' : '画像を追加'}
                                    >
                                      {hasImageError ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <circle cx="12" cy="12" r="10" />
                                          <line x1="12" y1="8" x2="12" y2="12" />
                                          <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                      ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <line x1="12" y1="5" x2="12" y2="19" />
                                          <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            </td>
                          )
                        case 'category':
                          return renderCell('category', <span className="text-sm text-gray-900 block text-center">{item.category || '-'}</span>, 'datalist', categoryOptions, colIndex)
                        case 'brand_name':
                          const isBrandOpen = editingCell?.id === item.id && editingCell?.field === 'brand_name' && dropdownPosition
                          const isBrandSelected = isSelectedCell('brand_name') && !isBrandOpen && !selectionRange
                          const brandInRange = colIndex !== undefined && isCellInRange(index, colIndex)
                          const brandAutoFillRange = colIndex !== undefined && isCellInAutoFillRange(index, colIndex)
                          return (
                            <td
                              key={colKey}
                              className={`${cellClass} ${isBrandSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${brandInRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''} ${brandAutoFillRange ? 'bg-green-100 ring-1 ring-green-500 ring-inset' : ''} ${groupEndColumns.has('brand_name') ? 'border-r border-gray-300' : ''} select-none relative cursor-pointer`}
                              onClick={(e) => {
                                if (selectedCell?.id === item.id && selectedCell?.field === 'brand_name' && !selectionRange) {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const dropdownHeight = 300
                                  const spaceBelow = window.innerHeight - rect.bottom
                                  const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                  setDropdownPosition({ top, left: rect.left })
                                  startEditCell(item, 'brand_name')
                                } else {
                                  setSelectedCell({ id: item.id, field: 'brand_name' })
                                  setSelectionRange(null)
                                  if (editingCell) {
                                    saveEditingCell()
                                    setDropdownPosition(null)
                                  }
                                }
                              }}
                              onDoubleClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const dropdownHeight = 300
                                const spaceBelow = window.innerHeight - rect.bottom
                                const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                setDropdownPosition({ top, left: rect.left })
                                setSelectedCell({ id: item.id, field: 'brand_name' })
                                setSelectionRange(null)
                                startEditCell(item, 'brand_name')
                              }}
                              onMouseDown={(e) => colIndex !== undefined && handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => {
                                if (colIndex !== undefined) {
                                  handleCellMouseEnter(index, colIndex)
                                  handleAutoFillMouseEnter(index, colIndex)
                                }
                              }}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-sm text-gray-900 truncate" title={item.brand_name || ''}>{item.brand_name || '-'}</span>
                                <span
                                  className="cursor-pointer hover:opacity-70 flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const rect = e.currentTarget.closest('td')!.getBoundingClientRect()
                                    const dropdownHeight = 300
                                    const spaceBelow = window.innerHeight - rect.bottom
                                    const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                    setDropdownPosition({ top, left: rect.left })
                                    setSelectedCell({ id: item.id, field: 'brand_name' })
                                    setSelectionRange(null)
                                    startEditCell(item, 'brand_name')
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-gray-400">
                                    <path d="M2 3.5L5 7L8 3.5H2Z" />
                                  </svg>
                                </span>
                              </div>
                              {isBrandOpen && createPortal(
                                <>
                                  <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setEditingCell(null); setEditValue(''); setDropdownPosition(null) }} />
                                  <div
                                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto"
                                    style={{ top: dropdownPosition.top, left: dropdownPosition.left, minWidth: '150px' }}
                                  >
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          const val = editValue || null
                                          supabase.from('inventory').update({ brand_name: val }).eq('id', item.id).then(({ error }) => {
                                            if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, brand_name: val } : inv))
                                          })
                                          setEditingCell(null)
                                          setEditValue('')
                                          setDropdownPosition(null)
                                        } else if (e.key === 'Escape') {
                                          setEditingCell(null)
                                          setEditValue('')
                                          setDropdownPosition(null)
                                        }
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-1"
                                      placeholder="ブランド名を入力..."
                                      autoFocus
                                    />
                                    {uniqueBrands
                                      .filter(brand => !editValue || brand.toLowerCase().includes(editValue.toLowerCase()))
                                      .slice(0, 20)
                                      .map((brand) => (
                                        <div
                                          key={brand}
                                          className="px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer"
                                          onClick={async () => {
                                            const { error } = await supabase.from('inventory').update({ brand_name: brand }).eq('id', item.id)
                                            if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, brand_name: brand } : inv))
                                            setEditingCell(null)
                                            setEditValue('')
                                            setDropdownPosition(null)
                                          }}
                                        >
                                          {brand}
                                        </div>
                                      ))}
                                  </div>
                                </>,
                                document.body
                              )}
                            </td>
                          )
                        case 'product_name':
                          const isProductEditing = isEditingCell('product_name')
                          const isProductSelected = isSelectedCell('product_name') && !isProductEditing && !selectionRange
                          const productInRange = colIndex !== undefined && isCellInRange(index, colIndex)
                          const productAutoFillRange = colIndex !== undefined && isCellInAutoFillRange(index, colIndex)
                          return (
                            <td
                              key={colKey}
                              className={`${cellClass} ${isProductEditing ? 'ring-2 ring-blue-500 ring-inset' : ''} ${isProductSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${productInRange ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : ''} ${productAutoFillRange ? 'bg-green-100 ring-1 ring-green-500 ring-inset' : ''} ${groupEndColumns.has('product_name') ? 'border-r border-gray-300' : ''} select-none relative`}
                              onClick={() => {
                                if (!isProductEditing) {
                                  setModalEdit({ id: item.id, field: 'product_name', value: item.product_name || '' })
                                  setSelectedCell({ id: item.id, field: 'product_name' })
                                  setSelectionRange(null)
                                }
                              }}
                              onDoubleClick={() => {
                                if (!isProductEditing) {
                                  setModalEdit({ id: item.id, field: 'product_name', value: item.product_name || '' })
                                }
                              }}
                              onMouseDown={(e) => colIndex !== undefined && handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => {
                                if (colIndex !== undefined) {
                                  handleCellMouseEnter(index, colIndex)
                                  handleAutoFillMouseEnter(index, colIndex)
                                }
                              }}
                            >
                              <span className="text-sm text-gray-900 block max-w-[100px] truncate" title={item.product_name}>{item.product_name}</span>
                            </td>
                          )
                        case 'purchase_source':
                          const sourceColor = item.purchase_source ? platformColors[item.purchase_source] : null
                          const isPurchaseSourceOpen = editingCell?.id === item.id && editingCell?.field === 'purchase_source' && dropdownPosition
                          const isPurchaseSourceSelected = isSelectedCell('purchase_source') && !isPurchaseSourceOpen && !selectionRange
                          const showPurchaseSourceAutoFill = isPurchaseSourceSelected && !selectionRange
                          return (
                            <td
                              key={colKey}
                              style={{ width: `${chipColumnWidth}px`, minWidth: `${chipColumnWidth}px` }}
                              className={`${cellClass} ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} ${isPurchaseSourceSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${rangeClass} ${autoFillClass} select-none relative`}
                              onClick={(e) => {
                                // 同じセルが選択されている場合は編集モードに入る
                                if (selectedCell?.id === item.id && selectedCell?.field === 'purchase_source' && !selectionRange) {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const dropdownHeight = 300
                                  const spaceBelow = window.innerHeight - rect.bottom
                                  const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                  setDropdownPosition({ top, left: rect.left })
                                  startEditCell(item, 'purchase_source')
                                } else {
                                  // 別のセルをクリックした場合は選択状態にする
                                  setSelectedCell({ id: item.id, field: 'purchase_source' })
                                  setSelectionRange(null)
                                  if (editingCell) {
                                    saveEditingCell()
                                    setDropdownPosition(null)
                                  }
                                }
                              }}
                              onDoubleClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const dropdownHeight = 300
                                const spaceBelow = window.innerHeight - rect.bottom
                                const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                setDropdownPosition({ top, left: rect.left })
                                setSelectedCell({ id: item.id, field: 'purchase_source' })
                                setSelectionRange(null)
                                startEditCell(item, 'purchase_source')
                              }}
                              onMouseDown={(e) => handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => {
                                handleCellMouseEnter(index, colIndex)
                                handleAutoFillMouseEnter(index, colIndex)
                              }}
                            >
                              {/* オートフィルハンドル */}
                              {showPurchaseSourceAutoFill && (
                                <div
                                  className="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-crosshair z-10 hover:bg-blue-700"
                                  style={{ transform: 'translate(50%, 50%)' }}
                                  onMouseDown={(e) => handleAutoFillStart(index, colIndex, e)}
                                />
                              )}
                              <div className="flex justify-center w-full">
                              {item.purchase_source ? (
                                <span
                                  className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full ${sourceColor || 'bg-gray-100 text-gray-800'}`}
                                  style={{ width: `${chipColumnWidth - 16}px` }}
                                >
                                  <span className="truncate text-center">{item.purchase_source}</span>
                                  <span
                                    className="ml-1 cursor-pointer hover:opacity-70 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const rect = e.currentTarget.closest('td')!.getBoundingClientRect()
                                      const dropdownHeight = 300
                                      const spaceBelow = window.innerHeight - rect.bottom
                                      const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                      setDropdownPosition({ top, left: rect.left })
                                      setSelectedCell({ id: item.id, field: 'purchase_source' })
                                      setSelectionRange(null)
                                      startEditCell(item, 'purchase_source')
                                    }}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                      <path d="M2 3.5L5 7L8 3.5H2Z" />
                                    </svg>
                                  </span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center text-sm text-gray-400 cursor-pointer hover:text-gray-600"
                                  style={{ width: `${chipColumnWidth - 16}px` }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const rect = e.currentTarget.closest('td')!.getBoundingClientRect()
                                    const dropdownHeight = 300
                                    const spaceBelow = window.innerHeight - rect.bottom
                                    const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                    setDropdownPosition({ top, left: rect.left })
                                    setSelectedCell({ id: item.id, field: 'purchase_source' })
                                    setSelectionRange(null)
                                    startEditCell(item, 'purchase_source')
                                  }}
                                >
                                  -
                                  <svg className="ml-0.5" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                    <path d="M2 3.5L5 7L8 3.5H2Z" />
                                  </svg>
                                </span>
                              )}
                              </div>
                              {isPurchaseSourceOpen && createPortal(
                                <>
                                  <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setEditingCell(null); setEditValue(''); setDropdownPosition(null) }} />
                                  <div
                                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto"
                                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex gap-1 mb-1 pb-1 border-b border-gray-200">
                                      <input
                                        type="text"
                                        placeholder="自由入力"
                                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter') {
                                            const value = (e.target as HTMLInputElement).value.trim()
                                            if (value) {
                                              const { error } = await supabase.from('inventory').update({ purchase_source: value }).eq('id', item.id)
                                              if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, purchase_source: value } : inv))
                                            }
                                            setEditingCell(null)
                                            setEditValue('')
                                            setDropdownPosition(null)
                                          }
                                        }}
                                      />
                                    </div>
                                    <button
                                      className="inline-flex px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap bg-gray-100 text-gray-800 hover:bg-gray-200"
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        if (item.purchase_source !== null) {
                                          const { error } = await supabase.from('inventory').update({ purchase_source: null }).eq('id', item.id)
                                          if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, purchase_source: null } : inv))
                                        }
                                        setEditingCell(null)
                                        setEditValue('')
                                        setDropdownPosition(null)
                                      }}
                                    >
                                      -
                                    </button>
                                    {purchaseSourceOptions.map((option) => {
                                      const optColor = platformColors[option] || 'bg-gray-100 text-gray-800'
                                      return (
                                        <div
                                          key={option}
                                          className={`flex items-center justify-between w-full px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${optColor} hover:opacity-80 cursor-pointer`}
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            if (item.purchase_source !== option) {
                                              const { error } = await supabase.from('inventory').update({ purchase_source: option }).eq('id', item.id)
                                              if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, purchase_source: option } : inv))
                                            }
                                            setEditingCell(null)
                                            setEditValue('')
                                            setDropdownPosition(null)
                                          }}
                                        >
                                          <span>{option}</span>
                                          <button
                                            className="ml-2 text-current opacity-50 hover:opacity-100"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              hidePlatform(option)
                                            }}
                                            title="この選択肢を非表示"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      )
                                    })}
                                    {hiddenPlatforms.size > 0 && (
                                      <button
                                        className="mt-1 pt-1 border-t border-gray-200 text-xs text-blue-600 hover:text-blue-800"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          resetHiddenPlatforms()
                                        }}
                                      >
                                        初期値に戻す
                                      </button>
                                    )}
                                  </div>
                                </>,
                                document.body
                              )}
                            </td>
                          )
                        case 'sale_destination':
                          const destColor = item.sale_destination ? saleDestinationColors[item.sale_destination] : null
                          const isSaleDestOpen = editingCell?.id === item.id && editingCell?.field === 'sale_destination' && dropdownPosition
                          const isSaleDestSelected = isSelectedCell('sale_destination') && !isSaleDestOpen && !selectionRange
                          const showSaleDestAutoFill = isSaleDestSelected && !selectionRange
                          return (
                            <td
                              key={colKey}
                              style={{ width: `${chipColumnWidth}px`, minWidth: `${chipColumnWidth}px` }}
                              className={`${cellClass} ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} ${isSaleDestSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''} ${rangeClass} ${autoFillClass} select-none relative`}
                              onClick={(e) => {
                                // 同じセルが選択されている場合は編集モードに入る
                                if (selectedCell?.id === item.id && selectedCell?.field === 'sale_destination' && !selectionRange) {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const dropdownHeight = 300
                                  const spaceBelow = window.innerHeight - rect.bottom
                                  const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                  setDropdownPosition({ top, left: rect.left })
                                  startEditCell(item, 'sale_destination')
                                } else {
                                  // 別のセルをクリックした場合は選択状態にする
                                  setSelectedCell({ id: item.id, field: 'sale_destination' })
                                  setSelectionRange(null)
                                  if (editingCell) {
                                    saveEditingCell()
                                    setDropdownPosition(null)
                                  }
                                }
                              }}
                              onDoubleClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const dropdownHeight = 300
                                const spaceBelow = window.innerHeight - rect.bottom
                                const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                setDropdownPosition({ top, left: rect.left })
                                setSelectedCell({ id: item.id, field: 'sale_destination' })
                                setSelectionRange(null)
                                startEditCell(item, 'sale_destination')
                              }}
                              onMouseDown={(e) => handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => {
                                handleCellMouseEnter(index, colIndex)
                                handleAutoFillMouseEnter(index, colIndex)
                              }}
                            >
                              {/* オートフィルハンドル */}
                              {showSaleDestAutoFill && (
                                <div
                                  className="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-crosshair z-10 hover:bg-blue-700"
                                  style={{ transform: 'translate(50%, 50%)' }}
                                  onMouseDown={(e) => handleAutoFillStart(index, colIndex, e)}
                                />
                              )}
                              <div className="flex justify-center w-full">
                                {item.sale_destination ? (
                                  <span
                                    className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full ${destColor || 'bg-gray-100 text-gray-800'}`}
                                    style={{ width: `${chipColumnWidth - 16}px` }}
                                  >
                                    <span className="truncate text-center">{item.sale_destination}</span>
                                    <span
                                      className="ml-1 cursor-pointer hover:opacity-70 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const rect = e.currentTarget.closest('td')!.getBoundingClientRect()
                                        const dropdownHeight = 300
                                        const spaceBelow = window.innerHeight - rect.bottom
                                        const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                        setDropdownPosition({ top, left: rect.left })
                                        setSelectedCell({ id: item.id, field: 'sale_destination' })
                                        setSelectionRange(null)
                                        startEditCell(item, 'sale_destination')
                                      }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M2 3.5L5 7L8 3.5H2Z" />
                                      </svg>
                                    </span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center justify-center text-sm text-gray-400"
                                    style={{ width: `${chipColumnWidth - 16}px` }}
                                  >
                                    -
                                    <span
                                      className="ml-0.5 cursor-pointer hover:text-gray-600 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const rect = e.currentTarget.closest('td')!.getBoundingClientRect()
                                        const dropdownHeight = 300
                                        const spaceBelow = window.innerHeight - rect.bottom
                                        const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4
                                        setDropdownPosition({ top, left: rect.left })
                                        setSelectedCell({ id: item.id, field: 'sale_destination' })
                                        setSelectionRange(null)
                                        startEditCell(item, 'sale_destination')
                                      }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                        <path d="M2 3.5L5 7L8 3.5H2Z" />
                                      </svg>
                                    </span>
                                  </span>
                                )}
                              </div>
                              {isSaleDestOpen && createPortal(
                                <>
                                  <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setEditingCell(null); setEditValue(''); setDropdownPosition(null) }} />
                                  <div
                                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto"
                                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex gap-1 mb-1 pb-1 border-b border-gray-200">
                                      <input
                                        type="text"
                                        placeholder="自由入力"
                                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter') {
                                            const value = (e.target as HTMLInputElement).value.trim()
                                            if (value) {
                                              // 「返品」の場合は出品日・売却日も「返品」に設定、売上関連をクリア
                                              if (value === '返品') {
                                                const { error } = await supabase.from('inventory').update({
                                                  sale_destination: value,
                                                  listing_date: '返品',
                                                  sale_date: '返品',
                                                  sale_price: null,
                                                  commission: null,
                                                  profit: null,
                                                  profit_rate: null
                                                }).eq('id', item.id)
                                                if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: value, listing_date: '返品', sale_date: '返品', sale_price: null, commission: null, profit: null, profit_rate: null } : inv))
                                              } else {
                                                // 返品から別の販売先に変更した場合、出品日・売却日をクリア
                                                if (item.sale_destination === '返品') {
                                                  const { error } = await supabase.from('inventory').update({
                                                    sale_destination: value,
                                                    listing_date: null,
                                                    sale_date: null
                                                  }).eq('id', item.id)
                                                  if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: value, listing_date: null, sale_date: null } : inv))
                                                } else {
                                                  const { error } = await supabase.from('inventory').update({ sale_destination: value }).eq('id', item.id)
                                                  if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: value } : inv))
                                                }
                                              }
                                            }
                                            setEditingCell(null)
                                            setEditValue('')
                                            setDropdownPosition(null)
                                          }
                                        }}
                                      />
                                    </div>
                                    <button
                                      className="inline-flex px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap bg-gray-100 text-gray-800 hover:bg-gray-200"
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        if (item.sale_destination !== null) {
                                          // 返品からクリアした場合、出品日・売却日もクリア
                                          if (item.sale_destination === '返品') {
                                            const { error } = await supabase.from('inventory').update({
                                              sale_destination: null,
                                              listing_date: null,
                                              sale_date: null
                                            }).eq('id', item.id)
                                            if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: null, listing_date: null, sale_date: null } : inv))
                                          } else {
                                            const { error } = await supabase.from('inventory').update({ sale_destination: null }).eq('id', item.id)
                                            if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: null } : inv))
                                          }
                                        }
                                        setEditingCell(null)
                                        setEditValue('')
                                        setDropdownPosition(null)
                                      }}
                                    >
                                      -
                                    </button>
                                    {saleDestinationOptions.map((option) => {
                                      const optColor = saleDestinationColors[option] || 'bg-gray-100 text-gray-800'
                                      return (
                                        <div
                                          key={option}
                                          className={`flex items-center justify-between w-full px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${optColor} hover:opacity-80 cursor-pointer`}
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            console.log('販売先選択:', option, '現在値:', item.sale_destination)
                                            if (item.sale_destination !== option) {
                                              // 「返品」の場合は出品日・売却日も「返品」に設定
                                              if (option === '返品') {
                                                console.log('返品処理開始')
                                                const { error } = await supabase.from('inventory').update({
                                                  sale_destination: option,
                                                  listing_date: '返品',
                                                  sale_date: '返品',
                                                  sale_price: null,
                                                  commission: null,
                                                  profit: null,
                                                  profit_rate: null
                                                }).eq('id', item.id)
                                                console.log('返品更新結果:', error ? error.message : '成功')
                                                if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: option, listing_date: '返品', sale_date: '返品', sale_price: null, commission: null, profit: null, profit_rate: null } : inv))
                                              } else {
                                                // 返品から別の販売先に変更した場合、出品日・売却日をクリア
                                                if (item.sale_destination === '返品') {
                                                  const { error } = await supabase.from('inventory').update({
                                                    sale_destination: option,
                                                    listing_date: null,
                                                    sale_date: null
                                                  }).eq('id', item.id)
                                                  if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: option, listing_date: null, sale_date: null } : inv))
                                                } else {
                                                  const { error } = await supabase.from('inventory').update({ sale_destination: option }).eq('id', item.id)
                                                  if (!error) setInventory(prev => prev.map(inv => inv.id === item.id ? { ...inv, sale_destination: option } : inv))
                                                }
                                              }
                                            }
                                            setEditingCell(null)
                                            setEditValue('')
                                            setDropdownPosition(null)
                                          }}
                                        >
                                          <span>{option}</span>
                                          <button
                                            className="ml-2 text-current opacity-50 hover:opacity-100"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              hidePlatform(option)
                                            }}
                                            title="この選択肢を非表示"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      )
                                    })}
                                    {hiddenPlatforms.size > 0 && (
                                      <button
                                        className="mt-1 pt-1 border-t border-gray-200 text-xs text-blue-600 hover:text-blue-800"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          resetHiddenPlatforms()
                                        }}
                                      >
                                        初期値に戻す
                                      </button>
                                    )}
                                  </div>
                                </>,
                                document.body
                              )}
                            </td>
                          )
                        case 'purchase_price':
                          return renderCell('purchase_price', <span className="text-sm text-gray-900">{formatPrice(item.purchase_price)}</span>, 'number', undefined, colIndex)
                        case 'purchase_total':
                          return renderCell('purchase_total', <span className="text-sm text-gray-900">{formatPrice(item.purchase_total)}</span>, 'number', undefined, colIndex)
                        case 'sale_price':
                          return renderCell('sale_price', <span className="text-sm text-gray-900">{formatPrice(item.sale_price)}</span>, 'number', undefined, colIndex)
                        case 'commission':
                          return renderCell('commission', <span className="text-sm text-gray-900">{formatPrice(item.commission)}</span>, 'number', undefined, colIndex)
                        case 'shipping_cost':
                          return renderCell('shipping_cost', <span className="text-sm text-gray-900">{formatPrice(item.shipping_cost)}</span>, 'number', undefined, colIndex)
                        case 'other_cost':
                          return renderCell('other_cost', <span className="text-sm text-gray-900">{formatPrice(item.other_cost)}</span>, 'number', undefined, colIndex)
                        case 'deposit_amount':
                          return renderCell('deposit_amount', <span className="text-sm text-gray-900">{formatPrice(item.deposit_amount)}</span>, 'number', undefined, colIndex)
                        case 'profit':
                          return (
                            <td
                              key={colKey}
                              className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${profit === null ? 'text-gray-400' : profit >= 0 ? 'text-green-600' : 'text-red-600'} ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} ${rangeClass} select-none`}
                              onMouseDown={(e) => handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => handleCellMouseEnter(index, colIndex)}
                            >
                              {profit !== null ? formatPrice(profit) : '-'}
                            </td>
                          )
                        case 'profit_rate':
                          return (
                            <td
                              key={colKey}
                              className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${profitRate === null ? 'text-gray-400' : profitRate >= 0 ? 'text-green-600' : 'text-red-600'} ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} ${rangeClass} select-none`}
                              onMouseDown={(e) => handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => handleCellMouseEnter(index, colIndex)}
                            >
                              {profitRate !== null ? `${profitRate}%` : '-'}
                            </td>
                          )
                        case 'purchase_date':
                          return renderCell('purchase_date', formatDateWithBreak(item.purchase_date), 'date', undefined, colIndex)
                        case 'listing_date':
                          return renderCell('listing_date', formatDateWithBreak(item.listing_date), 'date', undefined, colIndex)
                        case 'sale_date':
                          return renderCell('sale_date', formatDateWithBreak(item.sale_date), 'date', undefined, colIndex)
                        case 'turnover_days':
                          return (
                            <td
                              key={colKey}
                              className={`px-3 py-2 text-sm text-gray-900 whitespace-nowrap ${groupEndColumns.has(colKey) ? 'border-r border-gray-300' : ''} ${rangeClass} select-none`}
                              onMouseDown={(e) => handleCellMouseDown(index, colIndex, e)}
                              onMouseEnter={() => handleCellMouseEnter(index, colIndex)}
                            >
                              {turnoverDays !== null ? `${turnoverDays}日` : '-'}
                            </td>
                          )
                        case 'memo':
                          return renderCell('memo', <span className="text-sm text-gray-900 block max-w-[120px] truncate" title={item.memo || ''}>{item.memo || '-'}</span>, 'text', undefined, colIndex)
                        default:
                          return null
                      }
                    }

                    const isSold = !!item.sale_destination
                    // 返品タブでは返金済みをグレーアウト、それ以外は売却済みをグレーアウト
                    const shouldGrayOut = quickFilter === 'returns' ? item.refund_status === '返金済み' : isSold

                    return (
                      <tr
                        key={item.id}
                        data-index={virtualRow.index}
                        className={`hover:bg-gray-50 ${shouldGrayOut ? 'bg-gray-100 opacity-60' : ''}`}
                        style={{ height: '41px', maxHeight: '41px' }}
                      >
                        {visibleColumns.map((col, colIdx) => renderColumnCell(col, colIdx))}
                      </tr>
                    )
                  })}
                  {/* 下部のスペーサー */}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{
                      height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end || 0)}px`
                    }}>
                      <td colSpan={visibleColumns.length}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ページネーション */}
          {sortedInventory.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 mb-4">
              <span className="text-sm text-black">
                {itemsPerPage === -1
                  ? `${sortedInventory.length}件を全件表示`
                  : `${sortedInventory.length}件中 ${(currentPage - 1) * itemsPerPage + 1}〜${Math.min(currentPage * itemsPerPage, sortedInventory.length)}件を表示`
                }
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-sm text-black border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  最初
                </button>
                <button
                  onClick={() => updateCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm text-black border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  ←
                </button>
                <span className="text-sm text-black font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => updateCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm text-black border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  →
                </button>
                <button
                  onClick={() => updateCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-sm text-black border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  最後
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 商品名編集モーダル（画面下部に固定表示） */}
      {modalEdit && (
        <div className="fixed bottom-4 left-4 right-4 z-[110] bg-white shadow-lg border rounded-lg">
          <div className="px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600 whitespace-nowrap">商品名:</span>
            <input
              type="text"
              value={modalEdit.value}
              onChange={(e) => setModalEdit({ ...modalEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  saveModalEdit()
                } else if (e.key === 'Escape') {
                  setModalEdit(null)
                }
              }}
              className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              autoFocus
            />
            <button
              onClick={() => setModalEdit(null)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium whitespace-nowrap"
            >
              キャンセル
            </button>
            <button
              onClick={saveModalEdit}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium whitespace-nowrap"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* 画像拡大モーダル */}
      {imageModal && (
        <div
          className="fixed inset-0 z-[200] bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setImageModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold"
            >
              ✕
            </button>
            <img
              src={imageModal}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* 画像編集モーダル */}
      {imageEditModal && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => {
            setImageEditModal(null)
            setImageUrlInput('')
            setIsDraggingImage(false)
          }}
        >
          <div
            className={`bg-white rounded-lg shadow-xl p-6 w-full max-w-md ${isDraggingImage ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDraggingImage(true)
            }}
            onDragLeave={() => setIsDraggingImage(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDraggingImage(false)
              const file = e.dataTransfer.files[0]
              if (file) {
                handleImageDrop(imageEditModal.id, file)
              }
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {imageEditModal.currentUrl ? '画像を編集' : '画像を追加'}
              </h3>
              <button
                onClick={() => {
                  setImageEditModal(null)
                  setImageUrlInput('')
                  setIsDraggingImage(false)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* 現在の画像プレビュー */}
            {imageEditModal.currentUrl && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">現在の画像:</p>
                <img
                  src={getProxiedImageUrl(imageEditModal.currentUrl) || ''}
                  alt=""
                  className="w-20 h-20 object-cover rounded border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}

            {/* ドラッグ&ドロップエリア */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-colors ${
                isDraggingImage ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="image-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleImageDrop(imageEditModal.id, file)
                  }
                }}
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-600">
                  画像をドラッグ&ドロップ<br />
                  <span className="text-blue-600 hover:text-blue-700">またはクリックして選択</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">最大5MB</p>
              </label>
            </div>

            {/* URL入力 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">または画像URLを入力</label>
              <input
                type="text"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && imageUrlInput.trim()) {
                    handleSaveImageUrl(imageEditModal.id, imageUrlInput)
                  }
                }}
              />
            </div>

            {/* ボタン */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setImageEditModal(null)
                  setImageUrlInput('')
                  setIsDraggingImage(false)
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSaveImageUrl(imageEditModal.id, imageUrlInput)}
                disabled={!imageUrlInput.trim()}
                className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                URL保存
              </button>
            </div>

            {/* 画像削除ボタン */}
            {imageEditModal.currentUrl && (
              <button
                onClick={async () => {
                  if (confirm('画像を削除しますか？')) {
                    try {
                      const { error } = await supabase
                        .from('inventory')
                        .update({ image_url: null, saved_image_url: null })
                        .eq('id', imageEditModal.id)
                      if (error) throw error
                      setInventory(prev => prev.map(item =>
                        item.id === imageEditModal.id ? { ...item, image_url: null, saved_image_url: null } : item
                      ))
                      setImageEditModal(null)
                      setImageUrlInput('')
                    } catch (error) {
                      console.error('Error deleting image:', error)
                      alert('画像の削除に失敗しました')
                    }
                  }
                }}
                className="w-full mt-3 px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200"
              >
                画像を削除
              </button>
            )}
          </div>
        </div>
      )}

      {/* エコオク: 仕入日入力ダイアログ */}
      {pendingCSV && pendingCSV.type === 'ecoauc' && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">仕入日を入力してください</h3>
            <input
              type="date"
              value={csvPurchaseDate}
              onChange={(e) => setCsvPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black mb-4"
              autoFocus
              ref={(el) => {
                if (el) {
                  setTimeout(() => {
                    try {
                      el.showPicker()
                    } catch (e) {
                      // showPickerがサポートされていない場合は無視
                    }
                  }, 50)
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setPendingCSV(null)
                  setCsvPurchaseDate('')
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  if (pendingCSV) {
                    handleCSVUpload(pendingCSV.file, csvPurchaseDate || null, null)
                  }
                }}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                取り込み
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スターバイヤーズ: 画像CSV選択ダイアログ */}
      {pendingCSV && pendingCSV.type === 'starbuyers' && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">スターバイヤーズCSVを取り込み</h3>
            <p className="text-sm text-gray-600 mb-4">画像CSVを選択すると、管理番号で画像を自動マッチングします。</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                画像CSV（任意）
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setStarBuyersImageCSV(file)
                }}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {starBuyersImageCSV && (
                <p className="mt-2 text-sm text-green-600">選択: {starBuyersImageCSV.name}</p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setPendingCSV(null)
                  setStarBuyersImageCSV(null)
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (pendingCSV) {
                    let imageMap: Map<string, string> | null = null
                    if (starBuyersImageCSV) {
                      imageMap = await parseImageCSV(starBuyersImageCSV)
                    }
                    handleCSVUpload(pendingCSV.file, null, imageMap)
                  }
                }}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                取り込み
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モノバンク: 画像CSV選択ダイアログ */}
      {pendingCSV && pendingCSV.type === 'monobank' && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">モノバンクCSVを取り込み</h3>
            <p className="text-sm text-gray-600 mb-4">画像CSVを選択すると、箱番-枝番で画像を自動マッチングします。</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                画像CSV（任意）
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setStarBuyersImageCSV(file)
                }}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {starBuyersImageCSV && (
                <p className="mt-2 text-sm text-green-600">選択: {starBuyersImageCSV.name}</p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setPendingCSV(null)
                  setStarBuyersImageCSV(null)
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (pendingCSV) {
                    let imageMap: Map<string, string> | null = null
                    if (starBuyersImageCSV) {
                      imageMap = await parseMonobankImageCSV(starBuyersImageCSV)
                    }
                    handleCSVUpload(pendingCSV.file, null, imageMap)
                  }
                }}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                取り込み
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 取り込み結果モーダル */}
      {importResult && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {importResult.source}からの取り込み結果
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4">
              {/* 登録済み */}
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  登録: {importResult.newItems.length}件
                </h4>
                {importResult.newItems.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {importResult.newItems.map((item, i) => (
                          <tr key={i} className="border-b border-green-100 last:border-0">
                            <td className="py-1 text-gray-700 truncate max-w-[300px]" title={item.product_name}>
                              {item.product_name}
                            </td>
                            <td className="py-1 text-right text-gray-600 whitespace-nowrap">
                              {item.purchase_total ? `¥${item.purchase_total.toLocaleString()}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* スキップ（重複） */}
              {importResult.skippedItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-orange-700 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    重複スキップ: {importResult.skippedItems.length}件
                  </h4>
                  <div className="bg-orange-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {importResult.skippedItems.map((item, i) => (
                          <tr key={i} className="border-b border-orange-100 last:border-0">
                            <td className="py-1 text-gray-700 truncate max-w-[300px]" title={item.product_name}>
                              {item.product_name}
                            </td>
                            <td className="py-1 text-right text-gray-600 whitespace-nowrap">
                              {item.purchase_total ? `¥${item.purchase_total.toLocaleString()}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t flex justify-end">
              <button
                onClick={() => setImportResult(null)}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ラクマ手数料通知モーダル（26日以降に自動表示） */}
      {showRakumaModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
          onClick={() => {
            localStorage.setItem(`rakuma_dismissed_${rakumaModalYearMonth}`, 'true')
            setShowRakumaModal(false)
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-pink-500">
              <h3 className="text-lg font-semibold text-white">ラクマ手数料の確認</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                {rakumaModalYearMonth.replace('-', '年')}月のラクマ手数料率を設定してください。
              </p>
              <div className="flex items-center gap-2 mb-6">
                <input
                  type="number"
                  value={rakumaModalRate}
                  onChange={(e) => setRakumaModalRate(e.target.value)}
                  placeholder="例: 4.5"
                  step="0.1"
                  min="0"
                  max="100"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                />
                <span className="text-gray-600 font-medium">%</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    localStorage.setItem(`rakuma_dismissed_${rakumaModalYearMonth}`, 'true')
                    setShowRakumaModal(false)
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  後で設定
                </button>
                <button
                  onClick={async () => {
                    if (!rakumaModalRate) return
                    const rate = parseFloat(rakumaModalRate)
                    if (isNaN(rate)) return

                    const { error } = await supabase
                      .from('rakuma_commission_settings')
                      .upsert({
                        year_month: rakumaModalYearMonth,
                        commission_rate: rate,
                        updated_at: new Date().toISOString()
                      }, { onConflict: 'year_month' })

                    if (error) {
                      console.error('ラクマ手数料保存エラー:', error)
                      alert('ラクマ手数料の保存に失敗しました。テーブルが存在しない可能性があります。\n\nエラー: ' + error.message)
                    } else {
                      setRakumaCommissionSettings(prev => ({
                        ...prev,
                        [rakumaModalYearMonth]: rate
                      }))
                      setShowRakumaModal(false)
                    }
                  }}
                  className="flex-1 px-4 py-2 text-white bg-pink-500 hover:bg-pink-600 rounded-lg font-medium transition-colors"
                >
                  設定する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 手動商品追加モーダル */}
      {showAddItemModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
          onClick={() => setShowAddItemModal(false)}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-slate-600 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">商品を追加</h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                商品名に「セット」「まとめ」「○本」「○点」等が含まれる場合は、自動的に「まとめ仕入れ」に振り分けられます。
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">商品名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newItemForm.product_name}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, product_name: e.target.value }))}
                  placeholder="例: エルメス ネクタイ シルク"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                {isBulkItem(newItemForm.product_name) && (
                  <p className="text-sm text-orange-600 mt-1">→ まとめ仕入れとして登録されます</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ブランド</label>
                  <input
                    type="text"
                    value={newItemForm.brand_name}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, brand_name: e.target.value }))}
                    placeholder="自動検出"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                  <input
                    type="text"
                    value={newItemForm.category}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="自動検出"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">原価 <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={newItemForm.purchase_price}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, purchase_price: e.target.value }))}
                    placeholder="税抜金額"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仕入総額 <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={newItemForm.purchase_total}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, purchase_total: e.target.value }))}
                    placeholder="税込・手数料込"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仕入日 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={newItemForm.purchase_date}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, purchase_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                    onDoubleClick={(e) => {
                      try {
                        (e.target as HTMLInputElement).showPicker()
                      } catch (err) {
                        // showPickerがサポートされていない場合は無視
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仕入先 <span className="text-red-500">*</span></label>
                  <select
                    value={newItemForm.purchase_source}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, purchase_source: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  >
                    <option value="">選択してください</option>
                    {purchaseSourceOptions.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddItem}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  登録
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ラクマ手数料設定一覧モーダル */}
      {showRakumaSettingsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
          onClick={() => setShowRakumaSettingsModal(false)}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-pink-500 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">ラクマ手数料設定</h3>
              <button
                onClick={() => setShowRakumaSettingsModal(false)}
                className="text-white hover:text-pink-200"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">月ごとの手数料率を設定できます。設定がない月は10%が適用されます。</p>

                {/* 新規追加フォーム */}
                <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="month"
                    value={rakumaModalYearMonth}
                    onChange={(e) => setRakumaModalYearMonth(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                  />
                  <input
                    type="number"
                    value={rakumaModalRate}
                    onChange={(e) => setRakumaModalRate(e.target.value)}
                    placeholder="例: 4.5"
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                  />
                  <span className="text-gray-600">%</span>
                  <button
                    onClick={async () => {
                      if (!rakumaModalYearMonth || !rakumaModalRate) return
                      const rate = parseFloat(rakumaModalRate)
                      if (isNaN(rate)) return

                      const { error } = await supabase
                        .from('rakuma_commission_settings')
                        .upsert({
                          year_month: rakumaModalYearMonth,
                          commission_rate: rate,
                          updated_at: new Date().toISOString()
                        }, { onConflict: 'year_month' })

                      if (error) {
                        console.error('ラクマ手数料保存エラー:', error)
                        alert('ラクマ手数料の保存に失敗しました。\n\nエラー: ' + error.message)
                      } else {
                        setRakumaCommissionSettings(prev => ({
                          ...prev,
                          [rakumaModalYearMonth]: rate
                        }))
                        setRakumaModalYearMonth('')
                        setRakumaModalRate('')
                      }
                    }}
                    className="px-4 py-2 text-white bg-pink-500 hover:bg-pink-600 rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    追加
                  </button>
                </div>

                {/* 設定一覧 */}
                <div className="space-y-2">
                  {Object.entries(rakumaCommissionSettings)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([yearMonth, rate]) => (
                      <div key={yearMonth} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                        <span className="text-gray-700 font-medium">
                          {yearMonth.replace('-', '年')}月
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-pink-600 font-semibold">{rate}%</span>
                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from('rakuma_commission_settings')
                                .delete()
                                .eq('year_month', yearMonth)

                              if (!error) {
                                setRakumaCommissionSettings(prev => {
                                  const newSettings = { ...prev }
                                  delete newSettings[yearMonth]
                                  return newSettings
                                })
                              }
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  {Object.keys(rakumaCommissionSettings).length === 0 && (
                    <p className="text-center text-gray-500 py-4">設定がありません</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* オークション出品モーダル */}
      {showAuctionExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">オークション出品</h2>
              <button
                onClick={() => setShowAuctionExportModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <p className="mb-4 text-gray-800">
                選択した {selectedIds.size} 件の商品をオークションに出品します。
              </p>

              {/* 選択商品一覧 */}
              <div className="border rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-center text-gray-900 font-semibold w-12">No.</th>
                      <th className="px-3 py-2 text-left text-gray-900 font-semibold">画像</th>
                      <th className="px-3 py-2 text-left text-gray-900 font-semibold">商品名</th>
                      <th className="px-3 py-2 text-right text-gray-900 font-semibold">仕入総額</th>
                      <th className="px-3 py-2 text-right text-gray-900 font-semibold">指値（+1万）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory
                      .filter(item => selectedIds.has(item.id))
                      .map((item, idx) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2 text-center text-gray-900 font-medium">{idx + 1}</td>
                          <td className="px-3 py-2">
                            {(item.saved_image_url || item.image_url) && (
                              <img
                                src={getProxiedImageUrl(item.saved_image_url || item.image_url) || ''}
                                alt=""
                                className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                                onClick={() => setImageModal(getProxiedImageUrl(item.saved_image_url || item.image_url))}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-900">{item.product_name || '-'}</td>
                          <td className="px-3 py-2 text-right text-gray-900">
                            {(item.purchase_total || item.purchase_price) ? `¥${(item.purchase_total || item.purchase_price)!.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-orange-600">
                            {(item.purchase_total || item.purchase_price) ? `¥${((item.purchase_total || item.purchase_price)! + 10000).toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* オークション会社選択 */}
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-3">出品先を選択</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      if (selectedAuctionCompany === 'starbuyers') {
                        setSelectedAuctionCompany(null)
                        setSelectedAuctionCategory(null)
                      } else {
                        setSelectedAuctionCompany('starbuyers')
                        setSelectedAuctionCategory(null)
                      }
                    }}
                    className={`p-3 border-2 rounded-lg transition-colors text-center ${
                      selectedAuctionCompany === 'starbuyers'
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`font-semibold ${selectedAuctionCompany === 'starbuyers' ? 'text-white' : 'text-gray-700'}`}>
                      スターバイヤーズ
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAuctionCompany === 'ecoring') {
                        setSelectedAuctionCompany(null)
                        setSelectedAuctionCategory(null)
                      } else {
                        setSelectedAuctionCompany('ecoring')
                        setSelectedAuctionCategory(null)
                      }
                    }}
                    className={`p-3 border-2 rounded-lg transition-colors text-center ${
                      selectedAuctionCompany === 'ecoring'
                        ? 'border-emerald-700 bg-emerald-600 text-white'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`font-semibold ${selectedAuctionCompany === 'ecoring' ? 'text-white' : 'text-gray-700'}`}>
                      エコリング
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAuctionCompany === 'appre') {
                        setSelectedAuctionCompany(null)
                        setSelectedAuctionCategory(null)
                      } else {
                        setSelectedAuctionCompany('appre')
                        setSelectedAuctionCategory('appre-brand')
                      }
                    }}
                    className={`p-3 border-2 rounded-lg transition-colors text-center ${
                      selectedAuctionCompany === 'appre'
                        ? 'border-orange-600 bg-orange-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`font-semibold ${selectedAuctionCompany === 'appre' ? 'text-white' : 'text-gray-700'}`}>
                      アプレ
                    </div>
                  </button>
                </div>
              </div>

              {/* カテゴリ選択（スターバイヤーズ） */}
              {selectedAuctionCompany === 'starbuyers' && (
                <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-600 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">カテゴリを選択</h4>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      onClick={() => setSelectedAuctionCategory('starbuyers-bag')}
                      className={`p-3 border-2 rounded-lg transition-colors text-center ${
                        selectedAuctionCategory === 'starbuyers-bag'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-blue-300 bg-white hover:border-blue-400'
                      }`}
                    >
                      <div className={`font-medium ${selectedAuctionCategory === 'starbuyers-bag' ? 'text-white' : 'text-blue-700'}`}>
                        バッグ
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedAuctionCategory('starbuyers-accessory')}
                      className={`p-3 border-2 rounded-lg transition-colors text-center ${
                        selectedAuctionCategory === 'starbuyers-accessory'
                          ? 'border-pink-600 bg-pink-600'
                          : 'border-pink-300 bg-white hover:border-pink-400'
                      }`}
                    >
                      <div className={`font-medium ${selectedAuctionCategory === 'starbuyers-accessory' ? 'text-white' : 'text-pink-700'}`}>
                        アクセサリー
                      </div>
                    </button>
                  </div>

                  {/* 詳細設定 */}
                  <div className="pt-3 border-t border-blue-200">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">管理番号に使用するフィールド</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setAuctionManagementField('inventory_number')}
                        className={`p-2 border-2 rounded-lg transition-colors text-center ${
                          auctionManagementField === 'inventory_number'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-blue-300 bg-white hover:border-blue-400'
                        }`}
                      >
                        <div className={`text-sm font-medium ${auctionManagementField === 'inventory_number' ? 'text-white' : 'text-blue-700'}`}>
                          管理番号
                        </div>
                      </button>
                      <button
                        onClick={() => setAuctionManagementField('memo')}
                        className={`p-2 border-2 rounded-lg transition-colors text-center ${
                          auctionManagementField === 'memo'
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-blue-300 bg-white hover:border-blue-400'
                        }`}
                      >
                        <div className={`text-sm font-medium ${auctionManagementField === 'memo' ? 'text-white' : 'text-blue-700'}`}>
                          メモ
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* カテゴリ選択（エコリング） */}
              {selectedAuctionCompany === 'ecoring' && (
                <div className="mb-4 p-4 bg-emerald-50 border-2 border-emerald-600 rounded-lg">
                  <h4 className="font-medium text-emerald-800 mb-3">カテゴリを選択</h4>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      onClick={() => setSelectedAuctionCategory('ecoring-brand')}
                      className={`p-3 border-2 rounded-lg transition-colors text-center ${
                        selectedAuctionCategory === 'ecoring-brand'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-emerald-300 bg-white hover:border-emerald-400'
                      }`}
                    >
                      <div className={`font-medium ${selectedAuctionCategory === 'ecoring-brand' ? 'text-white' : 'text-emerald-700'}`}>
                        ブランド
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedAuctionCategory('ecoring-dougu')}
                      className={`p-3 border-2 rounded-lg transition-colors text-center ${
                        selectedAuctionCategory === 'ecoring-dougu'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-emerald-300 bg-white hover:border-emerald-400'
                      }`}
                    >
                      <div className={`font-medium ${selectedAuctionCategory === 'ecoring-dougu' ? 'text-white' : 'text-emerald-700'}`}>
                        道具
                      </div>
                    </button>
                  </div>

                  {/* 詳細設定 */}
                  <div className="pt-3 border-t border-emerald-200">
                    <h4 className="text-sm font-medium text-emerald-800 mb-2">メモ欄に使用するフィールド</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setAuctionManagementField('inventory_number')}
                        className={`p-2 border-2 rounded-lg transition-colors text-center ${
                          auctionManagementField === 'inventory_number'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-emerald-300 bg-white hover:border-emerald-400'
                        }`}
                      >
                        <div className={`text-sm font-medium ${auctionManagementField === 'inventory_number' ? 'text-white' : 'text-emerald-700'}`}>
                          管理番号
                        </div>
                      </button>
                      <button
                        onClick={() => setAuctionManagementField('memo')}
                        className={`p-2 border-2 rounded-lg transition-colors text-center ${
                          auctionManagementField === 'memo'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-emerald-300 bg-white hover:border-emerald-400'
                        }`}
                      >
                        <div className={`text-sm font-medium ${auctionManagementField === 'memo' ? 'text-white' : 'text-emerald-700'}`}>
                          メモ
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* アプレオークション */}
              {selectedAuctionCompany === 'appre' && (
                <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-600 rounded-lg">
                  <h4 className="font-medium text-orange-800 mb-3">アプレオークション ブランド出品リスト</h4>

                  {/* 詳細設定 */}
                  <div className="pt-3 border-t border-orange-200">
                    <h4 className="text-sm font-medium text-orange-800 mb-2">管理番号に使用するフィールド</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setAuctionManagementField('inventory_number')}
                        className={`p-2 border-2 rounded-lg transition-colors text-center ${
                          auctionManagementField === 'inventory_number'
                            ? 'border-orange-600 bg-orange-600 text-white'
                            : 'border-orange-300 bg-white hover:border-orange-400'
                        }`}
                      >
                        <div className={`text-sm font-medium ${auctionManagementField === 'inventory_number' ? 'text-white' : 'text-orange-700'}`}>
                          管理番号
                        </div>
                      </button>
                      <button
                        onClick={() => setAuctionManagementField('memo')}
                        className={`p-2 border-2 rounded-lg transition-colors text-center ${
                          auctionManagementField === 'memo'
                            ? 'border-orange-600 bg-orange-600 text-white'
                            : 'border-orange-300 bg-white hover:border-orange-400'
                        }`}
                      >
                        <div className={`text-sm font-medium ${auctionManagementField === 'memo' ? 'text-white' : 'text-orange-700'}`}>
                          メモ
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                <p className="text-yellow-800">
                  <span className="font-medium">注意:</span> 指値は仕入値+1万円で自動計算されます。
                  ランクはデフォルトで「B」が設定されます。必要に応じてExcelで編集してください。
                </p>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAuctionExportModal(false)
                  setSelectedAuctionCompany(null)
                  setSelectedAuctionCategory(null)
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                閉じる
              </button>
              <button
                onClick={async () => {
                  if (!selectedAuctionCategory) {
                    alert('カテゴリを選択してください')
                    return
                  }
                  setIsExporting(true)
                  const selectedItems = inventory.filter(item => selectedIds.has(item.id))
                  try {
                    const response = await fetch('/api/auction-export', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        items: selectedItems.map(item => ({
                          id: item.id,
                          brand_name: item.brand_name,
                          product_name: item.product_name,
                          condition_rank: 'B',
                          accessories: '',
                          notes: item.memo,
                          purchase_price: item.purchase_price,
                          purchase_total: item.purchase_total,
                          management_number: auctionManagementField === 'inventory_number'
                            ? item.inventory_number
                            : item.memo,
                        })),
                        auctionType: selectedAuctionCategory
                      }),
                    })
                    if (!response.ok) throw new Error('Export failed')
                    const blob = await response.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${selectedAuctionCategory}_${new Date().toISOString().slice(0, 10)}.xlsx`
                    a.click()
                    URL.revokeObjectURL(url)

                    // 選択した商品の出品日を本日の日付で更新
                    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD形式
                    const selectedItemIds = Array.from(selectedIds)
                    const { error: updateError } = await supabase
                      .from('inventory')
                      .update({ listing_date: today })
                      .in('id', selectedItemIds)

                    if (!updateError) {
                      // ローカルステートも更新
                      setInventory(prev => prev.map(item =>
                        selectedIds.has(item.id) ? { ...item, listing_date: today } : item
                      ))
                    }

                    setShowAuctionExportModal(false)
                    setSelectedAuctionCompany(null)
                    setSelectedAuctionCategory(null)
                  } catch (error) {
                    alert('エクスポートに失敗しました')
                    console.error(error)
                  } finally {
                    setIsExporting(false)
                  }
                }}
                disabled={!selectedAuctionCategory || isExporting}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedAuctionCategory && !isExporting
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isExporting ? '出力中...' : '出力'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 汎用CSVインポートモーダル */}
      {genericImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {genericImportModal.step === 'mapping' && 'カラムマッピング'}
                {genericImportModal.step === 'preview' && 'インポートプレビュー'}
                {genericImportModal.step === 'importing' && 'インポート中...'}
              </h2>
              {genericImportModal.step !== 'importing' && (
                <button
                  onClick={() => setGenericImportModal(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              {genericImportModal.step === 'mapping' && (
                <>
                  {(() => {
                    // マッピングから商品名の列を取得
                    const productNameCol = Object.entries(genericImportModal.mapping).find(([, v]) => v === 'product_name')?.[0]
                    // 商品名に値がある行をカウント
                    const validCount = genericImportModal.csvData.filter(row =>
                      productNameCol && row[productNameCol]?.trim()
                    ).length
                    const totalCount = genericImportModal.csvData.length
                    return (
                      <p className="text-sm text-gray-600 mb-4">
                        スプレッドシートの各列を、アプリのどの項目に入れるか選んでください
                        <br />
                        <span className="font-medium">
                          インポート対象: {validCount}件 / 全{totalCount}行
                          {validCount < totalCount && <span className="text-orange-600">（{totalCount - validCount}行は商品名がないためスキップ）</span>}
                        </span>
                      </p>
                    )
                  })()}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">スプレッドシートの列</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">データ例</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900">ワンポチ在庫の項目</th>
                      </tr>
                    </thead>
                    <tbody>
                      {genericImportModal.csvHeaders.map((header, index) => (
                        <tr key={`header-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-900 font-medium">{header}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">
                            {genericImportModal.csvData[0]?.[header] || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={genericImportModal.mapping[header] || ''}
                              onChange={(e) => {
                                const newMapping = { ...genericImportModal.mapping }
                                if (e.target.value === '') {
                                  delete newMapping[header]
                                } else {
                                  Object.keys(newMapping).forEach(key => {
                                    if (newMapping[key] === e.target.value && key !== header) {
                                      delete newMapping[key]
                                    }
                                  })
                                  newMapping[header] = e.target.value
                                }
                                setGenericImportModal({ ...genericImportModal, mapping: newMapping })
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900"
                            >
                              <option value="">（インポートしない）</option>
                              {GENERIC_IMPORT_COLUMNS.map(col => (
                                <option
                                  key={col.key}
                                  value={col.key}
                                >
                                  {col.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {genericImportModal.step === 'preview' && (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {genericImportModal.csvData.length}件中 最初の5件を表示
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          {GENERIC_IMPORT_COLUMNS.filter(col => Object.values(genericImportModal.mapping).includes(col.key)).map(col => (
                            <th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-900 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {genericImportModal.csvData.slice(0, 5).map((row, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {GENERIC_IMPORT_COLUMNS.filter(col => Object.values(genericImportModal.mapping).includes(col.key)).map(col => {
                              const csvHeader = Object.keys(genericImportModal.mapping).find(k => genericImportModal.mapping[k] === col.key)
                              return (
                                <td key={col.key} className="px-3 py-2 text-gray-900 max-w-[150px] truncate">
                                  {csvHeader ? row[csvHeader] || '-' : '-'}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 rounded text-yellow-800 text-sm">
                    <p className="font-medium mb-1">インポート前の確認:</p>
                    <ul className="list-disc list-inside">
                      <li>全{genericImportModal.csvData.length}件のデータがインポートされます</li>
                      <li>既存データとの重複チェックは行われません</li>
                    </ul>
                  </div>
                </>
              )}

              {genericImportModal.step === 'importing' && (
                <div className="py-8 text-center">
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${genericImportModal.progress}%` }}
                    />
                  </div>
                  <p className="text-gray-600">{genericImportModal.progress}% 完了</p>
                </div>
              )}
            </div>

            {genericImportModal.step !== 'importing' && (
              <div className="p-4 border-t flex justify-between">
                {genericImportModal.step === 'mapping' ? (
                  <>
                    <button
                      onClick={() => setGenericImportModal(null)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => setGenericImportModal({ ...genericImportModal, step: 'preview' })}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      プレビュー →
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setGenericImportModal({ ...genericImportModal, step: 'mapping' })}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      ← マッピングに戻る
                    </button>
                    <button
                      onClick={executeGenericImport}
                      className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      インポート実行
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 固定横スクロールバー */}
      {inventory.length > 0 && (
        <div
          ref={fixedScrollbarRef}
          className="fixed-horizontal-scrollbar"
        >
          <div style={{ width: tableScrollWidth, height: 1 }} />
        </div>
      )}
    </div>
  )
}
