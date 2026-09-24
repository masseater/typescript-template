# 環境変数を必要最小限にする

## 環境変数とは

- 環境変数は、プロセスを起動した側がコードの外から渡すキーと文字列の組である。型も既定値も持たず、どのキーが要るかはコードを読まないと分からず、渡し忘れは値を読む時点まで表に出ない。
- 次を環境変数として数える。Node で動くツール・CI・Alchemy の宣言が読む `process.env`、CI が GitHub Environments の secret と variable から渡す値、Worker が `env` で受け取る `vars` と `secret`、ローカルでそれらを渡す `.dev.vars`。
- Worker の `env` に載る D1・R2・KV・Queues・Durable Objects・他 Worker の binding は、型の付いた依存であり環境変数に数えない。

## 環境変数に置くのは、環境ごとに実際に値が変わるものだけ

同じコードを動かす環境（ローカル・staging・production・CI）を並べ、環境ごとに入る値が実際に違うものだけを環境変数にする。

置く例:

- `APP_ORIGIN`: ローカルは `http://localhost:3000`、staging は `https://staging.example.com`、production は `https://example.com`。
- `CLOUDFLARE_ACCOUNT_ID`・`CLOUDFLARE_ZONE_ID`: 環境ごとに別のアカウントとゾーンを使う。
- `EMAIL_FROM`・`OPS_EMAIL`: 送信元のドメインと、アラートを受ける宛先が環境ごとに違う。
- `STRIPE_API_KEY`: ローカルと staging は sandbox の `sk_test_`、production は `sk_live_`。
- `AUTH_SECRET`: 環境ごとに別の値を発行する。秘密の値は、環境をまたいで同じ値を使い回さないことでこの条件に当たる。
- `APP_RELEASE`: デプロイごとにコミットが違う。
- `OTLP_ENDPOINT`: 送り先がある環境にだけ入れ、無い環境では未設定にする。

## 環境で変わらない値は環境変数に置かない

置かない例と、代わりの置き場所:

- `OTLP_ENABLED=true` を `OTLP_ENDPOINT` と並べる。送り先の値の有無で送るかを決め、有効化のキーを足さない。
- `APP_ENV=production` や `NODE_ENV` を読んで `if` で分岐する。分岐で変えたい中身（接続先、送り先、秘密）そのものをキーにする。環境名で振る舞いを分けない。
- `FEATURE_NEW_CHECKOUT=true` のような機能の出し分け。feature flag にする。
- `SESSION_TTL_SECONDS=86400`・`MAX_UPLOAD_MB=10`・`RETRY_COUNT=3`・`PAGE_SIZE=20`・`DEFAULT_LOCALE=ja`・`CURRENCY=JPY`。どの環境でも同じ値なのでコードの定数にする。
- `ADMIN_ORIGIN=https://admin.example.com` を `APP_DOMAIN=example.com` と並べる。ドメインだけを渡し、オリジンを組み立てる処理を 1 か所に置く。
- `DATABASE_ID`・`BUCKET_NAME`・`CORE_URL` を渡して自前で接続する。D1・R2・サービスの binding にする。
- Stripe のダッシュボードから `STRIPE_PRICE_ID`・`STRIPE_WEBHOOK_SECRET` を書き写す。product・price・webhook を Alchemy で作り、宣言の出力を binding や `vars` に直接つなぐ。
- `MOCK_PAYMENTS=true`・`SKIP_EMAIL=true` のようにテストのためだけに振る舞いを変えるキー。テストでは実際の依存を使い、外部 HTTP は MSW で差し替える。

## 足す前に問う

新しいキーを足す変更では、次のすべてに答えられないなら足さない。

- ローカル・staging・production・CI それぞれに入る値を書き出せるか。すべて同じなら定数にする。
- 既存のキー、Alchemy の出力、binding のどれからも得られないか。
- 値を入れる主体と手順が決まっているか。人が入れる値なら、どこに誰が入れるかを挙げられるか。
- Worker の `env` の型、`.dev.vars` の生成、CI が渡すキーの一覧と欠けたときのチェック、Alchemy の宣言のうち、そのキーが通る場所すべてに同じ変更で載っているか。
- 欠けたとき、起動時かデプロイ前のチェックでキー名を挙げて止まるか。読む時点で既定値で動き続けないか。

## 読み方

- 環境変数はプロセスのエントリポイント 1 か所で schema にかけ、型の付いた値として下の層へ渡す。下の層で `process.env` や `env` のキーを直接読まない。
- 任意のキーは、欠けたときの振る舞いをエントリポイントで決める。空文字を値ありとして扱わない。
- 秘密の値は読んだ時点で `Redacted` に包む。
- vp のキャッシュ付きタスクには、そのタスクが読むキーだけを `env` に宣言する。宣言していないキーは子プロセスに届かない。届かないことを理由に広いワイルドカードで通さない。

## 減らす直し方

- 振る舞いを切り替えるキーは、feature flag か、依存する値の有無に置き換える。
- 定数と同じ値しか入らないキーは、コードの定数にする。
- 他のキーから導けるキーは、導く処理に置き換える。
- ID や接続先を渡しているキーは、binding か Alchemy の出力の直接の接続に置き換える。
- 使わなくなったキーは、読む箇所・型・`.dev.vars` の生成・CI が渡す一覧とチェック・GitHub Environments の登録を同じ変更で消す。消したキーが CI やローカルに残っていたら、キー名を挙げて止めるチェックを置く。
