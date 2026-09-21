---
title: Alchemy
description: Cloudflare に残る資源を、Effect のプログラムとして宣言する
---

Alchemy は、Cloudflare に残る資源を TypeScript で宣言する仕組みです。管理画面で Worker やデータベースを作るのではなく、`infra/cloudflare` の Effect プログラムが望む状態を書き、適用するとアカウントがその宣言へ揃います。実行環境そのものの説明は [Cloudflare](/tech-stack/cloudflare) にあります。

## 宣言と、いまのアカウントの差

宣言と現実の差は `alchemy plan` が見せます。適用は、その差をアカウントへ反映します。

共有データベースは `D1.Database` として、アプリとは別の stack に宣言しています。各アプリの Worker は、その stack が公開した参照を `DB` binding として受け取ります。Worker の定義は `applicationProgram` にあり、静的ファイル、カスタムドメイン、観測性、秘密を同じ宣言に含みます。監視 Worker は別のプログラムが、Durable Object とメール送信を宣言します。

状態ファイルは、宣言と実体の対応です。何を 1 つの stack にまとめるか、適用を誰が行うか、状態ファイルをどう扱うかの判断は [インフラ](/guidelines/infrastructure) が持ちます。
