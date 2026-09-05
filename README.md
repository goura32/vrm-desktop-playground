# VRM Desktop Playground PoC

Electron + React + TypeScript + Vite + Three.js の VRM 1.0 デスクトップキャラクター検証環境です。VRM 表示用の透明ウィンドウと、操作・状態確認用の Debug Window を分離しています。

## 起動

```bash
npm install
npm start
```

Linux の `start` は `--ozone-platform=x11 --no-sandbox` を付けます。Ubuntu GNOME Wayland では Xwayland 経由を標準経路にし、透明・枠なしウィンドウを安定して扱います。`npm start` は `prestart` でElectronのmain/preload bundleを生成してから起動するため、clean checkoutでは先に手動buildする必要はありません。開発中に Vite のホットリロードを使う場合は `npm run dev` を実行します。

## 操作

- Debug Window の標準 HTML コントロールは Tab / Shift+Tab で移動し、Enter / Space で操作できます。
- `Open VRM` / `Open VRMA` でローカルファイルを選択できます。公開サンプルは `Load constraint sample`、`Load Seed-san`、`Load bundled VRMA` から読み込めます。
- Avatar Window は Primary Display 全体を覆う透明オーバーレイで、常時 Click Through です。Click Through / Interaction Mode の切り替えUIや、Avatar Window自体の移動UIはありません。
- キャラクター位置は正規化 screen-space（左上が`0,0`、右下が`1,1`）で管理し、Debug Window の X/Y入力と矢印ボタンから変更できます。これはBrowserWindowの位置ではなく、Three.js/VRM sceneの位置です。
- VRM を差し替えると、モデル情報・Preset/Custom Expression・Humanoid・LookAt/Spring Bone/VRMA capability が更新されます。

## アセットとライセンス

コミット済みの VRM/VRMA は `assets/vrm/` と `assets/vrma/` に置き、由来・ライセンス・再配布可否・クレジット・SHA-256 を [`assets/manifest.json`](assets/manifest.json) に記録します。現行の配布条件を自動確認できない VRoid Hub / BOOTH 候補はファイルを取得・再配布せず、manifest に `BLOCKED_ASSET` として記録しています。

## 検証と制約

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

自動テストと実アプリ起動を組み合わせます。Computer Use は画面キャプチャ、ウィンドウ認識、キーボード操作、目視確認だけに使い、マウスクリック・ドラッグには依存しません。Click Through の背面受信確認は環境依存のため、OS自動確認ができない場合はmanual verification requiredとして記録します。

native Wayland は今回の受入対象外です。リップシンク、LLM/TTS/STT、複数キャラクター、インストーラー、自動アップデート、クラウド同期も対象外です。`--no-sandbox` はこの PoC の Ubuntu 実行環境で Electron の setuid sandbox helper を利用できないための開発用起動条件であり、本番配布向け設定ではありません。

実装の境界は [`docs/architecture.md`](docs/architecture.md)、最終検証記録は [`docs/test-results.md`](docs/test-results.md) を参照してください。
