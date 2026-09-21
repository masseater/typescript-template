---
title: Cloudflare
description: アプリケーションを Workers として実行し、外部依存を binding として渡す
---

実行環境は Cloudflare Workers である。常駐するサーバープロセスは存在せず、リクエストの到着時に Worker が応答する。開発時も同一の実行系（workerd）で動作する。資源の宣言は [Alchemy](/tech-stack/alchemy) が行う。

Worker の外部にある依存（データベース、メール、フラグなど）は、接続文字列をコードへ記述せず、binding として渡す。D1 は SQLite のデータベースである。Durable Objects は、単一の実体が自身の状態を保持し続ける場合に用いる。

## 参照

- 公式ドキュメントは [Cloudflare Workers](https://developers.cloudflare.com/workers/) である。リクエストの隔離は [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/)、コードが受け取るインタフェースは [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) に定義される。
- データストアは [D1](https://developers.cloudflare.com/d1/)、状態を持つ実体は [Durable Objects](https://developers.cloudflare.com/durable-objects/)、ログとトレースは [Workers Observability](https://developers.cloudflare.com/workers/observability/) である。同一実行系によるローカル実行は [Local development](https://developers.cloudflare.com/workers/local-development/) に記載される。
- TanStack Start を Workers 上で動作させるサンプルは [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare) である。
- 解説記事は [Introducing D1](https://blog.cloudflare.com/introducing-d1/) と [SQLite in Durable Objects](https://blog.cloudflare.com/sqlite-in-durable-objects/) である。
