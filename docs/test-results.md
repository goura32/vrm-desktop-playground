# 最終検証記録

実施日時: 2026-09-05 22:50 JST
対象: Ubuntu 26.04 / GNOME Wayland / Xwayland (`DISPLAY=:0`)
Node.js: v22.23.2
Electron: 44.2.0

## 自動検証

| コマンド | 結果 | 実測結果 |
|---|---|---|
| `npm ci --ignore-scripts` | PASS | lockfile から 333 packages を再構築、監査 0 vulnerabilities |
| `npm run lint` | PASS | ESLint エラーなし |
| `npm run typecheck` | PASS | TypeScript エラーなし |
| `npm test` | PASS | 12 test files / 33 tests passed |
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
- Primary Display `bounds` は `0,0 2560x1440`。
- Primary Display `workArea` は `67,29 2493x1411`、`scaleFactor` は `1`。
- fullscreen state適用後の `avatarWindow.getBounds()` は起動直後・renderer load後ともに `0,0 2560x1440`。Debug Windowは `420 × 720`。
- 初回実測では、通常のnon-fullscreen BrowserWindowがGNOME/Mutter/Xwaylandにより`workArea`サイズへclampされ、`avatarWindow.getBounds()`が`0,0 2493x1411`となっていた。原因は通常windowのWM制約であり、`fullscreen: true`と`setFullScreen(true)`をcreation/display変更時に適用して解消した。
- 修正後のAvatar X11 windowは`_NET_WM_STATE_FULLSCREEN` / `_NET_WM_STATE_ABOVE`、depth 32 / TrueColor / border 0を確認。
- Avatar Windowはtransparent、frameless、non-movable、non-resizable、描画専用overlayとして構成。
- Computer Useの画面確認で、全身が収まった透明Avatar viewport、Debugの`ready`、Primary Display bounds、Always on Top、scene-space位置入力、VRM/VRMA controls、expression controls、LookAt/Spring Bone/VRMA capability表示を確認。
- キャラクター位置は正規化screen-spaceの初期値`0.50, 0.87`。Yはモデルの足元をアンカーとする。Debug UIにはX/Y入力、Set character position、矢印ボタン、Arrow key経路がある。
- Computer Useの同一Electronアプリ内target選択がfullscreen Avatar Windowを優先し、Debugへの物理キーボード入力は確認できなかった。UIのキーボード経路は自動テストとコードレビューで確認し、実画面の位置変更はmanual verification requiredとして記録する。

## 07 デスクトップキャラクター評価（Baseline → 最小修正）

07の評価仕様に従い、Baselineはコード変更前の`4a5379b47c60d719e61df0a47fc0edbcd5a7550d`を起動し、起動前後の`git status`がcleanであることを確認して実施した。Computer Useは画面確認とキーボード経路の確認に限定し、マウスクリック・ドラッグには依存していない。

### 1. Baseline

- VRM: `VRM1_Constraint_Twist_Sample.vrm`（VRM 1.0、54 humanoid bones、18 expressions、LookAt/Spring Bone available）。モデル頂点boundsからheightは約`1.6154`。
- VRMA: `assets/vrma/test.vrma`（3.00秒、3 tracks: rightUpperArm / happy / lookAt）。07の規定どおり、見た目評価ではなくtechnical fixtureとして扱った。
- Display: Primary Display `bounds=0,0 2560x1440`、`workArea=67,29 2493x1411`、`scaleFactor=1`。Avatar Windowはfullscreenで`getBounds=0,0 2560x1440`。
- Initial normalized position: `0.50,0.50`（修正前のcenter anchor）。
- Camera: FOV `30°`、model height約`1.6154`に対しposition約`(0,0.8562,4.2001)`、lookAt約`(0,0.8400,0)`、model scale `1.0`。
- Screenshot/Computer Use observation: 初期全身はviewportの約`73.3%`、頭上余白約`14.0%`、足元余白約`12.7%`。サイズ感は実用範囲だが床/影がなく、足が浮いて見える。X=`0.20`/`0.80`では四肢・靴は切れなかった一方、Y=`0.80`ではcenter anchorのため下半身・靴が画面外へ移動した。
- Motion: play/pause/stop、Loop ON、speed`0.5/1.0/1.5`を実画面で操作。test.vrmaの性質どおり、1.1秒時点で目立つ全身idleではなく、右上腕の局所変化が中心で、足滑り・画面外はなし。Loop OFF/speed`0.5`で7秒待つと内部再生は終了するが、Baseline Debug表示は`playing`のまま残った。
- Expression: `happy/angry/sad/relaxed/surprised`を各1.0で確認。happy/relaxed/surprisedは識別可能、angry/sadは口元中心で弱い。happy`0.25/0.50/1.00`は連続的でmesh破綻なし。aa/ih/ou/ee/ohは機能確認に留めた。
- Blink: Auto Blinkをenabledにし約6秒観察、manual blinkをAuto OFFで発火して復帰を確認。閉眼は短く低コントラストで視認性は弱いが、Expression競合・ちらつき・復帰失敗はなし。
- LookAt: LookAt ON/OFFを確認。既存pointermove経路へ左/右の指定ターゲットを与えた比較では全avatar差分`0.014%`（顔領域169px）と小さく、頭・髪の動きは視認困難。ただし端点で首/眼球の破綻はなく、OFF→ON/OFF復帰も正常。
- Spring Bone: Seed-san（51 bones、Spring Bone available）にも差し替えて端点ターゲット→中央を確認。髪/衣装の明瞭な揺れは観察できなかったが、暴走・長時間振動・例外はなかった。
- Desktop character impression: 透明fullscreen overlay、枠/タイトルバーなし、中央の淡色VRMは視認可能。一方、T-pose寄りで床接地感がなく、LookAt/Blinkは控えめなため、常駐キャラクターとしての動きの自然さは限定的だった。

