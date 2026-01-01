import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

// テンプレートファイルのパス
const TEMPLATE_DIR = join(process.cwd(), 'public', 'templates')
const SCRIPTS_DIR = join(process.cwd(), 'scripts')
const TMP_DIR = join(process.cwd(), 'tmp')

// スターバイヤーズ出品リスト生成
export async function POST(request: NextRequest) {
  try {
    const { items, auctionType = 'starbuyers-bag' } = await request.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // tmpディレクトリを作成
    if (!existsSync(TMP_DIR)) {
      mkdirSync(TMP_DIR, { recursive: true })
    }

    // 一時ファイルパス
    const outputFileName = `${auctionType}_${randomUUID()}.xlsx`
    const outputPath = join(TMP_DIR, outputFileName)

    // Pythonスクリプトを実行
    const inputData = JSON.stringify({
      items: items.map((item: {
        id: string
        brand_name?: string
        product_name?: string
        condition_rank?: string
        accessories?: string
        notes?: string
        purchase_price?: number
        purchase_total?: number
        management_number?: string
      }) => ({
        id: item.id,
        brand_name: item.brand_name || '',
        product_name: item.product_name || '',
        condition_rank: item.condition_rank || 'B',
        accessories: item.accessories || '',
        notes: item.notes || '',
        purchase_price: item.purchase_price || null,
        purchase_total: item.purchase_total || null,
        management_number: item.management_number || '',
      })),
      auctionType,
      templateDir: TEMPLATE_DIR,
      outputPath,
    })

    const scriptPath = join(SCRIPTS_DIR, 'generate_auction_excel.py')

    try {
      const result = execSync(`python3 "${scriptPath}" '${inputData.replace(/'/g, "'\\''")}'`, {
        encoding: 'utf-8',
        timeout: 90000,  // xlwingsはExcel起動に時間がかかるため90秒
      })

      const resultData = JSON.parse(result.trim())
      if (resultData.error) {
        throw new Error(resultData.error)
      }
    } catch (execError) {
      console.error('Python script error:', execError)
      throw new Error('Failed to generate Excel file')
    }

    // 生成されたファイルを読み込み
    const fileBuffer = readFileSync(outputPath)

    // 一時ファイルを削除
    try {
      unlinkSync(outputPath)
    } catch {
      // 削除失敗しても続行
    }

    // ファイル名を決定
    const dateStr = new Date().toISOString().slice(0, 10)
    let downloadFileName = ''
    if (auctionType === 'starbuyers-bag') {
      downloadFileName = `starbuyers_bag_${dateStr}.xlsx`
    } else if (auctionType === 'starbuyers-accessory') {
      downloadFileName = `starbuyers_accessory_${dateStr}.xlsx`
    } else if (auctionType === 'ecoring-brand') {
      downloadFileName = `ecoring_brand_${dateStr}.xlsx`
    } else if (auctionType === 'ecoring-dougu') {
      downloadFileName = `ecoring_dougu_${dateStr}.xlsx`
    } else if (auctionType === 'appre-brand') {
      downloadFileName = `appre_brand_${dateStr}.xlsm`
    } else {
      downloadFileName = `auction_${dateStr}.xlsx`
    }

    // レスポンスを返す
    return new NextResponse(fileBuffer, {
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
