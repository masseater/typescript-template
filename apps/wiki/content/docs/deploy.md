---
title: デプロイ
description: Cloudflare Workers へ本番環境を反映する手順です。
---

## 前提

Pulumi の状態は Cloudflare R2 に保存します。最初に一度だけ `pnpm infra:bootstrap` で保存先を作ります。

## 反映の順序

共有リソースを先に作り、そのあとで各アプリを反映します。変更内容は `preview` で確認してから `deploy` を実行します。

```bash
pnpm build
pnpm infra:preview:shared
pnpm infra:deploy:shared
pnpm infra:deploy:user
pnpm infra:deploy:admin
pnpm infra:deploy:wiki
```

共有スタックの設定には、アプリごとの公開 URL として `userOrigin`、`adminOrigin`、`wikiOrigin` を指定します。3 つは別々のドメインにします。

エラー通知の送信先として、Slack の Incoming Webhook の URL を secret で設定します。Discord の Webhook を使う場合は、URL の末尾に `/slack` を付けます。

```bash
pnpm infra:state pulumi config set alertWebhookUrl --secret --cwd ../cloudflare/shared
```

各アプリの反映では、`pnpm build` の成果物からリリースの識別子を計算します。そのリリースの source map を `.local/source-maps/` に保管するため、反映はビルドした端末で実行します。

## データベースの更新

スキーマを変えたときは、アプリを反映する前に `pnpm db:migrate:remote` でマイグレーションを適用します。
