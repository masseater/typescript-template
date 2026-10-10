# alchemy から移植したコード

`apps/web/src/pages/home/api/tracing.server.ts` は alchemy のトレーサーの移植である。
移植元は alchemy 2.0.0-beta.81 の `src/Cloudflare/Workers/CloudflareTracer.ts` である。
移植元の著作権は Functionless Corp. にあり、Apache License 2.0 で提供されている。
ライセンス本文は同じフォルダの `LICENSE`、帰属表示は `NOTICE` にある。

移植では、Layer をやめて `Effect.withTracer` でリクエストごとに渡す関数とした。
`cloudflare:workers` は直接 import し、Workers の外で動かすための代替は除いた。
書き方は、このリポジトリの lint に合わせて変えた。

alchemy がこのトレーサーを公開したら、移植したファイルとこのフォルダを削除する。
公開の要望は alchemy-run/alchemy#1666 で出ている。
