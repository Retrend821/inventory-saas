import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { readFileSync } from 'fs'
// @ts-expect-error xlsx-populate has no types
import XlsxPopulate from 'xlsx-populate'

// テンプレートファイルのパス
const TEMPLATE_DIR = join(process.cwd(), 'public', 'templates')

interface ExportItem {
  id: string
  brand_name?: string
  product_name?: string
  condition_rank?: string
  accessories?: string
  notes?: string
  purchase_price?: number | null
  purchase_total?: number | null
  management_number?: string
}

// 指値計算: 仕入総額 + 1万円（千円単位で切り上げ）
function calculateSashiNe(purchaseTotal: number | null | undefined): number | null {
  if (!purchaseTotal) return null
  return Math.ceil((purchaseTotal + 10000) / 1000) * 1000
}

// 商品名を生成: ブランド名 + 商品名
function getFullProductName(brandName: string, productName: string): string {
  if (brandName && productName) {
    return `${brandName}　${productName}`
  }
  return brandName || productName
}

// スターバイヤーズ バッグ出品リスト生成
async function generateStarbuyersBag(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'starbuyers_bag_template.xlsx')
  const templateBuffer = readFileSync(templatePath)

  const workbook = await XlsxPopulate.fromDataAsync(templateBuffer)
  const sheet = workbook.sheet('出品リスト (バッグ)')

  if (!sheet) {
    throw new Error('シート「出品リスト (バッグ)」が見つかりません')
  }

  // 既存データをクリア（13行目以降）
  for (let row = 13; row <= 212; row++) {
    for (let col = 1; col <= 8; col++) {
      sheet.cell(row, col).value(undefined)
    }
  }

  // 新しいデータを書き込み
  items.forEach((item, i) => {
    const row = 13 + i
    const sashiNe = calculateSashiNe(item.purchase_total)
    const fullProductName = getFullProductName(item.brand_name || '', item.product_name || '')

    sheet.cell(row, 1).value(i + 1)  // No
    sheet.cell(row, 2).value(fullProductName)  // 商品名
    sheet.cell(row, 3).value(item.condition_rank || 'B')  // ランク
    sheet.cell(row, 4).value(item.accessories || '')  // 付属品
    sheet.cell(row, 5).value('')  // 備考（空）
    sheet.cell(row, 6).value(sashiNe)  // 指値
    sheet.cell(row, 7).value('')  // ロット番号
    sheet.cell(row, 8).value(item.management_number || '')  // 管理番号
  })

  return await workbook.outputAsync()
}

// スターバイヤーズ アクセサリー出品リスト生成
async function generateStarbuyersAccessory(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'starbuyers_accessory_template.xlsx')
  const templateBuffer = readFileSync(templatePath)

  const workbook = await XlsxPopulate.fromDataAsync(templateBuffer)

  // 出品リストを含むシートを探す
  let sheet = workbook.sheets().find((s: { name: () => string }) => s.name().includes('出品リスト'))
  if (!sheet) {
    const sheets = workbook.sheets()
    sheet = sheets[sheets.length - 1]
  }

  // 既存データをクリア（13行目以降）
  for (let row = 13; row <= 212; row++) {
    for (let col = 1; col <= 8; col++) {
      sheet.cell(row, col).value(undefined)
    }
  }

  // 新しいデータを書き込み
  items.forEach((item, i) => {
    const row = 13 + i
    const sashiNe = calculateSashiNe(item.purchase_total)
    const fullProductName = getFullProductName(item.brand_name || '', item.product_name || '')

    sheet.cell(row, 1).value(i + 1)
    sheet.cell(row, 2).value(fullProductName)
    sheet.cell(row, 3).value(item.condition_rank || 'B')
    sheet.cell(row, 4).value(item.accessories || '')
    sheet.cell(row, 5).value('')
    sheet.cell(row, 6).value(sashiNe)
    sheet.cell(row, 7).value('')
    sheet.cell(row, 8).value(item.management_number || '')
  })

  return await workbook.outputAsync()
}

// 日付を「YYYY年MM月DD日」形式に変換
function formatJapaneseDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
}

// エコリング ブランド出品リスト生成
async function generateEcoringBrand(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'ecoring_brand_template.xlsx')
  const templateBuffer = readFileSync(templatePath)

  const workbook = await XlsxPopulate.fromDataAsync(templateBuffer)
  const sheet = workbook.sheet('委託者入力シート')

  if (!sheet) {
    throw new Error('シート「委託者入力シート」が見つかりません')
  }

  // C9に出力時点の日付を設定
  sheet.cell('C9').value(formatJapaneseDate(new Date()))

  // 新しいデータを書き込み（16行目から）
  items.forEach((item, i) => {
    const row = 16 + i
    const sashiNe = calculateSashiNe(item.purchase_total)
    const fullProductName = getFullProductName(item.brand_name || '', item.product_name || '')

    // 値を設定し、スタイルをリセット（斜体・取り消し線をオフ）
    sheet.cell(row, 1).value(i + 1).style({ italic: false, strikethrough: false })
    sheet.cell(row, 2).value(fullProductName).style({ italic: false, strikethrough: false })
    sheet.cell(row, 3).value(sashiNe).style({ italic: false, strikethrough: false })
    sheet.cell(row, 4).value('').style({ italic: false, strikethrough: false })
    sheet.cell(row, 5).value(item.management_number || '').style({ italic: false, strikethrough: false })
  })

  return await workbook.outputAsync()
}

