# 環境変数を必要最小限にする

## 環境変数とは

- 環境変数は、プロセスの外から文字列で渡す設定値。型も既定値もなく、設定し忘れてもその値を読むまでエラーにならない。
- 次のものを環境変数として扱う。
  - Node で動くツール・CI・Alchemy の宣言が読む `process.env`
  - CI が GitHub Environments の secret と variable から渡す値
  - Worker が `env` で受け取る `vars` と `secret`、ローカルでそれらを渡す `.dev.vars`
- Worker の `env` に載る D1・R2・KV・Queues・Durable Objects・他 Worker の binding は環境変数として扱わない。

## 環境変数にしてよいもの

次のどちらかに当たる値だけを環境変数にする。

- リポジトリに書けない値。秘密の値と、秘密と同じに扱う識別子。
  - `AUTH_SECRET`・`STRIPE_API_KEY`・`OTLP_AUTHORIZATION`・`CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- コードを書く時点で誰も値を書き出せない値。
  - `APP_RELEASE`: デプロイのたびに違うコミット。
  - PR ごとに作る preview 環境の URL。

## 事前に分かる値はハードコードする

環境がローカル・staging・production のように予測できて数が決まっているなら、環境ごとに値が違っても環境変数にしない。環境ごとの値を 1 つの表としてコードに書き、Alchemy の stage で選ぶ。

ハードコードする例:

- `APP_ORIGIN`: ローカルは `http://localhost:3000`、staging は `https://staging.example.com`、production は `https://example.com`。
- `EMAIL_FROM`・`OPS_EMAIL`: 環境ごとの送信元とアラートの宛先。
- `OTLP_ENDPOINT`: 環境ごとの送り先。送らない環境は表で空にする。
- `CLOUDFLARE_ZONE_ID`・D1 のデータベース名・R2 のバケット名。

## 環境で変わらない値は、なおさら環境変数にしない

避ける例と、代わりの置き場所:

- `OTLP_ENABLED=true` を `OTLP_ENDPOINT` と一緒に置く。送り先があるかどうかで送信するかを決め、オンオフ用のキーは作らない。
- `APP_ENV=production` や `NODE_ENV` を見て `if` で分岐する。分岐で変えたいものを環境ごとの表に書き、コードの各所で環境名を比べない。
- `FEATURE_NEW_CHECKOUT=true` のような機能の出し分け。feature flag にする。
- `SESSION_TTL_SECONDS=86400`・`MAX_UPLOAD_MB=10`・`RETRY_COUNT=3`・`PAGE_SIZE=20`・`DEFAULT_LOCALE=ja`・`CURRENCY=JPY`。コードに定数で書く。
- `APP_DOMAIN=example.com` があるのに `ADMIN_ORIGIN=https://admin.example.com` も置く。オリジンはドメインから 1 か所の処理で組み立てる。
- `DATABASE_ID`・`BUCKET_NAME`・`CORE_URL` を渡して、コードの中で接続する。D1・R2・サービスの binding で渡す。
- Stripe のダッシュボードから `STRIPE_PRICE_ID`・`STRIPE_WEBHOOK_SECRET` を手で書き写す。product・price・webhook を Alchemy で作り、その出力を binding や `vars` にそのまま渡す。
- `MOCK_PAYMENTS=true`・`SKIP_EMAIL=true` のような、テストのためだけに動きを変えるキー。テストでは実際の依存を使い、外部 HTTP は MSW で差し替える。

## キーを足す変更は差し戻すのを基本にする

キーを足す変更は、次のすべてが示されたときだけ通す。1 つでも欠けていたら差し戻す。

- 「環境変数にしてよいもの」のどちらに当たるか。
- ローカル・staging・production・CI の値を事前に書き出せない理由。書き出せるならハードコードさせる。
- 既存のキー、Alchemy の出力、binding、feature flag のどれでも代わりにならない理由。
- 誰がどこに値を設定するか。
- Worker の `env` の型、`.dev.vars` の生成、CI が渡すキーの一覧と未設定のチェック、Alchemy の宣言のうち、そのキーが関わる箇所を同じ変更ですべて更新していること。
- 未設定のとき、起動時かデプロイ前にキー名を示してエラーになること。既定値で動かさない。

## 今あるキーを減らす

- レビューのたびに今あるキーを上の基準で見直し、ハードコード・定数・binding・Alchemy の出力に置き換えられるものは置き換える。
- キーを消すときは、読んでいる箇所・型・`.dev.vars` の生成・CI が渡す一覧とチェック・GitHub Environments の設定を同じ変更で消す。
- 廃止したキーが CI やローカルに残っていたらエラーにするチェックを入れる。
