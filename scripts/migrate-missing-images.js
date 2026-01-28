const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET_NAME = 'inventory-images';

async function uploadImage(imageUrl, inventoryId) {
  try {
    // プロキシ経由で取得（2ndstreet, trefac等はCORS制限あり）
    let fetchUrl = imageUrl;
    let headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    if (imageUrl.includes('2ndstreet.jp') || imageUrl.includes('trefac.jp')) {
      fetchUrl = 'https://images.weserv.nl/?url=' + encodeURIComponent(imageUrl);
      headers = {};
    } else if (imageUrl.includes('ecoauc.com')) {
      headers['Referer'] = 'https://ecoauc.com/';
    }

    const response = await fetch(fetchUrl, { headers });
    if (!response.ok) {
      console.log('  画像取得失敗:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await response.arrayBuffer();

    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';

    const fileName = inventoryId + '_' + Date.now() + '.' + ext;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, imageBuffer, { contentType, upsert: true });

    if (error) {
      console.log('  アップロード失敗:', error.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e) {
    console.log('  エラー:', e.message);
    return null;
  }
}

async function migrateImages() {
  const { data: items, error } = await supabase
    .from('inventory')
    .select('id, inventory_number, image_url')
    .is('saved_image_url', null)
    .not('image_url', 'is', null)
    .not('image_url', 'ilike', '%supabase.co%')
    .not('image_url', 'ilike', '%drive.google.com%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('移行対象:', items.length, '件');

  for (const item of items) {
    console.log('処理中:', item.inventory_number);
    const savedUrl = await uploadImage(item.image_url, item.id);

    if (savedUrl) {
      await supabase
        .from('inventory')
        .update({ saved_image_url: savedUrl })
        .eq('id', item.id);
      console.log('  → 完了:', savedUrl.substring(0, 60) + '...');
    }
  }

  console.log('移行完了');
}

migrateImages();
