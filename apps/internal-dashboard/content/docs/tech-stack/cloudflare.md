---
title: Cloudflare
description: アプリが動く Workers と、コードへ渡される binding
---

実行環境は Cloudflare Workers です。常駐するサーバープロセスはなく、リクエストが来たときに Worker が応答します。開発中も、同じ実行系（workerd）で動かせます。資源の宣言は [Alchemy](/tech-stack/alchemy) です。

Worker の外にあるもの（データベース、メール、フラグなど）は、接続文字列をコードへ書かず、binding として渡します。D1 は SQLite のデータベースです。Durable Objects は、1 つの実体が自分の状態を持ち続けるときに使います。

## 公式と読みもの

- 公式は [Cloudflare Workers](https://developers.cloudflare.com/workers/) です。リクエストがどう隔離されるかは [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/)、コードが受け取る口は [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) です。
- データは [D1](https://developers.cloudflare.com/d1/)、状態を持つ実体は [Durable Objects](https://developers.cloudflare.com/durable-objects/)、ログとトレースは [Workers Observability](https://developers.cloudflare.com/workers/observability/) です。手元で同じ実行系を動かす話は [Local development](https://developers.cloudflare.com/workers/local-development/) にあります。
- Start を Workers で動かすサンプルは [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare) です。
- D1 を何のために足したかは [Introducing D1](https://blog.cloudflare.com/introducing-d1/)、Durable Objects に SQLite を載せた理由は [SQLite in Durable Objects](https://blog.cloudflare.com/sqlite-in-durable-objects/) にあります。
