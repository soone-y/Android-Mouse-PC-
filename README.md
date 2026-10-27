# Android Mouse PC

スマートフォンをマウスの代わりに使うための実験・開発プロジェクトです。加速度計とジャイロセンサーから操作入力を生成し、将来的には Bluetooth HID で PC のマウスとして使用することを目指しています。

> **現在は試作段階です。** 公開ブラウザ版はページ内のカーソルを動かすデモで、PCのOSカーソルは操作しません。Android向けコードは測定・姿勢推定・操作量変換の参照実装であり、APKやBluetoothマウス機能はまだ含まれていません。

## ブラウザデモ

**[Sensor Mouse Lab を開く](https://soone-y.github.io/Android-Mouse-PC-/)**

リポジトリ直下の `index.html` だけで動く静的ページです。GitHub Pages が有効なら、HTTPS環境でスマートフォンのモーションセンサーを試せます。

- ページ内カーソルによる操作感の確認
- 感度・デッドゾーン（閾値）・平滑化・減衰の調整
- 加速度波形の表示と模擬入力
- 加速度の直接変換／積分など、挙動の比較

センサーの利用可否はブラウザ・OS・端末設定によって変わります。計測データをサーバーに送信するための機能は設けていません。

## Android向け測定処理（IMU v2）

`android-reference/` に、以前のAndroid測定アプリのコードを基に整理した**純粋なKotlinのアルゴリズム実装**があります。既存のブラウザデモとは独立しています。

| ファイル | 主な役割 |
| --- | --- |
| `MadgwickAHRS.kt` | 加速度と角速度による姿勢推定。正規化時のゼロ除算などを防止 |
| `ImuFusionEngine.kt` | センサーイベントの時刻管理と重力成分の推定・除去 |
| `MotionProcessor.kt` | 補正加速度から相対的なカーソル移動量を生成。感度・閾値・平滑化・減衰を設定可能 |
| `SmokeTest.kt` | 数値の健全性、基本的な方向応答、静止時の動作の簡易テスト |

詳細とAndroidへの接続例は **[android-reference/README.md](android-reference/README.md)** を参照してください。

### 簡易テスト

Kotlinのコマンドラインコンパイラ（`kotlinc`）とJava実行環境が必要です。`android-reference/` に移動して実行します。

```bash
kotlinc src/main/kotlin/com/example/movingsensorapp/sensor/*.kt src/test/kotlin/com/example/movingsensorapp/sensor/SmokeTest.kt -include-runtime -d imu-test.jar
java -jar imu-test.jar
```

簡易テストはローカルで通過しています。ただし、これはAndroid端末での動作、位置推定精度、Bluetooth接続の検証ではありません。

## 設計と制約

処理経路は「Androidセンサー取得 → IMU姿勢推定・重力補正 → 操作量変換 → （将来）Bluetooth HID送信」です。**センサー処理と通信を分離**することで、移動方式を変更しても通信部分を再利用できる設計を想定しています。

- MadgwickのIMU版では方位角（ヨー）の長期的なドリフトは補正できません。
- 加速度の二重積分だけでは、実際の移動距離を安定して再現できません。積分方式は実験用です。
- 単一姿勢での静止較正は、加速度計の3軸バイアスを完全に特定できません。
- 実際のBluetooth HID機能には、Android端末側の対応、権限処理、接続管理、UIが別途必要です。

## 今後の実装候補

- Androidのセンサーイベント取得とIMU v2との統合
- 感度・閾値・停止判定の端末内設定画面
- 実機測定・遅延・ドリフトの定量評価
- Bluetooth HIDによるPCへのマウス／キーボード入力

これらは**予定・検討事項**であり、実装済み機能ではありません。

## 無料公開・プライバシー

ブラウザ版は外部ライブラリ、APIサーバー、ユーザー登録、分析サービスを必要としない構成です。GitHub Pagesで静的に配信でき、追加の有料インフラは不要です（GitHubの利用条件・制限の範囲内）。センサーのアクセス許可は端末のブラウザ側で行います。

## ライセンス

[zlib License](LICENSE)。元となる測定コードからの変更を含む参照実装は、改訂版であることを明記しています。
