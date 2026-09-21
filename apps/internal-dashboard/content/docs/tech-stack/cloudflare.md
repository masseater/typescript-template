---
title: Cloudflare
description: アプリが動く Workers と、コードへ渡される binding
---

実行環境は Cloudflare です。アプリは Workers として動き、常駐するサーバープロセスは持ちません。リクエストが来たとき、[Alchemy](/tech-stack/alchemy) が宣言した Worker が応答します。開発中とテストも、同じ実行系（workerd）で行います。

共有データは D1（SQLite）に置きます。メール送信や機能フラグのような依存は、接続文字列をコードへ書かず、Worker の binding として渡されます。Durable Objects は、1 つの実体が自分の状態を持ち続けるときに使います。

画面確認のログは、手元では Cloudflare Local Explorer、デプロイ後は Workers Observability から取ります。開発の流れの中での位置は [開発の流れ](/getting-started/development-flow) にあります。

## 公式と読みもの

- 公式は [Cloudflare Workers](https://developers.cloudflare.com/workers/) です。リクエストがどう隔離されるかは [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/)、コードが受け取る口は [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) です。
- データは [D1](https://developers.cloudflare.com/d1/)、状態を持つ実体は [Durable Objects](https://developers.cloudflare.com/durable-objects/)、ログとトレースは [Workers Observability](https://developers.cloudflare.com/workers/observability/) です。手元で同じ実行系を動かす話は [Local development](https://developers.cloudflare.com/workers/local-development/) にあります。
- Start を Workers で動かすサンプルは [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare) です。
- D1 を何のために足したかは [Introducing D1](https://blog.cloudflare.com/introducing-d1/)、Durable Objects に SQLite を載せた理由は [SQLite in Durable Objects](https://blog.cloudflare.com/sqlite-in-durable-objects/) にあります。
