---
title: Alchemy
description: Cloudflare 上に残る資源を Effect のプログラムとして宣言する
---

Alchemy は、Cloudflare 上に残る資源を TypeScript で宣言する機構である。管理画面で Worker やデータベースを作成するのではなく、Effect のプログラムが目標状態を記述し、適用によってアカウントがその宣言へ一致する。実行環境の定義は [Cloudflare](/tech-stack/cloudflare) に記載する。

宣言と実アカウントの差分は `alchemy plan` が算出する。適用はその差分をアカウントへ反映する。状態ファイルは、宣言と実体の対応を保持する。1 つの単位へまとめる条件、適用を行う主体、状態ファイルの扱いに関する判断は [インフラ](/guidelines/infrastructure) が持つ。

## 参照

- この節が参照するのは v2 である。公式ドキュメントは [Alchemy v2](https://v2.alchemy.run/) である。
- 導入手順は [Cloudflare チュートリアル](https://v2.alchemy.run/cloudflare/tutorial/part-1/) と [Worker](https://v2.alchemy.run/cloudflare/compute/workers/) に記載される。v1 の `async` / `await` から Effect への差分は [Migrating from v1](https://v2.alchemy.run/guides/migrating-from-v1/) にある。
- サンプルは [examples/cloudflare-worker](https://github.com/alchemy-run/alchemy/tree/main/examples/cloudflare-worker) である。Effect の Stack によって Worker を宣言する。
