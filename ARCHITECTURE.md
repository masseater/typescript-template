# ARCHITECTURE.md

この文書は、どこに何があり、何が何に依存してよいかを書く。
頻繁に変わることは書かず、年に数回だけ見直す。
コマンドは AGENTS.md に、見た目の決まりは DESIGN.md にある。
ファイルや型の名前はリンクにしないので、名前で検索して探す。

## 解く問題

Cloudflare Workers で動く Web アプリのテンプレートである。
1 つの Worker が SSR と `/api/*` を受け持ち、データは D1 にだけ置く。
デプロイは Alchemy の 1 つのスタックにまとめ、検査は `vp run verify` の 1 回にまとめる。

テンプレートから作ったリポジトリでは、この節をそのリポジトリが解く問題の説明に書き換える。

## コードマップ

ワークスペースの一覧は pnpm-workspace.yaml にあり、それぞれの役割は各 package.json と README にある。
`apps/` はデプロイするアプリ、`libs/` は複数のアプリが使う部品、`tools/` は開発と計測のための道具である。
誰にでも見せる静的なページは、それを配るアプリのスタックが `Website.StaticSite` でデプロイする。
`.claude` は Claude Code のフックで、それ自体もワークスペースの 1 つである。

### `.github`

Cloudflare のトークンは、GitHub の OIDC と引き換えに credential broker から受け取る。
broker は masseater/masseater.dev にある。

## 不変条件

依存してよい向きは、apps から libs と infra へ、tools と infra から libs へだけである。
libs は何にも依存せず、apps 同士も依存しない。
fallow の boundaries がこれを検査する。

アプリの `src/` の直下には FSD のレイヤーしか無く、スライスは互いを import しない。
steiger がこれを検査する。

Alchemy が作るリソースの名前はすべて `APP_NAME-` で始まる。
同じアカウントにある別のリポジトリのリソースを置き換えないためである。

Worker はメモリに状態を持たない。
永続するデータは D1 にだけある。

コードにコメントは無く、lint がコメントを落とす。
なぜそう書いたかはコミットメッセージにある。

## 横断する関心

計測は自動計装に任せる。
Effect のスパンは Alchemy の `CloudflareTracer` を通って Workers の traces に出る。
ログは Workers Logs に残る。
ページの表示は Cloudflare Web Analytics が記録する。
CI のジョブ、step、vp のタスクの時間は、`ci-telemetry` アクションが OTLP の JSON にする。
その JSON は run の artifact（`telemetry-run-<attempt>`）に残る。

lint の一部は oxlint-plugin-decision で、Cloudflare AI Gateway を通して Workers AI のモデルにコードを判定させる。
モデルを呼ぶのは検査だけで、アプリは外部の API を呼ばない。