### 2. Score

| Item | Score 1-5 | Notes |
|---|---:|---|
| 存在感 | 3 | fullscreen overlay上で全身は明瞭だが静止T-pose寄り。 |
| 視認性 | 4 | 約73%の身長で全身・顔・両靴を確認できる。 |
| サイズ感 | 4 | 初期フレームのサイズは大きすぎず小さすぎない。 |
| 動きの自然さ | 2 | 入手済みVRMAがtechnical fixtureで、全身idleとしては弱い。 |
| 表情の自然さ | 3 | happy/relaxed/surprisedは有効、angry/sadは弱い。 |
| 視線の自然さ | 2 | 指定ターゲットへの視認可能な頭部追従が小さい。 |
| 邪魔にならなさ | 3 | 透明でUIはないが、全画面中央の常駐モデルは作業領域を占有する。 |
| 総合完成感 | 3 | 技術PoCとして成立。idle/LookAt/Blinkの演出は次Phase。 |

### 3. Issues

| Priority | Issue | Reproduced | Fixed | Notes |
|---|---|---|---|---|
| A | center anchorで足元が約12.7%浮き、Y=`0.80`で下半身・靴が画面外 | Yes | Yes | world-space boundsからroot transform込みでlocal feet pointを作り、投影モデルboundsでedge clamp。defaultを`0.50,0.87`へ変更。非ゼロtransformとviewport edgeの回帰テスト。 |
| B | Loop OFFのclip終了後もDebug statusが`playing`のまま、load中に旧motionが終端通知し得る | Yes | Yes | 内部state遷移を1回だけpublishし、model/motion load generation・VRM/Controller identity・loading flagを確認して`stopped / Motion finished.`へ更新。 |
| B候補 | LookAtの頭・髪の追従が視認困難 | Yes | No | 破綻・過敏さはなく、モデル/解像度依存の弱い反応と判断。未計測のsmoothing調整は実施しない。 |
| B候補 | Blink閉眼が低コントラストで弱い | Yes | No | 閉眼/復帰・競合なし。frequency/期間の実測異常なし。 |
| C | test.vrmaが全身idleとして弱い、床/影/HUD等の演出改善 | Yes | No | 07の優先度Cは実装しない。追加asset取得も外部ログイン/購入でPhaseを止めない。 |
| A未再現 | Spring Bone暴走、LookAtモデル破綻、全身欠落、極端なscale | No | N/A | 実画面で該当なし。 |

### 4. Changes

- Baseline観察中はHEAD・作業ツリーを変更しなかった。
- A-1: `SceneController`のprojection anchorをworld-space boundsからroot transform込みで求めたlocal足元へ変更し、投影モデルboundsで全消失を防ぐedge clampを追加。既定位置を`{ x: 0.5, y: 0.87 }`へ変更し、Debug/README/architectureでYの意味を明示。非ゼロtransformとviewport edgeの回帰テストを追加。
- B-1: one-shot motionの`playing → stopped`遷移を`AvatarRuntime`が検出し、model/motion load generation・target identityを確認してDebug statusへ`Motion finished.`をpublish。
- 変更しなかったもの: LookAt smoothing、Blink timing、Spring Bone、technical VRMA、Debug UI外観、追加asset。

### 5. Regression

- lint: PASS
- typecheck: PASS
- test: PASS（対象RED→GREEN後、全体`12 test files / 33 tests`）
- build: PASS（renderer + Electron main/preload）
- audit: PASS（`0 vulnerabilities`）
- Computer Use: 修正後の初期全身、X=`0.20/0.50/0.80`、Y=`0.80/1.00`で全身/靴の表示を確認。Loop OFF/speed`0.5`を7秒後に`stopped / Motion finished.`表示へ更新確認。VRM/VRMA、Expression、Blink、LookAt、Spring Bone、Seed-san差し替えも再確認。

### 6. Git

- Final commit: この評価修正を含むcommitを作成し、完了報告でIDを記録する。
- git status: commit後にcleanを確認する。

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
