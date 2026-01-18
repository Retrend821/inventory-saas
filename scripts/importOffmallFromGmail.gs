/**
 * オフモール（HARDOFFオフモール）Gmail自動インポート
 *
 * ★★★ 使い方 ★★★
 * 1. Google Apps Script で新規プロジェクトを作成
 * 2. このコードをコピペ
 * 3. API_ENDPOINT と IMAGE_FOLDER_ID を設定
 * 4. トリガーを設定（例：1時間おき）
 *
 * 処理フロー:
 * 1. Gmailから「【HARDOFFオフモール】ご注文内容確認書」を検索
 * 2. メール本文から商品名、価格、商品URLを抽出
 * 3. 商品ページから画像URLを取得
 * 4. Google Driveに画像を保存
 * 5. inventory-saas APIを呼び出してDBに登録
 */

// === 設定 ===
const API_ENDPOINT = 'https://inventory-saas.vercel.app/api/inventory/import'; // 本番URL
// const API_ENDPOINT = 'http://localhost:3000/api/inventory/import'; // ローカル開発用

const IMAGE_FOLDER_ID = '1947cXO_ejvzTPWgfKpoe5ju0JhtA3b-r'; // Google Drive画像保存先フォルダID
const PROCESSED_LABEL = 'processed/オフモール';
const MAX_THREADS = 10;

// === ブランド辞書 ===
const BRAND_DICT = {
  "シャネル": ["CHANEL", "シャネル"],
  "ルイヴィトン": ["LOUIS VUITTON", "ルイヴィトン", "ヴィトン"],
  "エルメス": ["HERMES", "エルメス"],
  "グッチ": ["GUCCI", "グッチ"],
  "プラダ": ["PRADA", "プラダ"],
  "フェンディ": ["FENDI", "フェンディ"],
  "ディオール": ["DIOR", "ディオール"],
  "セリーヌ": ["CELINE", "セリーヌ"],
  "コーチ": ["COACH", "コーチ"],
  "イブサンローラン": ["YSL", "イヴサンローラン", "サンローラン"],
  "バーバリー": ["BURBERRY", "バーバリー"],
  "ブルガリ": ["BVLGARI", "ブルガリ"],
  "バレンシアガ": ["BALENCIAGA", "バレンシアガ"],
  "ロエベ": ["LOEWE", "ロエベ"],
  "ルブタン": ["LOUBOUTIN", "ルブタン", "クリスチャンルブタン"],
  "ボッテガヴェネタ": ["BOTTEGA VENETA", "ボッテガ"],
  "ベルルッティ": ["BERLUTI", "ベルルッティ"],
  "レイバン": ["Ray-Ban", "RAYBAN", "Rayban", "レイバン"],
  "フェラガモ": ["FERRAGAMO", "SALVATORE FERRAGAMO"],
  "カルティエ": ["CARTIER", "カルティエ"],
  "ダンヒル": ["DUNHILL", "ダンヒル"]
};

// === カテゴリキーワード ===
const CATEGORY_KEYWORDS = {
  "カメラ": ["カメラ", "デジカメ", "一眼", "ミラーレス", "レンズ", "canon", "nikon", "sony", "fujifilm", "olympus", "pentax", "leica"],
  "ネクタイ": ["ネクタイ"],
  "バッグ": ["バッグ", "bag", "トート", "ショルダー", "クラッチ", "ハンドバッグ", "リュック", "バックパック", "ボストン", "ブリーフケース", "briefcase", "ビジネスバッグ", "メッセンジャー", "ウエストバッグ", "ボディバッグ"],
  "財布": ["財布", "ウォレット", "wallet", "長財布", "二つ折り", "三つ折り", "コインケース", "カードケース"],
  "時計": ["時計", "watch", "ウォッチ"],
  "アクセサリー": ["ネックレス", "ブレスレット", "リング", "指輪", "ピアス", "イヤリング"]
};

/**
 * メイン処理：オフモールのGmailからインポート
 */
