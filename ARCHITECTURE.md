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

### `apps/web`

TanStack Start の RSC のアプリである。

`alchemy.run.ts` がスタックを定義し、D1・Worker・`apps/lp` の静的サイトを作る。
`app-name.ts` の `APP_NAME` がスタック名とリソース名の接頭辞を決め、`requireAppPrefix` がデプロイの時点でそれを確かめる。

`src/app` はルートと、リクエストごとに通る処理を持つ。
`start.ts` のミドルウェアが、すべての応答にセキュリティヘッダと nonce つきの CSP を付け、Web Analytics の beacon を差し込む。
`routes/api.$.ts` は `/api/*` を `server/api.server.ts` の Elysia のルーターに渡す。
このルーターがレート制限をかけ、better-auth と各スライスのルートを載せる。

`src/pages/<ページ>` はページごとのスライスである。
`api/routes.server.ts` は Elysia のルートを作る。
`api/queries.ts` はその型から Eden と TanStack Query のクエリを作り、`ui/` が描く。
SSR の間は `createIsomorphicFn` が HTTP を通らずにルートの `handle` を呼ぶ。
ルートの処理は Effect で書き、スライスの `runtime.server.ts` の `ManagedRuntime` で動かす。
`home` は ToDo の一覧を出す見本である。

`src/shared` はスライスをまたいで使う部品である。
Elysia のルーターと Eden のクライアントを作る関数は `api` にある。
better-auth は `auth`、D1 の Drizzle は `db`、shadcn/ui は `ui` にあり、ほかに `config` がある。

### `apps/lp`

誰にでも見せる静的なページの見本である。
全ページをプリレンダーし、インラインのスクリプトをハッシュつきのファイルに出して、CSP にインラインを許さずに済ませる。
デプロイは `apps/web` のスタックが `Website.StaticSite` で行う。

### `libs/security-headers`

セキュリティヘッダと CSP を組み立てる。
`apps/web` と `apps/lp` が同じ値を使うために切り出してある。

### `tools/web-vitals`

本番の Web Vitals を `@r_masseater/web-vitals-flow` で測る。

### `.claude`

Claude Code のフックで、それ自体もワークスペースの 1 つである。
セッションの開始で依存を入れ、テンプレートの新しいリリースを知らせる。
終了の前には `vp run verify` を走らせ、通らなければ終わらせない。
pnpm を直接呼ぶコマンドも止める。

### `.github`

`verify.yml` が main への push で動く。
verify が通ると、Alchemy で本番へデプロイし、Web Vitals を測り、release-please がリリースを作る。
verify が落ちると `autofix.yml` が直しにかかる。
Cloudflare のトークンは、GitHub の OIDC と引き換えに credential broker から受け取る。
broker は masseater/masseater.dev にある。
`pull_request` で動くのは、最新の main を取り込んでいない PR を止める `up-to-date.yml` だけである。
`zap.yml` は毎週、本番に ZAP をかける。

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
ページの表示は Cloudflare Web Analytics が、CI のジョブの時間は `ci-telemetry.sh` が記録する。

lint の一部は oxlint-plugin-decision で、OpenRouter のモデルにコードを判定させる。
OpenRouter を使うのは検査だけで、アプリは外部の API を呼ばない。