// エコリング 道具出品リスト生成
async function generateEcoringDougu(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'ecoring_dougu_template.xlsx')
  const templateBuffer = readFileSync(templatePath)

  const workbook = await XlsxPopulate.fromDataAsync(templateBuffer)
  const sheet = workbook.sheet('委託者入力シート')

  if (!sheet) {
    throw new Error('シート「委託者入力シート」が見つかりません')
  }

  // C9に出力時点の日付を設定
  sheet.cell('C9').value(formatJapaneseDate(new Date()))

  // 新しいデータを書き込み（16行目から）
  items.forEach((item, i) => {
    const row = 16 + i
    const sashiNe = calculateSashiNe(item.purchase_total)
    const fullProductName = getFullProductName(item.brand_name || '', item.product_name || '')

    // 値を設定し、スタイルをリセット（斜体・取り消し線をオフ）
    sheet.cell(row, 1).value(i + 1).style({ italic: false, strikethrough: false })
    sheet.cell(row, 2).value(fullProductName).style({ italic: false, strikethrough: false })
    sheet.cell(row, 3).value(sashiNe).style({ italic: false, strikethrough: false })
    sheet.cell(row, 4).value('').style({ italic: false, strikethrough: false })
    sheet.cell(row, 5).value(item.management_number || '').style({ italic: false, strikethrough: false })
  })

  return await workbook.outputAsync()
}

// アプレ ブランド出品リスト生成
async function generateAppreBrand(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'appre_brand_template.xlsm')
  const templateBuffer = readFileSync(templatePath)

  const workbook = await XlsxPopulate.fromDataAsync(templateBuffer)
  const sheet = workbook.sheet('入力欄')

  if (!sheet) {
    throw new Error('シート「入力欄」が見つかりません')
  }

  // 新しいデータを書き込み（6行目から）
  items.forEach((item, i) => {
    const row = 6 + i
    const sashiNe = calculateSashiNe(item.purchase_total)

    sheet.cell(row, 5).value(item.brand_name || '')  // ブランド名（E列）
    sheet.cell(row, 7).value(item.product_name || '')  // 商品名（G列）
    sheet.cell(row, 11).value(item.condition_rank || 'B')  // ランク（K列）
    sheet.cell(row, 12).value('')  // 付属品・備考（L列）
    sheet.cell(row, 14).value(sashiNe)  // 指値（税抜）（N列）
    sheet.cell(row, 20).value(item.management_number || '')  // 管理番号（T列）
  })

  return await workbook.outputAsync()
}

// オークション出品リスト生成
export async function POST(request: NextRequest) {
  try {
    const { items, auctionType = 'starbuyers-bag' } = await request.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // アイテムデータを整形
    const exportItems: ExportItem[] = items.map((item: ExportItem) => ({
      id: item.id,
      brand_name: item.brand_name || '',
      product_name: item.product_name || '',
      condition_rank: item.condition_rank || 'B',
      accessories: item.accessories || '',
      notes: item.notes || '',
      purchase_price: item.purchase_price || null,
      purchase_total: item.purchase_total || null,
      management_number: item.management_number || '',
    }))

    let fileBuffer: Buffer
    let downloadFileName: string
    const dateStr = new Date().toISOString().slice(0, 10)

    switch (auctionType) {
      case 'starbuyers-bag':
        fileBuffer = await generateStarbuyersBag(exportItems)
        downloadFileName = `starbuyers_bag_${dateStr}.xlsx`
        break
      case 'starbuyers-accessory':
        fileBuffer = await generateStarbuyersAccessory(exportItems)
        downloadFileName = `starbuyers_accessory_${dateStr}.xlsx`
        break
      case 'ecoring-brand':
        fileBuffer = await generateEcoringBrand(exportItems)
        downloadFileName = `ecoring_brand_${dateStr}.xlsx`
        break
      case 'ecoring-dougu':
        fileBuffer = await generateEcoringDougu(exportItems)
        downloadFileName = `ecoring_dougu_${dateStr}.xlsx`
        break
      case 'appre-brand':
        fileBuffer = await generateAppreBrand(exportItems)
        downloadFileName = `appre_brand_${dateStr}.xlsm`
        break
      default:
        return NextResponse.json({ error: `Unknown auction type: ${auctionType}` }, { status: 400 })
    }

    // レスポンスを返す
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
      },
    })
  } catch (error) {
    console.error('Auction export error:', error)
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