function importOffmallFromGmail() {
  Logger.log('=== オフモールGmailインポート開始 ===');

  const imageFolder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
  const label = GmailApp.createLabel(PROCESSED_LABEL);

  // Gmail検索：処理済みラベルを除外
  const query = 'subject:"【HARDOFFオフモール】ご注文内容確認書" from:netmall-cs@hardoff.co.jp -label:"' + PROCESSED_LABEL + '"';
  const threads = GmailApp.search(query, 0, MAX_THREADS);

  Logger.log('取得スレッド数: ' + threads.length + '件');

  if (threads.length === 0) {
    Logger.log('対象メールが見つかりませんでした');
    return;
  }

  let processedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const message of messages) {
      const msgId = message.getId();
      const body = message.getPlainBody();
      const receivedDate = formatDate(message.getDate());

      Logger.log('処理中: ' + message.getSubject() + ' (' + receivedDate + ')');

      // 商品情報抽出
      const productMatch = body.match(/\[商品\](.+?)\[価格（税込）\]/s);
      if (!productMatch) {
        Logger.log('  商品情報が見つかりません: スキップ');
        skippedCount++;
        continue;
      }

      // 価格抽出
      const priceMatch = body.match(/\[価格（税込）\](\d[\d,]*)\s*円/);
      if (!priceMatch) {
        Logger.log('  価格が抽出できません: スキップ');
        skippedCount++;
        continue;
      }

      const productText = productMatch[1].trim();
      const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);

      // 商品URL抽出
      const urlMatch = body.match(/\[商品URL\](https?:\/\/[^\s]+)/);
      const productUrl = urlMatch ? urlMatch[1].trim() : null;

      // 商品名クリーニング（先頭の商品コード除去）
      const cleanedProductName = cleanProductName(productText);

      // ブランド・カテゴリ検出
      const detectedBrand = detectBrand(cleanedProductName);
      const detectedCategory = detectCategory(cleanedProductName);

      // 画像取得・保存
      let imageUrl = null;
      if (productUrl) {
        const pageImageUrl = getImageFromProductPage(productUrl);
        if (pageImageUrl) {
          const fileName = 'offmall_' + receivedDate.replace(/\//g, '') + '_' + (processedCount + 1) + '.jpg';
          imageUrl = downloadAndSaveImage(pageImageUrl, fileName, imageFolder);
        }
      }

      // APIに送信
      const payload = {
        product_name: cleanedProductName,
        brand_name: detectedBrand || null,
        category: detectedCategory || null,
        supplier: 'オフモール',
        purchase_date: receivedDate,
        purchase_price: price,  // 税込価格（API側で税抜に変換）
        image_url: imageUrl,
        external_id: msgId,
        external_source: 'offmall'
      };

      try {
        const result = sendToAPI(payload);
        if (result.success) {
          Logger.log('  登録成功: ' + cleanedProductName + ' | ¥' + price.toLocaleString());
          processedCount++;
        } else {
          Logger.log('  登録失敗: ' + JSON.stringify(result.errorDetails));
          errorCount++;
        }
      } catch (e) {
        Logger.log('  APIエラー: ' + e.message);
        errorCount++;
      }
    }

    // スレッドに処理済みラベルを付与
    thread.addLabel(label);
  }

  Logger.log('\n=== 処理サマリー ===');
  Logger.log('新規登録: ' + processedCount + '件');
  Logger.log('エラー: ' + errorCount + '件');
  Logger.log('スキップ: ' + skippedCount + '件');
}

/**
 * APIにデータを送信
 */
function sendToAPI(payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(API_ENDPOINT, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode !== 200) {
    throw new Error('API returned status ' + statusCode + ': ' + responseText);
  }

  return JSON.parse(responseText);
}

/**
 * 日付フォーマット (YYYY/MM/DD)
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '/' + m + '/' + d;
}

/**
 * 商品名クリーニング（先頭の連続数字＝商品コードを除去）
 */
