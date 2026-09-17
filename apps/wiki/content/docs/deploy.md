---
title: デプロイ
description: Cloudflare Workers へ本番環境を反映する手順です。
---

## 前提

Pulumi の状態は Cloudflare R2 に保存します。最初に一度だけ `vp run --filter @template/infra-bootstrap setup` で保存先を作ります。

## 反映の順序

stack は `settings`、`database`、`tokens`、`budget-monitor`、`error-monitor`、`health-monitor`、`user`、`admin`、`wiki` に分かれています。`all` を指定すると、依存する stack が先になる順序で 1 つずつ反映し、失敗した stack で止まります。変更内容は `preview` で確認してから `deploy` を実行します。

```bash
vp run build
vp run --filter @template/infra-cloudflare preview settings
vp run --filter @template/infra-cloudflare deploy all
```

stack 名は全 stack で揃えます。各 stack は同じ stack 名の依存先から出力を読みます。

`settings` stack の設定には、アプリごとの公開 URL として `origins` に `user`、`admin`、`wiki` を指定します。3 つは別々のドメインにします。

エラー通知と予算通知は、`budget.recipients` のアドレスに Cloudflare の Email 送信で届きます。宛先は Cloudflare Email Routing で確認済みのアドレスにします。

各アプリの反映では、`vp run build` の成果物からリリースの識別子を計算します。そのリリースの source map を `.local/source-maps/` に保管するため、反映はビルドした端末で実行します。

## データベースの更新

スキーマを変えたときは、アプリを反映する前に `vp run --filter @template/infra-cloudflare db:migrate:remote` でマイグレーションを適用します。
