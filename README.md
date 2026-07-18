# toy_world
グリッドワールド型マルチプレイヤー実験プラットフォーム

グリッドマップ上で、プレイヤー（人間および機械学習エージェント）が、ブロックの収集・設置・摂取・融合を行いながら生存する。

旧 PHP 版を、TypeScript + Node.js + React で全面的に再構築したもの。設計の詳細は [`docs/architecture.md`](./docs/architecture.md) を参照。
<br>
<br>
<br>

## 技術スタック

| 領域 | 使用技術 |
|---|---|
| サーバ | TypeScript, Node.js, Express, WebSocket |
| フロントエンド | TypeScript, React, Vite, React Router |
| 状態管理 | インメモリ（サーバ）, React Context（フロント） |
| 永続化 | JSON（設定）, JSONL（ログ） |
| 構成管理 | pnpm workspaces（モノレポ） |

<br>
<br>

## セットアップ
### 1. nvmとNode.jsのインストール
[Node.js公式](https://nodejs.org/ja/download)
```bash
# nvmをダウンロードしてインストールする：
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash

# シェルを再起動する代わりに実行する
\. "$HOME/.nvm/nvm.sh"

# Node.jsをダウンロードしてインストールする：
nvm install 24

# Node.jsのバージョンを確認する：
node -v # "v24.18.0"が表示される。

# pnpmをダウンロードしてインストールする：
corepack enable pnpm

# pnpmのバージョンを確認する：
pnpm -v

```
### 2. リポジトリの取得と依存関係の解決
```bash
# リポジトリを取得
git clone <repository-url>
cd "リポジトリの名前"

# Node.js のバージョンを合わせる（nvm 使用時）
nvm install
nvm use

# 依存をインストール
pnpm install
```
`nvm use`で```bash N/A: version "24" is not yet installed. ```と出力された場合は`nvm install 24`を実行してから、もう一度`nvm use` を実行

`pnpm install` 時に、ビルドスクリプトの実行許可を求められた場合は、案内に従って `pnpm approve-builds` を実行する。
<br>
<br>
<br>

## 起動方法

server と frontend は、それぞれ別々のプロセスとして動かす必要があります。
ターミナルを2つ開いてください。

### 1. server を起動する
```bash
pnpm --filter server dev
```
以下のようなログが表示されれば、起動成功です。

```bash
$ tsx watch src/index.ts
[server] listening on http://localhost:3000
```

このターミナルは、server が動き続けている間、そのまま開いたままにしておいてください。

### 2. frontend を起動する

新しいターミナルを開いて、同じリポジトリのディレクトリに移動してから
```bash
pnpm --filter frontend dev
```
以下のように表示されれば、起動成功です。
``` bash 
  VITE v8.0.16  ready in 116 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

こちらのターミナルも、開いたままにしておいてください。

### 3. ブラウザで確認する

Server：http://localhost:3000/

Frontend：http://localhost:5173/


<br>
<br>

## 使い方

現状の動作確認手順は次のとおり。

### 1. ゲームを初期化する

管理者操作（マップ生成・パラメータ設定）を HTTP API で行う。
1. tickIntervalSec : １ターンの制限時間
2. actionsPerTick : 1ターンに行えるアクション数　
3. reconnectTimeoutSec : 再接続制限時間　（機能未実装）
4. "map": {"nx": "X軸の長さ", "ny": "Y軸の長さ", "blockMin": "ブロックIDの最小値", "blockMax": "ブロックIDの最大値"}
5. "player": {"lpInitial": "LPの初期値", "lpDecreasePerTick": "1ターンのLP減少数", "viewRange": "視界"}
```bash
curl -X POST http://localhost:3000/api/admin/init   -H "Content-Type: application/json"   -d '{"tickIntervalSec": 2, "actionsPerTick": 1, "reconnectTimeoutSec": 30, "map": {"nx": 10, "ny": 10, "blockMin": 0, "blockMax": 10}, "player": {"lpInitial": 100, "lpDecreasePerTick": 1, "viewRange": 5}}'
```

### 2. ゲームを開始する

ゲーム開始する。

```bash
curl -X POST http://localhost:3000/api/admin/start
```

停止する場合:

```bash
curl -X POST http://localhost:3000/api/admin/stop
```

### 3. プレイヤーとして参加する

ブラウザで http://localhost:5173/ を開き、名前・年齢・性別を入力して参加する。参加に成功するとプレイヤー画面に遷移し、アクションを選択できる。

※初期化（`curl -X POST http://localhost:3000/api/admin/init `）を行ってない場合は参加できない

### 4. 管理者として参加
ブラウザで http://localhost:5173/admin を開く

まだ実装途中のため一部機能が不安定となっている
### 5. 状態確認（デバッグ用）

サーバの現在の状態を JSON で確認できる。

```
http://localhost:3000/api/debug/state
```

<br>
<br>


## プロジェクト構成（開発に必要な部分のみ抜粋）
```
game/
├── data
│   ├── config          # ゲームパラメータ・テーブル(JSON)の設定ファイル置き場
│   └── experiments      # 実験ログ(JSONL)の出力先 ※未実装、今後のタスク
├── docs                 # 設計ドキュメント置き場 ※未整備、今後充実予定
└── packages
    ├── frontend  #ユーザー側の管理
    │   └── src
    │       ├── App.tsx           # ルーティング定義(React Router)GameProvider/AdminProviderの配置
    │       ├── components
    │       │   ├── AdminMapView.tsx  # 全体俯瞰マップ描画(SVG)。管理者画面(Admin.tsx)で使用
    │       │   └── MapView.tsx       # 部分観測マップ描画(SVG)。プレイヤー画面(Player.tsx)で使用
    │       ├── context
    │       │   ├── AdminContext.tsx  # 管理者側の状態管理(WebSocket接続・全体state保持)
    │       │   └── GameContext.tsx   # プレイヤー側の状態管理(WebSocket接続・自分のstate保持)
    │       ├── main.tsx          # Reactアプリのエントリーポイント
    │       ├── pages
    │       │   ├── Admin.tsx         # 管理者画面(俯瞰マップ・プレイヤー一覧・操作)
    │       │   ├── Player.module.css # プレイヤー画面のスタイル
    │       │   ├── Player.tsx        # プレイヤー画面(操作パネル・視界マップ)
    │       │   └── Register.tsx      # 参加登録画面
    │       └── ws
    │           └── client.ts     # WebSocket接続を扱うクライアントクラス
    ├── server　#toyworldの全体を管理
    │   └── src
    │       ├── game  #ゲームロジック
    │       │   ├── action.ts　#各アクションのロジック
    │       │   ├── tick.ts #ターン終了時の処理
    │       │   ├── ticker.ts #tick.tsを実行してるだけ
    │       │   ├── view.ts #各ユーザーの視界の処理
    │       │   └── world.ts  #マップ全体に関わる処理やロジック置き場
    │       ├── http
    │       │   └── admin.ts  # WebAPIを通じて送られてきた信号の処理。init/start/stop、設定・テーブルアップロードのエンドポイント
    │       ├── index.ts      # Expressアプリ・WebSocketサーバーの起動エントリーポイント
    │       ├── persistence
    │       └── ws
    │           ├── connection.ts # WebSocket接続の管理(プレイヤー・管理者の接続対応表)
    │           ├── handlers.ts   # クライアントから届いたメッセージの処理振り分け
    │           └── server.ts     # WebSocketサーバーのセットアップ(接続/切断のイベント登録)
    └── shared　#アプリ全体のルールが書かれている
        └── src
            ├── constants.ts  # デフォルトパラメータなどの定数定義
            ├── domain.ts     # ゲームの型定義(Player, GameParams, ViewCellなど)
            ├── index.ts      # sharedパッケージのエクスポートまとめ
            └── messages.ts   #サーバーとクライアント同士の通信ルール
```

## 実装状況

### 実装済み

- モノレポ構成、型・定数の共有パッケージ
- HTTP サーバ + WebSocket サーバ
- ワールド状態管理、マップ生成、ゲーム初期化
- プレイヤーの参加（join：空きマスへの配置・満員判定）
- アクション選択の受信（action）
- 管理 API（初期化 / 開始 / 停止）
- ティックループ（開始・停止・二重起動防止）
- フロントエンド：参加登録 → プレイヤー画面遷移 → 状態表示・アクション選択
- ティックの処理内容（ライフポイント減算・死亡判定・アクション実行・状態配信）
- アクション処理の実装（forward / get / eat / put / fusion）とテーブル生成
- マップの SVG 描画
- 管理者画面の UI（俯瞰ビュー・プレイヤー視点ビュー・一覧）

### 実装途中

- 機械学習エージェントの統合

### 今後の予定

- 実験ログ（JSONL）の記録
- 切断・再接続対応


## ドキュメント

- [アーキテクチャ設計書(工事中:2026/7/18)](Architecture.md) — 設計の全体像、各種決定事項、実装状況の詳細

## 連絡先

分からないところがあれば私のLINEかDiscordに連絡（Discordの方が連絡が早いぞ！！）