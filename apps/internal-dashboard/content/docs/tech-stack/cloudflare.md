---
title: Cloudflare
description: アプリケーションを Workers として実行し、外部依存を binding として渡す
---

アプリケーションの実行環境は Cloudflare Workers である。常駐するサーバープロセスはなく、リクエストが届いたときに Worker が応答する。開発時も本番と同じ実行系（workerd）で動作する。資源の宣言は [Alchemy](/tech-stack/alchemy) で行う。

Worker の外にある依存、たとえばデータベース、メール送信、機能フラグは、接続文字列をコードに書かない。実行環境が binding として、その資源へのインタフェースを Worker に渡す。接続文字列をコードに書くと、資源の所在がソースと実行環境の両方に分かれ、宣言とずれる。

D1 は SQLite のデータベースである。

Durable Objects は、同じ実体へのアクセスを同じオブジェクトへ届ける。Worker はリクエストのあいだで状態を保持しないため、そのオブジェクトが状態を持ち続ける必要があるときに使う。

## 参考文献

- 公式 — [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- 公式 — [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/)
- 公式 — [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
- 公式 — [D1](https://developers.cloudflare.com/d1/)
- 公式 — [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- 公式 — [Workers Observability](https://developers.cloudflare.com/workers/observability/)
- 公式 — [Local development](https://developers.cloudflare.com/workers/local-development/)
- サンプル — [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare)
- 記事 — [Introducing D1](https://blog.cloudflare.com/introducing-d1/)
- 記事 — [SQLite in Durable Objects](https://blog.cloudflare.com/sqlite-in-durable-objects/)