function cleanProductName(text) {
  return (text || '').replace(/^\d+/, '').trim();
}

/**
 * ブランド検出
 */
function detectBrand(text) {
  const upper = (text || '').toUpperCase();
  for (const [brand, aliases] of Object.entries(BRAND_DICT)) {
    for (const alias of aliases) {
      if (upper.includes(alias.toUpperCase())) {
        return brand;
      }
    }
  }
  return null;
}

/**
 * カテゴリ検出
 */
function detectCategory(text) {
  const lower = (text || '').toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  return null;
}

/**
 * 商品ページから画像URLを抽出
 */
function getImageFromProductPage(url) {
  if (!url || !url.startsWith('http')) return null;

  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;

    const html = res.getContentText();

    // 複数パターンで画像URLを探す
    const patterns = [
      /<meta\s+property="og:image"\s+content="([^"]+)"/i,
      /<img[^>]+class="[^"]*product[^"]*"[^>]+src="([^"]+)"/i,
      /<img[^>]+id="[^"]*main[^"]*"[^>]+src="([^"]+)"/i,
      /<img[^>]+class="[^"]*main[^"]*"[^>]+src="([^"]+)"/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1];
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = 'https://netmall.hardoff.co.jp' + imageUrl;
        }
        return imageUrl;
      }
    }

    return null;
  } catch (e) {
    Logger.log('商品ページ取得エラー: ' + e.message);
    return null;
  }
}

/**
 * 画像をダウンロードしてGoogle Driveに保存
 * @returns {string|null} Google Drive公開URL
 */
function downloadAndSaveImage(imageUrl, fileName, folder) {
  if (!imageUrl || !imageUrl.startsWith('http')) return null;

  try {
    const res = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;

    const blob = res.getBlob();
    const contentType = blob.getContentType();

    // 拡張子を判定
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';

    const newFileName = fileName.replace(/\.[^.]+$/, '.' + ext);
    blob.setName(newFileName);

    // Driveに保存して公開リンクを取得
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  } catch (e) {
    Logger.log('画像ダウンロードエラー: ' + e.message);
    return null;
  }
}

/**
 * テスト用：最新1件のみ処理（ラベル付与なし）
 */
function testImportOffmall() {
  Logger.log('=== テストモード ===');

  const query = 'subject:"【HARDOFFオフモール】ご注文内容確認書" from:netmall-cs@hardoff.co.jp';
  const threads = GmailApp.search(query, 0, 1);

  if (threads.length === 0) {
    Logger.log('テスト対象メールが見つかりません');
    return;
  }

  const message = threads[0].getMessages()[0];
  const body = message.getPlainBody();

  Logger.log('件名: ' + message.getSubject());
  Logger.log('日付: ' + formatDate(message.getDate()));
  Logger.log('メッセージID: ' + message.getId());
  Logger.log('\n--- 本文（先頭500文字） ---');
  Logger.log(body.substring(0, 500));

  // 商品情報抽出テスト
  const productMatch = body.match(/\[商品\](.+?)\[価格（税込）\]/s);
  const priceMatch = body.match(/\[価格（税込）\](\d[\d,]*)\s*円/);
  const urlMatch = body.match(/\[商品URL\](https?:\/\/[^\s]+)/);

  Logger.log('\n--- 抽出結果 ---');
  Logger.log('商品: ' + (productMatch ? cleanProductName(productMatch[1]) : '抽出失敗'));
  Logger.log('価格: ' + (priceMatch ? priceMatch[1] + '円' : '抽出失敗'));
  Logger.log('URL: ' + (urlMatch ? urlMatch[1] : '抽出失敗'));

  if (productMatch) {
    const productName = cleanProductName(productMatch[1]);
    Logger.log('ブランド: ' + (detectBrand(productName) || '検出なし'));
    Logger.log('カテゴリ: ' + (detectCategory(productName) || '検出なし'));
  }
}
