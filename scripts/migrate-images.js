const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jewlanqflurcqremanty.supabase.co';
const supabaseServiceKey = 'sb_secret_4kInp86cy2TiknxY0acbcQ_Rxx3KfDJ';
const BUCKET_NAME = 'inventory-images';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateImages() {
  console.log('Fetching inventory...');

  // 全在庫を取得
  let allItems = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, image_url, saved_image_url')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Fetch error:', error);
      break;
    }

    if (data && data.length > 0) {
      allItems = [...allItems, ...data];
      from += pageSize;
      if (data.length < pageSize) break;
    } else {
      break;
    }
  }

  console.log('Total items:', allItems.length);

  // 移行が必要なアイテムを抽出
  const needsMigration = allItems.filter(item => {
    const url = item.saved_image_url || item.image_url;
    if (!url) return false;
    if (url.includes('supabase.co/storage')) return false;
    if (url.startsWith('data:')) return false;
    if (url.includes('googleusercontent.com')) return false;
    return true;
  });

  console.log('Needs migration:', needsMigration.length);

  if (needsMigration.length === 0) {
    console.log('No images to migrate!');
    return;
  }

  let success = 0;
  let failed = 0;

  // 1件ずつ処理
  for (let i = 0; i < needsMigration.length; i++) {
    const item = needsMigration[i];
    const imageUrl = item.saved_image_url || item.image_url;

    try {
      // Referer設定
      let referer = 'https://auctions.yahoo.co.jp/';
      if (imageUrl.includes('ecoauc.com')) {
        referer = 'https://ecoauc.com/';
      } else if (imageUrl.includes('nanboya.com') || imageUrl.includes('starbuyers')) {
        referer = 'https://www.starbuyers-global-auction.com/';
      } else if (imageUrl.includes('2ndstreet.jp')) {
        referer = 'https://www.2ndstreet.jp/';
      } else if (imageUrl.includes('trefac.jp')) {
        referer = 'https://www.trefac.jp/';
      } else if (imageUrl.includes('mekiki.ai')) {
        referer = 'https://monobank.jp/';
      }

      // 画像取得
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': referer,
          'Accept': 'image/*',
        },
      });

      if (!response.ok) {
        console.log(`[${i+1}/${needsMigration.length}] Failed to fetch: ${item.id}`);
        failed++;
        continue;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const imageBuffer = await response.arrayBuffer();

      // 拡張子決定
      let ext = 'jpg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('gif')) ext = 'gif';
      else if (contentType.includes('webp')) ext = 'webp';

      const fileName = `${item.id}_${Date.now()}.${ext}`;

      // Supabase Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, imageBuffer, {
          contentType,
          upsert: true
        });

      if (uploadError) {
        console.log(`[${i+1}/${needsMigration.length}] Upload error: ${item.id}`, uploadError.message);
        failed++;
        continue;
      }

      // 公開URL取得
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      // DB更新
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ saved_image_url: publicUrlData.publicUrl })
        .eq('id', item.id);

      if (updateError) {
        console.log(`[${i+1}/${needsMigration.length}] DB update error: ${item.id}`);
        failed++;
        continue;
      }

      success++;
      console.log(`[${i+1}/${needsMigration.length}] OK: ${item.id}`);

      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      console.log(`[${i+1}/${needsMigration.length}] Error: ${item.id}`, err.message);
      failed++;
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log('Success:', success);
  console.log('Failed:', failed);
}

migrateImages();
