# 最終検証記録

実施日時: 2026-09-05 20:49 JST
対象: Ubuntu 26.04 / GNOME Wayland / Xwayland (`DISPLAY=:0`)
Node.js: v22.23.2
Electron: 44.2.0

## 自動検証

| コマンド | 結果 | 実測結果 |
|---|---|---|
| `npm ci --ignore-scripts` | PASS | lockfile から 333 packages を再構築、監査 0 vulnerabilities |
| `npm run lint` | PASS | ESLint エラーなし |
| `npm run typecheck` | PASS | TypeScript エラーなし |
| `npm test` | PASS | 12 test files / 29 tests passed |
| `npm run build` | PASS | Vite renderer と Electron main/preload bundle を生成 |
| `npm audit --audit-level=high` | PASS | 0 vulnerabilities |

Build では Three.js renderer chunk が 500 kB を超えるという Vite の最適化提案だけが出ます。ビルド失敗ではありません。

## アセット整合性

`tests/assets.test.ts` が manifest の obtained asset 5 件について、実ファイルの存在と SHA-256 を照合しています。VRM 2 件、expression behavior sample 2 件、VRMA 1 件が対象です。`assets/manifest.json` には出典 URL、取得 URL、著作者、ライセンス、ライセンス URL、再配布可否、クレジット条件、ハッシュを記録しました。条件を確認できない Vita / Vfg 1.0 / Victoria_Rubin / BOOTH 候補はダウンロード・コミットせず `BLOCKED_ASSET` としています。

## 実アプリ確認

`npm start` の実行ログとComputer Useの画面確認で次を確認しました。

- Linux 起動引数は `--ozone-platform=x11 --no-sandbox`。
- Debug Window と Avatar Window が別ウィンドウで起動。
- `VRM1_Constraint_Twist_Sample.vrm` の VRM 1.0 load が `ready`。
- `test.vrma` の load が `ready`、1 motion を認識。
- Primary Display bounds は `67, 29 · 2493 × 1411`。
- Avatar Window bounds は Primary Displayと同じ `67, 29 · 2493 × 1411`。Debug Windowは `420 × 720`。
- AvatarのX11 windowはdepth 32 / TrueColor / viewableで、`_NET_WM_STATE_ABOVE`を確認。
- Avatar Windowはtransparent、frameless、non-movable、non-resizable、描画専用overlayとして構成。
- Computer Useの画面確認で、全身が収まった透明Avatar viewport、Debugの`ready`、Primary Display bounds、Always on Top、scene-space位置入力、VRM/VRMA controls、expression controls、LookAt/Spring Bone/VRMA capability表示を確認。
- キャラクター位置は正規化screen-spaceの初期値`0.50, 0.50`。Debug UIにはX/Y入力、Set character position、矢印ボタン、Arrow key経路がある。
- Computer Useの同一Electronアプリ内target選択がfullscreen Avatar Windowを優先し、Debugへの物理キーボード入力は確認できなかった。UIのキーボード経路は自動テストとコードレビューで確認し、実画面の位置変更はmanual verification requiredとして記録する。

## Click Through の検証状態

Avatar Windowは常時 `BrowserWindow.setIgnoreMouseEvents(true, { forward: true })` を適用し、Click Through / Interaction Mode切り替えIPCとUIを廃止しています。常時Click Throughの実装・構成テストはPASSです。

OS 上で背面 X11 window に click が届くことの自動確認は BLOCKEDです。このセッションはWayland上のXwaylandで、`xdotool`とXTEST拡張は存在するものの、`xev`に対する`xdotool click`が`ButtonPress`を生成しませんでした。`xinput` / `ydotool` / `wtype`も利用できないため、Computer Useのマウス操作で代替せず、実装済み・manual verification requiredとして記録します。

## 自己レビュー結果

- renderer から Node.js / Electron を直接 import していないことを確認。
- preload の `contextBridge` API のみを renderer に公開。
- bundled asset は固定 ID allowlist と manifest 経由。prototype property を asset ID として受け付けない。
- ローカルファイルは basename、拡張子、ArrayBuffer、250 MiB 上限を検証。読み込み前に stat でサイズを確認。
- IPC の command / status を runtime shape guard と `event.sender` 検証で保護。移動方向などの不正値を拒否。
- navigation / redirect はアプリ内ページまたはローカルVite originに限定し、`window.open` は拒否。両HTML entry pointにCSPを設定。
- Avatar WindowはPrimary Displayの`bounds`を使用し、`display-metrics-changed` / `display-added` / `display-removed`でboundsを再適用。
- キャラクター位置はBrowserWindowのX/Yではなく、`SceneController`の正規化screen-spaceとして保持し、Three.js camera projectionでVRM scene rootを移動。
- Debugのposition controlsは既存のwindow movement IPCを使わず、validated avatar commandとしてAvatar rendererへルーティング。
- VRMとVRMAの非同期ロード世代を分離し、モデル差し替え中の古いmotion適用を拒否。差し替え後はbundled VRMA要求をモデル単位で再試行。
- npm lifecycleの`predev` / `prestart`でElectron main/preload bundleを生成し、clean checkoutの起動経路を確保。
- VRM 差し替え時の animation source snapshot と mixer resource cleanup、expression reset 後の model status 更新を確認。
- `.env` / `.env.*` は Git 管理対象外。秘密情報の追加なし。
- Electron の既知脆弱性を解消するため Electron 44.2.0 に更新し、`npm audit` 0 件を確認。BrowserWindowは `sandbox: true`、実行環境のsetuid helper制約により起動引数は `--no-sandbox`。

## 既知の制約

native Wayland は受入対象外で、Xwayland 経路を標準とします。`--no-sandbox` はこの PoC 実行環境で setuid sandbox helper を利用できないための開発用条件であり、本番配布設定ではありません。リップシンク、LLM/TTS/STT、複数キャラクター、インストーラー、自動更新、クラウド同期は PoC 対象外です。
