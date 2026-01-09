import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { join } from 'path'
import { readFileSync } from 'fs'

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

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(new Uint8Array(templateBuffer).buffer)

  const worksheet = workbook.getWorksheet('出品リスト (バッグ)')
  if (!worksheet) {
    throw new Error('シート「出品リスト (バッグ)」が見つかりません')
  }

  // 既存データをクリア（13行目以降）
  for (let row = 13; row <= Math.max(worksheet.rowCount, 200); row++) {
    for (let col = 1; col <= 8; col++) {
      const cell = worksheet.getCell(row, col)
      cell.value = null
    }
  }

  // 新しいデータを書き込み
  items.forEach((item, i) => {
    const row = 13 + i
    const sashiNe = calculateSashiNe(item.purchase_total)
    const fullProductName = getFullProductName(item.brand_name || '', item.product_name || '')

    worksheet.getCell(row, 1).value = i + 1  // No
    worksheet.getCell(row, 2).value = fullProductName  // 商品名
    worksheet.getCell(row, 3).value = item.condition_rank || 'B'  // ランク
    worksheet.getCell(row, 4).value = item.accessories || ''  // 付属品
    worksheet.getCell(row, 5).value = ''  // 備考（空）
    worksheet.getCell(row, 6).value = sashiNe  // 指値
    worksheet.getCell(row, 7).value = ''  // ロット番号
    worksheet.getCell(row, 8).value = item.management_number || ''  // 管理番号
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// スターバイヤーズ アクセサリー出品リスト生成
async function generateStarbuyersAccessory(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'starbuyers_accessory_template.xlsx')
  const templateBuffer = readFileSync(templatePath)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(new Uint8Array(templateBuffer).buffer)

  // 出品リストを含むシートを探す
  let worksheet = workbook.worksheets.find(ws => ws.name.includes('出品リスト'))
  if (!worksheet) {
    worksheet = workbook.worksheets[workbook.worksheets.length - 1]
  }
  if (!worksheet) {
    throw new Error('出品リストシートが見つかりません')
  }

  // 既存データをクリア（13行目以降）
  for (let row = 13; row <= Math.max(worksheet.rowCount, 200); row++) {
    for (let col = 1; col <= 8; col++) {
      const cell = worksheet.getCell(row, col)
      cell.value = null
    }
  }

  // 新しいデータを書き込み
  items.forEach((item, i) => {
    const row = 13 + i
    const sashiNe = calculateSashiNe(item.purchase_total)
    const fullProductName = getFullProductName(item.brand_name || '', item.product_name || '')

    worksheet.getCell(row, 1).value = i + 1
    worksheet.getCell(row, 2).value = fullProductName
    worksheet.getCell(row, 3).value = item.condition_rank || 'B'
    worksheet.getCell(row, 4).value = item.accessories || ''
    worksheet.getCell(row, 5).value = ''  // 備考（空）
    worksheet.getCell(row, 6).value = sashiNe
    worksheet.getCell(row, 7).value = ''
    worksheet.getCell(row, 8).value = item.management_number || ''
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// エコリング ブランド出品リスト生成
async function generateEcoringBrand(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'ecoring_brand_template.xlsx')
  const templateBuffer = readFileSync(templatePath)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(new Uint8Array(templateBuffer).buffer)

  const worksheet = workbook.getWorksheet('委託者入力シート')
  if (!worksheet) {
    throw new Error('シート「委託者入力シート」が見つかりません')
  }

  // 新しいデータを書き込み（16行目から）
  items.forEach((item, i) => {
    const row = 16 + i
    const sashiNe = calculateSashiNe(item.purchase_total)
    const fullProductName = getFullProductName(item.brand_name || '', item.product_name || '')

    worksheet.getCell(row, 1).value = i + 1  // 商品NO
    worksheet.getCell(row, 2).value = fullProductName  // 商品名
    worksheet.getCell(row, 3).value = sashiNe  // 指値
    worksheet.getCell(row, 4).value = ''  // ダメージ・備考（空）
    worksheet.getCell(row, 5).value = item.management_number || ''  // メモ欄
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// エコリング 道具出品リスト生成
async function generateEcoringDougu(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'ecoring_dougu_template.xlsx')
  const templateBuffer = readFileSync(templatePath)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(new Uint8Array(templateBuffer).buffer)

  const worksheet = workbook.getWorksheet('委託者入力シート')
  if (!worksheet) {
    throw new Error('シート「委託者入力シート」が見つかりません')
  }

  // 新しいデータを書き込み（16行目から）
  items.forEach((item, i) => {
    const row = 16 + i
    const sashiNe = calculateSashiNe(item.purchase_total)
    const fullProductName = getFullProductName(item.brand_name || '', item.product_name || '')

    worksheet.getCell(row, 1).value = i + 1  // 商品NO
    worksheet.getCell(row, 2).value = fullProductName  // 商品名
    worksheet.getCell(row, 3).value = sashiNe  // 指値
    worksheet.getCell(row, 4).value = ''  // ダメージ・備考（空）
    worksheet.getCell(row, 5).value = item.management_number || ''  // メモ欄
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// アプレ ブランド出品リスト生成
async function generateAppreBrand(items: ExportItem[]): Promise<Buffer> {
  const templatePath = join(TEMPLATE_DIR, 'appre_brand_template.xlsm')
  const templateBuffer = readFileSync(templatePath)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(new Uint8Array(templateBuffer).buffer)

  const worksheet = workbook.getWorksheet('入力欄')
  if (!worksheet) {
    throw new Error('シート「入力欄」が見つかりません')
  }

  // 新しいデータを書き込み（6行目から）
  items.forEach((item, i) => {
    const row = 6 + i
    const sashiNe = calculateSashiNe(item.purchase_total)

    worksheet.getCell(row, 5).value = item.brand_name || ''  // ブランド名（E列）
    worksheet.getCell(row, 7).value = item.product_name || ''  // 商品名（G列）
    worksheet.getCell(row, 11).value = item.condition_rank || 'B'  // ランク（K列）
    worksheet.getCell(row, 12).value = ''  // 付属品・備考（L列）
    worksheet.getCell(row, 14).value = sashiNe  // 指値（税抜）（N列）
    worksheet.getCell(row, 20).value = item.management_number || ''  // 管理番号（T列）
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// スターバイヤーズ出品リスト生成
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
