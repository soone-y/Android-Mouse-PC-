# Sensor Mouse Lab v11 — rotationRate軸修正版

既存の `soone-y/Android-Mouse-PC-` の `main`（Git tree `e4937e27efc068a41c2968f7a5d2e8c8a53a09bb`）を対象にした**直接上書き用のソース更新**です。

## 適用方法

このZIPは**完全なリポジトリではありません**。`src` 内の2ファイルのみ変更し、`tests` に1ファイルを追加します。

1. GitHubから既存の `Android-Mouse-PC-` をclone、または最新の状態へpullします。
2. このZIPの中身を、cloneしたリポジトリのルート（`index.html` と `src/` があるフォルダ）へ展開し、同名ファイルを**上書き**します。
3. 既存の `src` フォルダは削除しないでください。未変更のJSファイルは既存のものを使います。
4. `npm test` を実行します。
5. `git diff` を確認してから、`git add src/pipeline.js src/recording.js tests/rotation-axis.test.mjs README_v11_update.md`、`git commit -m "Fix rotationRate axis mapping and legacy replay"`、`git push` します。

## 変更内容

- `src/pipeline.js`: `DeviceMotionEvent.rotationRate` のxyzへの対応を旧版 `[beta,gamma,alpha]` から、W3C 2026仕様 `[alpha,beta,gamma]` へ変更。角速度の単位は度/秒からrad/秒へ変換。APIの生値を `rotationRateDeg` に保持します。
- `src/recording.js`: 新しいログに `gyroMapping: alpha-beta-gamma` を記録。JSON schemaを `sensor-mouse-lab/11` に更新。CSVの末尾にマッピング名と生の角速度3値を追加。旧v10のCSV/JSONと比較CSVは読み込み時に角速度を並べ替え、旧JSONの静止校正時のジャイロバイアスも1回だけ変換します。
- `tests/rotation-axis.test.mjs`: 生センサーからxyzへの変換、水平回転時の重力補正、過去ログ再生、校正バイアス変換のテスト。

## 補足

- **UI上のダウンロードファイル名やタイトルは既存v10のまま**です。`src/app.js`/`index.html` は変更していません。JSONのschema/CSVの追加列でv11のログを区別できます。
- ブラウザが実際に返す軸の差異があるかを確かめるため、生の `rotation_alpha_deg_s` 等も記録します。
- 新しいロジックが水平回転を正しく扱うかは実機で再測定してください。シミュレーションテストだけでは実機動作を保証できません。
- この修正は姿勢推定に大きな架空加速度が発生する問題を対象にしています。センサーバイアスによる積分ドリフトは別課題です。
- v10 CSVには記録前の校正ベクトルが含まれないため、**CSV先頭に十分な静止区間がなければ**、旧CSVの再積分を正常に開始できない場合があります。JSONには校正値が保存されるため、再検証にはJSONの利用を推奨します。

## 元のコードの確認情報

| ファイル | 修正前のGit blob SHA1 |
|---|---|
| `src/pipeline.js` | `2a8e4dd0aae9b2b0d9df023eba95c1e4882d3645` |
| `src/recording.js` | `5fe311de603fbbb1ea6578b06ddfe86353329059` |

仕様: https://www.w3.org/TR/2026/CRD-orientation-event-20261026/
