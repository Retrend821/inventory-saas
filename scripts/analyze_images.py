#!/usr/bin/env python3
"""
画像からルイヴィトンの型番・モデル名を判定してCSVを更新するスクリプト
"""

import csv
import os
import sys
import time
import base64
import requests
import anthropic
from pathlib import Path

# 設定
INPUT_CSV = "/Users/sudaatsuya/Downloads/売上明細_全期間_2026-01-23.csv"
OUTPUT_CSV = "/Users/sudaatsuya/Downloads/売上明細_全期間_2026-01-23_updated.csv"
MAX_ITEMS = None  # None で全件処理、数字を入れるとその件数だけ処理

def download_image_as_base64(url: str) -> tuple[str, str] | None:
    """画像をダウンロードしてbase64エンコード"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        # Content-Typeからメディアタイプを取得
        content_type = response.headers.get('content-type', 'image/jpeg')
        if 'jpeg' in content_type or 'jpg' in content_type:
            media_type = 'image/jpeg'
        elif 'png' in content_type:
            media_type = 'image/png'
        elif 'webp' in content_type:
            media_type = 'image/webp'
        elif 'gif' in content_type:
            media_type = 'image/gif'
        else:
            media_type = 'image/jpeg'  # デフォルト

        base64_data = base64.standard_b64encode(response.content).decode('utf-8')
        return base64_data, media_type
    except Exception as e:
        print(f"  画像ダウンロードエラー: {e}")
        return None

def analyze_image(client: anthropic.Anthropic, image_base64: str, media_type: str, current_name: str) -> dict:
    """Claudeで画像を解析して型番・モデル名を取得"""

    prompt = f"""この画像はルイヴィトンの商品です。以下の情報を特定してください。

現在の商品名: {current_name}

以下の形式で回答してください（JSONのみ、説明不要）:
{{
  "model_number": "型番（例: M51172, N41358など。不明な場合は空文字）",
  "line": "ライン名（例: モノグラム, ダミエ, エピ, アンプラント等）",
  "model_name": "モデル名（例: スピーディ30, ネヴァーフルMM, ジッピーウォレット等）",
  "formatted_name": "整形された商品名（型番 ライン モデル名 の形式）"
}}

注意:
- 型番はM/Nで始まる5-6桁の英数字
- 刻印やタグから型番を読み取れる場合はそれを使用
- 現在の商品名に型番が含まれている場合はそれを参考に
- formatted_nameは「M51172 モノグラム スピーディ30」のような形式で"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_base64
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        )

        # レスポンスからJSONを抽出
        text = response.content[0].text
        # JSONブロックを抽出
        import json
        import re

        # ```json ... ``` または { ... } を探す
        json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return result
        else:
            print(f"  JSON解析エラー: {text[:100]}")
            return None

    except Exception as e:
        print(f"  API呼び出しエラー: {e}")
        return None

def main():
    # APIキー確認
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("エラー: ANTHROPIC_API_KEY 環境変数を設定してください")
        print("例: export ANTHROPIC_API_KEY='your-api-key'")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # CSV読み込み
    print(f"CSVを読み込み中: {INPUT_CSV}")
    rows = []
    with open(INPUT_CSV, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            rows.append(row)

    print(f"総件数: {len(rows)}件")

    # ルイヴィトンで画像URLがある行を抽出
    target_rows = []
    for i, row in enumerate(rows):
        brand = row.get('ブランド', '')
        image_url = row.get('画像URL', '')
        if brand == 'ルイヴィトン' and image_url:
            target_rows.append((i, row))

    print(f"処理対象（ルイヴィトン・画像あり）: {len(target_rows)}件")

    if MAX_ITEMS:
        target_rows = target_rows[:MAX_ITEMS]
        print(f"テストモード: {MAX_ITEMS}件のみ処理")

    # 処理
    updated_count = 0
    for idx, (row_index, row) in enumerate(target_rows):
        inv_num = row.get('管理番号', '?')
        current_name = row.get('商品名', '')
        image_url = row.get('画像URL', '')

        print(f"\n[{idx+1}/{len(target_rows)}] 管理番号: {inv_num}")
        print(f"  現在の商品名: {current_name[:50]}...")

        # 画像ダウンロード
        result = download_image_as_base64(image_url)
        if not result:
            continue

        image_base64, media_type = result

        # 画像解析
        analysis = analyze_image(client, image_base64, media_type, current_name)
        if not analysis:
            continue

        new_name = analysis.get('formatted_name', '')
        if new_name and new_name != current_name:
            print(f"  → 新しい商品名: {new_name}")
            rows[row_index]['商品名'] = new_name
            updated_count += 1
        else:
            print(f"  → 変更なし")

        # レート制限対策
        time.sleep(0.5)

    # CSV書き出し
    print(f"\n\nCSVを書き出し中: {OUTPUT_CSV}")
    with open(OUTPUT_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n完了！")
    print(f"  処理件数: {len(target_rows)}件")
    print(f"  更新件数: {updated_count}件")
    print(f"  出力ファイル: {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
