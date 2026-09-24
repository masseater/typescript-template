# 環境変数を必要最小限にする

## 環境変数とは

- 環境変数は、プロセスの外から文字列で渡す設定値のこと。型も既定値もなく、どのキーが必要かはコードを読まないと分からない。設定し忘れても、その値を読むまで誰も気づかない。
- このレビューでは次のものを環境変数として扱う。
  - Node で動くツール・CI・Alchemy の宣言が読む `process.env`
  - CI が GitHub Environments の secret と variable から渡す値
  - Worker が `env` で受け取る `vars` と `secret`、ローカルでそれらを渡す `.dev.vars`
- Worker の `env` に載る D1・R2・KV・Queues・Durable Objects・他 Worker の binding は、型の付いた依存として渡るので環境変数として扱わない。

## 環境ごとに値が変わるものだけを環境変数にする

ローカル・staging・production・CI で入る値を並べ、実際に値が違うものだけを環境変数にする。

環境変数にしてよい例:

- `APP_ORIGIN`: ローカルは `http://localhost:3000`、staging は `https://staging.example.com`、production は `https://example.com`。
- `CLOUDFLARE_ACCOUNT_ID`・`CLOUDFLARE_ZONE_ID`: 環境ごとに別のアカウントとゾーンを使う。
- `EMAIL_FROM`・`OPS_EMAIL`: 送信元のドメインとアラートの宛先が環境ごとに違う。
- `STRIPE_API_KEY`: ローカルと staging は sandbox の `sk_test_`、production は `sk_live_`。
- `AUTH_SECRET`: 秘密の値は環境ごとに別の値を発行するので、環境変数にしてよい。
- `APP_RELEASE`: デプロイごとにコミットが違う。
- `OTLP_ENDPOINT`: 送り先がある環境にだけ設定する。

## 環境で変わらない値は環境変数にしない

よくある例と、代わりの置き場所:

- `OTLP_ENABLED=true` を `OTLP_ENDPOINT` と一緒に置く。`OTLP_ENDPOINT` が設定されているかどうかで送信するかを決め、オンオフ用のキーは作らない。
- `APP_ENV=production` や `NODE_ENV` を見て `if` で分岐する。分岐で変えたいもの（接続先、送り先、秘密の値）を直接キーにし、環境名で処理を分けない。
- `FEATURE_NEW_CHECKOUT=true` のような機能の出し分け。feature flag にする。
- `SESSION_TTL_SECONDS=86400`・`MAX_UPLOAD_MB=10`・`RETRY_COUNT=3`・`PAGE_SIZE=20`・`DEFAULT_LOCALE=ja`・`CURRENCY=JPY`。どの環境でも同じ値なので、コードに定数で書く。
- `APP_DOMAIN=example.com` があるのに `ADMIN_ORIGIN=https://admin.example.com` も置く。ドメインだけを渡し、オリジンはコードで組み立てる。組み立てる処理は 1 か所にまとめる。
- `DATABASE_ID`・`BUCKET_NAME`・`CORE_URL` を渡して、コードの中で接続する。D1・R2・サービスの binding で渡す。
- Stripe のダッシュボードから `STRIPE_PRICE_ID`・`STRIPE_WEBHOOK_SECRET` を手で書き写す。product・price・webhook を Alchemy で作り、その出力を binding や `vars` にそのまま渡す。
- `MOCK_PAYMENTS=true`・`SKIP_EMAIL=true` のような、テストのためだけに動きを変えるキー。テストでは実際の依存を使い、外部 HTTP は MSW で差し替える。

## キーを増やす前に確認すること

新しいキーを足すときは、次のすべてに答えられなければ足さない。

- ローカル・staging・production・CI のそれぞれに入る値を書き出せるか。すべて同じなら定数にする。
- 既存のキー、Alchemy の出力、binding のどれからも得られない値か。
- 誰がどこに値を設定するか決まっているか。
- Worker の `env` の型、`.dev.vars` の生成、CI が渡すキーの一覧と未設定のチェック、Alchemy の宣言のうち、そのキーが関わる箇所をすべて同じ変更で更新しているか。
- 値が無いとき、起動時かデプロイ前にキー名を示してエラーになるか。エラーにならずに既定値で動き続けないか。

## 読み方

- 環境変数はプロセスのエントリポイントで 1 回だけ schema で検証し、型の付いた値として下の層に渡す。下の層で `process.env` や `env` を直接読まない。
- 任意のキーは、未設定のときの動きをエントリポイントで決める。空文字は未設定として扱う。
- 秘密の値は読んだ時点で `Redacted` に包む。
- vp のキャッシュ付きタスクでは、そのタスクが読むキーだけを `env` に宣言する。宣言していないキーは子プロセスに渡らない。渡らないからといって、ワイルドカードでまとめて通さない。

## 減らし方

- 動きを切り替えるキーは、feature flag か、関係する値が設定されているかどうかの判定に置き換える。
- どの環境でも同じ値のキーは、コードの定数にする。
- 他のキーから組み立てられるキーは、組み立てる処理に置き換える。
- ID や接続先を渡しているキーは、binding か Alchemy の出力を直接渡す形に置き換える。
- 使わなくなったキーは、読んでいる箇所・型・`.dev.vars` の生成・CI が渡す一覧とチェック・GitHub Environments の設定を同じ変更で消す。廃止したキーが CI やローカルに残っていたらエラーにするチェックを入れる。
