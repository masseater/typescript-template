# 環境変数を必要最小限にする

## 環境変数とは

- 環境変数は、プロセスの外から文字列で渡す設定値。型も既定値もなく、設定し忘れてもその値を読むまでエラーにならない。
- 次のものを環境変数として扱う。
  - Node で動くツール・CI・Alchemy の宣言が読む `process.env`
  - CI が GitHub Environments の secret と variable から渡す値
  - Worker が `env` で受け取る `vars` と `secret`、ローカルでそれらを渡す `.dev.vars`
- Worker の `env` に載る D1・R2・KV・Queues・Durable Objects・他 Worker の binding は環境変数として扱わない。

## 環境ごとに値が変わるものだけを環境変数にする

ローカル・staging・production・CI で入る値を並べ、実際に値が違うものだけを環境変数にする。すべて同じならコードに定数で書く。

環境変数にしてよい例:

- `APP_ORIGIN`: ローカルは `http://localhost:3000`、staging は `https://staging.example.com`、production は `https://example.com`。
- `CLOUDFLARE_ACCOUNT_ID`・`CLOUDFLARE_ZONE_ID`: 環境ごとに別のアカウントとゾーン。
- `EMAIL_FROM`・`OPS_EMAIL`: 環境ごとに別の送信元ドメインとアラートの宛先。
- `STRIPE_API_KEY`: ローカルと staging は sandbox の `sk_test_`、production は `sk_live_`。
- `AUTH_SECRET`: 環境ごとに別の値を発行する。環境をまたいで同じ秘密の値を使い回さない。
- `APP_RELEASE`: デプロイごとに違うコミット。
- `OTLP_ENDPOINT`: 送り先がある環境にだけ設定する。

## 環境で変わらない値は環境変数にしない

避ける例と、代わりの置き場所:

- `OTLP_ENABLED=true` を `OTLP_ENDPOINT` と一緒に置く。`OTLP_ENDPOINT` が設定されているかどうかで送信するかを決め、オンオフ用のキーは作らない。
- `APP_ENV=production` や `NODE_ENV` を見て `if` で分岐する。分岐で変えたいもの（接続先、送り先、秘密の値）を直接キーにし、環境名で処理を分けない。
- `FEATURE_NEW_CHECKOUT=true` のような機能の出し分け。feature flag にする。
- `SESSION_TTL_SECONDS=86400`・`MAX_UPLOAD_MB=10`・`RETRY_COUNT=3`・`PAGE_SIZE=20`・`DEFAULT_LOCALE=ja`・`CURRENCY=JPY`。コードに定数で書く。
- `APP_DOMAIN=example.com` があるのに `ADMIN_ORIGIN=https://admin.example.com` も置く。ドメインだけを渡し、オリジンは 1 か所の処理で組み立てる。
- `DATABASE_ID`・`BUCKET_NAME`・`CORE_URL` を渡して、コードの中で接続する。D1・R2・サービスの binding で渡す。
- Stripe のダッシュボードから `STRIPE_PRICE_ID`・`STRIPE_WEBHOOK_SECRET` を手で書き写す。product・price・webhook を Alchemy で作り、その出力を binding や `vars` にそのまま渡す。
- `MOCK_PAYMENTS=true`・`SKIP_EMAIL=true` のような、テストのためだけに動きを変えるキー。テストでは実際の依存を使い、外部 HTTP は MSW で差し替える。

## キーを足すとき

- 既存のキー、Alchemy の出力、binding から得られる値なら足さない。
- 誰がどこに値を設定するかを決めてから足す。
- Worker の `env` の型、`.dev.vars` の生成、CI が渡すキーの一覧と未設定のチェック、Alchemy の宣言のうち、そのキーが関わる箇所を同じ変更ですべて更新する。
- 未設定のときは、起動時かデプロイ前にキー名を示してエラーにする。既定値で動かさない。任意のキーだけは、未設定のときの動きをエントリポイントで決める。

## キーを消すとき

- 読んでいる箇所・型・`.dev.vars` の生成・CI が渡す一覧とチェック・GitHub Environments の設定を同じ変更で消す。
- 廃止したキーが CI やローカルに残っていたらエラーにするチェックを入れる。
