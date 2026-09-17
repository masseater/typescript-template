---
title: デプロイ
description: Cloudflare Workers へ本番環境を反映する手順です。
---

## 前提

Pulumi の状態は Cloudflare R2 に保存します。最初に一度だけ `vp run infra:bootstrap` で保存先を作ります。

## 反映の順序

共有リソースを先に作り、そのあとで各アプリを反映します。変更内容は `preview` で確認してから `deploy` を実行します。

```bash
vp run build
vp run infra:preview:shared
vp run infra:deploy:shared
vp run infra:deploy:user
vp run infra:deploy:admin
vp run infra:deploy:wiki
```

共有スタックの設定には、アプリごとの公開 URL として `userOrigin`、`adminOrigin`、`wikiOrigin` を指定します。3 つは別々のドメインにします。

## データベースの更新

スキーマを変えたときは、アプリを反映する前に `vp run db:migrate:remote` でマイグレーションを適用します。
