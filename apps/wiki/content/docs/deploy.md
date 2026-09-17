---
title: デプロイ
description: Cloudflare Workers へ本番環境を反映する手順です。
---

## 前提

Pulumi の状態は Cloudflare R2 に保存します。最初に一度だけ `vp run --filter @template/infra-bootstrap setup` で保存先を作ります。

## 反映の順序

共有リソースを先に作り、そのあとで各アプリを反映します。変更内容は `preview` で確認してから `deploy` を実行します。

```bash
vp run build
vp run --filter @template/infra-cloudflare preview shared
vp run --filter @template/infra-cloudflare deploy shared
vp run --filter @template/infra-cloudflare deploy user
vp run --filter @template/infra-cloudflare deploy admin
vp run --filter @template/infra-cloudflare deploy wiki
```

共有スタックの設定には、アプリごとの公開 URL として `origins` に `user`、`admin`、`wiki` を指定します。3 つは別々のドメインにします。

エラー通知と予算通知は、`budget.recipients` のアドレスに Cloudflare の Email 送信で届きます。宛先は Cloudflare Email Routing で確認済みのアドレスにします。

各アプリの反映では、`vp run build` の成果物からリリースの識別子を計算します。そのリリースの source map を `.local/source-maps/` に保管するため、反映はビルドした端末で実行します。

## データベースの更新

スキーマを変えたときは、アプリを反映する前に `vp run --filter @template/infra-cloudflare db:migrate:remote` でマイグレーションを適用します。
