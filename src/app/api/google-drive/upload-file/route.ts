import { NextRequest, NextResponse } from 'next/server'

// リフレッシュトークンを使ってアクセストークンを更新
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const data = await response.json()
    if (data.error) {
      console.error('Token refresh error:', data)
      return null
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    let accessToken = request.cookies.get('google_access_token')?.value
    const refreshToken = request.cookies.get('google_refresh_token')?.value
    let newAccessToken: { access_token: string; expires_in: number } | null = null

    // アクセストークンがない場合、リフレッシュトークンで更新を試みる
    if (!accessToken && refreshToken) {
      newAccessToken = await refreshAccessToken(refreshToken)
      if (newAccessToken) {
        accessToken = newAccessToken.access_token
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated with Google' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileName = formData.get('fileName') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Googleドライブにフォルダを作成または取得
    const folderId = await getOrCreateFolder(accessToken, 'ワンポチ在庫_画像')

    // 画像をGoogleドライブにアップロード
    const metadata = {
      name: fileName || `image_${Date.now()}.jpg`,
      parents: [folderId],
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', file)

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
      return NextResponse.json({ error: 'Failed to upload to Google Drive' }, { status: 500 })
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
    const publicUrl = `https://drive.google.com/uc?export=view&id=${fileData.id}`

    const response = NextResponse.json({
      success: true,
      fileId: fileData.id,
      url: publicUrl,
    })

    // 新しいアクセストークンを取得した場合はクッキーを更新
    if (newAccessToken) {
      response.cookies.set('google_access_token', newAccessToken.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: newAccessToken.expires_in,
      })
    }

    return response
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
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
