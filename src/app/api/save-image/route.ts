import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, inventoryId } = await request.json()

    if (!imageUrl || !inventoryId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // すでにGoogleドライブのURLの場合はスキップ
    if (imageUrl.includes('drive.google.com') || imageUrl.includes('googleusercontent.com')) {
      // すでにGoogleドライブのURLなので、そのままsaved_image_urlに保存
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ saved_image_url: imageUrl })
        .eq('id', inventoryId)

      if (updateError) {
        console.error('Update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, savedUrl: imageUrl, skipped: true })
    }

    // Googleドライブ連携を確認
    const accessToken = request.cookies.get('google_access_token')?.value

    if (!accessToken) {
      // Googleドライブ未連携の場合は画像保存をスキップ
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'google_drive_not_connected'
      })
    }

    // Googleドライブにアップロード
    try {
      const savedUrl = await uploadToGoogleDrive(imageUrl, inventoryId, accessToken)

      // DBの saved_image_url を更新
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ saved_image_url: savedUrl })
        .eq('id', inventoryId)

      if (updateError) {
        console.error('Update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, savedUrl, storage: 'google-drive' })
    } catch (driveError) {
      console.error('Google Drive upload failed:', driveError)
      return NextResponse.json({
        success: false,
        error: 'Google Drive upload failed',
        skipped: true
      })
    }
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function uploadToGoogleDrive(imageUrl: string, inventoryId: string, accessToken: string): Promise<string> {
  // 画像URLに応じたRefererを設定
  let referer = 'https://auctions.yahoo.co.jp/'
  if (imageUrl.includes('ecoauc.com')) {
    referer = 'https://ecoauc.com/'
  } else if (imageUrl.includes('nanboya.com')) {
    referer = 'https://www.starbuyers-global-auction.com/'
  } else if (imageUrl.includes('2ndstreet.jp')) {
    referer = 'https://www.2ndstreet.jp/'
  } else if (imageUrl.includes('trefac.jp')) {
    referer = 'https://www.trefac.jp/'
  } else if (imageUrl.includes('mekiki.ai')) {
    referer = 'https://monobank.jp/'
  }

  // 外部画像を取得
  const imageResponse = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': referer,
    },
  })

  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`)
  }

  const imageBlob = await imageResponse.blob()
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const fileName = `${inventoryId}.${extension}`

  // フォルダを作成または取得
  const folderId = await getOrCreateFolder(accessToken, 'ワンポチ在庫_画像')

  // 画像をGoogleドライブにアップロード
  const metadata = {
    name: fileName,
    parents: [folderId],
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', imageBlob)

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: form,
    }
  )

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json()
    console.error('Drive upload error:', errorData)
    throw new Error('Failed to upload to Google Drive')
  }

  const fileData = await uploadResponse.json()

  // ファイルを公開設定にする
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  })

  // 公開URLを返す
  return `https://drive.google.com/uc?export=view&id=${fileData.id}`
}

async function getOrCreateFolder(accessToken: string, folderName: string): Promise<string> {
  // 既存のフォルダを検索
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  const searchData = await searchResponse.json()

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id
  }

  // フォルダが存在しない場合は作成
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })

  const createData = await createResponse.json()
  return createData.id
}
