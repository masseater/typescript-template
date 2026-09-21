---
title: Alchemy
description: Cloudflare に残る資源を、Effect のプログラムとして宣言する
---

Alchemy は、Cloudflare に残る資源を TypeScript で宣言する仕組みです。管理画面で Worker やデータベースを作るのではなく、Effect のプログラムが望む状態を書き、適用するとアカウントがその宣言へ揃います。実行環境そのものの説明は [Cloudflare](/tech-stack/cloudflare) にあります。

宣言と現実の差は `alchemy plan` が見せます。適用は、その差をアカウントへ反映します。状態ファイルは、宣言と実体の対応です。何を 1 つの単位にまとめるか、適用を誰が行うか、状態ファイルをどう扱うかの判断は [インフラ](/guidelines/infrastructure) が持ちます。

## 公式と読みもの

- この節が指すのは v2 です。公式は [Alchemy v2](https://v2.alchemy.run/) です。
- 最初の順は [Cloudflare チュートリアル](https://v2.alchemy.run/cloudflare/tutorial/part-1/) と [Worker](https://v2.alchemy.run/cloudflare/compute/workers/) です。v1 の `async` / `await` から Effect へ移すときの差は [Migrating from v1](https://v2.alchemy.run/guides/migrating-from-v1/) にあります。
- 動くサンプルは [examples/cloudflare-worker](https://github.com/alchemy-run/alchemy/tree/main/examples/cloudflare-worker) です。こちらも Effect の Stack で Worker を宣言します。
