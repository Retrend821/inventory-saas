import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import path from 'path'

type AuctionItem = {
  id: string
  brand_name?: string
  product_name?: string
  condition_rank?: string
  accessories?: string
  notes?: string
  purchase_price?: number
  management_number?: string
}

// スターバイヤーズ バッグ出品リストを生成
async function generateStarbuyersBag(items: AuctionItem[], templatePath: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  const worksheet = workbook.getWorksheet('出品リスト (バッグ)')
  if (!worksheet) {
    throw new Error('Sheet "出品リスト (バッグ)" not found')
  }

  // 既存データをクリア（13行目以降）
  for (let row = 13; row <= 200; row++) {
    for (let col = 1; col <= 8; col++) {
      const cell = worksheet.getCell(row, col)
      cell.value = null
    }
  }

  // 新しいデータを書き込み
  items.forEach((item, i) => {
    const row = 13 + i
    const sashiNe = item.purchase_price ? item.purchase_price + 10000 : null

    // 商品名 = ブランド名 + 商品名
    let fullProductName = ''
    if (item.brand_name && item.product_name) {
      fullProductName = `${item.brand_name}　${item.product_name}`
    } else if (item.brand_name) {
      fullProductName = item.brand_name
    } else {
      fullProductName = item.product_name || ''
    }

    worksheet.getCell(row, 1).value = i + 1  // No
    worksheet.getCell(row, 2).value = fullProductName  // 商品名
    worksheet.getCell(row, 3).value = item.condition_rank || 'B'  // ランク
    worksheet.getCell(row, 4).value = item.accessories || ''  // 付属品
    worksheet.getCell(row, 5).value = item.notes || ''  // 備考
    worksheet.getCell(row, 6).value = sashiNe  // 指値
    worksheet.getCell(row, 7).value = ''  // ロット番号
    worksheet.getCell(row, 8).value = item.management_number || ''  // 管理番号
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// スターバイヤーズ アクセサリー出品リストを生成
async function generateStarbuyersAccessory(items: AuctionItem[], templatePath: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  // シートを探す
  let worksheet = null
  for (const ws of workbook.worksheets) {
    if (ws.name.includes('出品リスト')) {
      worksheet = ws
      break
    }
  }
  if (!worksheet) {
    worksheet = workbook.worksheets[workbook.worksheets.length - 1]
  }

  // 既存データをクリア（13行目以降）
  for (let row = 13; row <= 200; row++) {
    for (let col = 1; col <= 8; col++) {
      const cell = worksheet.getCell(row, col)
      cell.value = null
    }
  }

  // 新しいデータを書き込み
  items.forEach((item, i) => {
    const row = 13 + i
    const sashiNe = item.purchase_price ? item.purchase_price + 10000 : null

    let fullProductName = ''
    if (item.brand_name && item.product_name) {
      fullProductName = `${item.brand_name}　${item.product_name}`
    } else if (item.brand_name) {
      fullProductName = item.brand_name
    } else {
      fullProductName = item.product_name || ''
    }

    worksheet.getCell(row, 1).value = i + 1
    worksheet.getCell(row, 2).value = fullProductName
    worksheet.getCell(row, 3).value = item.condition_rank || 'B'
    worksheet.getCell(row, 4).value = item.accessories || ''
    worksheet.getCell(row, 5).value = item.notes || ''
    worksheet.getCell(row, 6).value = sashiNe
    worksheet.getCell(row, 7).value = ''
    worksheet.getCell(row, 8).value = item.management_number || ''
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// エコリング ブランド/道具出品リストを生成
async function generateEcoring(items: AuctionItem[], templatePath: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  const worksheet = workbook.getWorksheet('委託者入力シート')
  if (!worksheet) {
    throw new Error('Sheet "委託者入力シート" not found')
  }

  // 新しいデータを書き込み（16行目から）
  items.forEach((item, i) => {
    const row = 16 + i
    const sashiNe = item.purchase_price ? item.purchase_price + 10000 : null

    let fullProductName = ''
    if (item.brand_name && item.product_name) {
      fullProductName = `${item.brand_name} ${item.product_name}`
    } else if (item.brand_name) {
      fullProductName = item.brand_name
    } else {
      fullProductName = item.product_name || ''
    }

    worksheet.getCell(row, 1).value = i + 1  // 商品NO (A)
    worksheet.getCell(row, 2).value = fullProductName  // 商品名 (B)
    worksheet.getCell(row, 3).value = sashiNe  // 指値 (C)
    worksheet.getCell(row, 4).value = item.notes || ''  // ダメージ・備考 (D)
    worksheet.getCell(row, 5).value = item.management_number || ''  // メモ欄 (E)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// アプレオークション ブランド出品リストを生成
async function generateAppreBrand(items: AuctionItem[], templatePath: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  const worksheet = workbook.getWorksheet('入力欄')
  if (!worksheet) {
    throw new Error('Sheet "入力欄" not found')
  }

  // 新しいデータを書き込み（6行目から）
  items.forEach((item, i) => {
    const row = 6 + i
    const sashiNe = item.purchase_price ? item.purchase_price + 10000 : null

    worksheet.getCell(row, 5).value = item.brand_name || ''  // ブランド名 (E)
    worksheet.getCell(row, 7).value = item.product_name || ''  // 商品名 (G)
    worksheet.getCell(row, 11).value = item.condition_rank || 'B'  // ランク (K)
    worksheet.getCell(row, 12).value = item.accessories || ''  // 付属品・備考 (L)
    worksheet.getCell(row, 14).value = sashiNe  // 指値（税抜）(N)
    worksheet.getCell(row, 20).value = item.management_number || ''  // 管理番号 (T)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function POST(request: NextRequest) {
  try {
    const { items, auctionType = 'starbuyers-bag' } = await request.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // テンプレートディレクトリ
    const templateDir = path.join(process.cwd(), 'public', 'templates')

    let buffer: Buffer
    let downloadFileName: string
    const dateStr = new Date().toISOString().slice(0, 10)

    if (auctionType === 'starbuyers-bag') {
      const templatePath = path.join(templateDir, 'starbuyers_bag_template.xlsx')
      buffer = await generateStarbuyersBag(items, templatePath)
      downloadFileName = `starbuyers_bag_${dateStr}.xlsx`
    } else if (auctionType === 'starbuyers-accessory') {
      const templatePath = path.join(templateDir, 'starbuyers_accessory_template.xlsx')
      buffer = await generateStarbuyersAccessory(items, templatePath)
      downloadFileName = `starbuyers_accessory_${dateStr}.xlsx`
    } else if (auctionType === 'ecoring-brand') {
      const templatePath = path.join(templateDir, 'ecoring_brand_template.xlsx')
      buffer = await generateEcoring(items, templatePath)
      downloadFileName = `ecoring_brand_${dateStr}.xlsx`
    } else if (auctionType === 'ecoring-dougu') {
      const templatePath = path.join(templateDir, 'ecoring_dougu_template.xlsx')
      buffer = await generateEcoring(items, templatePath)
      downloadFileName = `ecoring_dougu_${dateStr}.xlsx`
    } else if (auctionType === 'appre-brand') {
      const templatePath = path.join(templateDir, 'appre_brand_template.xlsm')
      buffer = await generateAppreBrand(items, templatePath)
      downloadFileName = `appre_brand_${dateStr}.xlsm`
    } else {
      return NextResponse.json({ error: `Unknown auction type: ${auctionType}` }, { status: 400 })
    }

    // レスポンスを返す
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
      },
    })
  } catch (error) {
    console.error('Auction export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
