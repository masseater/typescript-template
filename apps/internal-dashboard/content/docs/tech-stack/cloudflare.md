---
title: Cloudflare
description: アプリが動く Workers と、コードへ渡される binding
---

実行環境は Cloudflare です。アプリは Workers として動き、常駐するサーバープロセスは持ちません。リクエストが来たとき、[Alchemy](/tech-stack/alchemy) が宣言した Worker が応答します。開発中とテストも、本番と別のアカウントであっても、同じ実行系（workerd）で行います。

## コードが受け取るのは接続文字列ではない

共有データは D1（SQLite）に置きます。メール送信や機能フラグは、接続文字列をコードへ書かず、Worker の binding として渡されます。`applicationProgram` が `DB`、`EMAIL`、`FLAGS` を環境へ置いているのがその対応です。Workers AI の `AI` binding は、`libs/config` が AI を許可したアプリにだけ付きます。

Durable Objects は、監視 Worker が自分の状態を持つために使っています。ユーザーごとの WebSocket 配信には、まだ使っていません。Queues、R2、Workflows、KV をどう入れるかの台帳は [モダン化計画](/plans/modernization) です。

画面確認のログは、手元では Cloudflare Local Explorer、デプロイ後は Workers Observability から取ります。開発の流れの中での位置は [開発の流れ](/getting-started/development-flow) にあります。
