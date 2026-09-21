---
title: Alchemy
description: Cloudflare 上に残る資源を Effect のプログラムとして宣言する
---

Alchemy は、Cloudflare 上に残る資源を TypeScript と Effect で宣言する。開発者は目標の状態をプログラムとして書き、適用するとアカウントがその宣言に一致する。管理画面で Worker やデータベースを作ると、その操作は宣言に残らない。実行環境自体の説明は [Cloudflare](/tech-stack/cloudflare) にある。

対象は v2 である。v1 は `async` / `await` で資源を宣言し、v2 は Effect のプログラムとして宣言する。

`alchemy plan` は、宣言と実アカウントの差分を計算する。適用はその差分をアカウントへ反映する。状態ファイルは、宣言した資源と、アカウント上の実体との対応を保持する。

一つの単位へまとめる条件、適用を行う主体、状態ファイルの扱いは、[インフラ](/guidelines/infrastructure) が定める。

## 参考文献

- 公式 — [Alchemy v2](https://v2.alchemy.run/)
- 公式 — [Cloudflare チュートリアル](https://v2.alchemy.run/cloudflare/tutorial/part-1/)
- 公式 — [Worker](https://v2.alchemy.run/cloudflare/compute/workers/)
- 公式 — [Migrating from v1](https://v2.alchemy.run/guides/migrating-from-v1/)
- サンプル — [examples/cloudflare-worker](https://github.com/alchemy-run/alchemy/tree/main/examples/cloudflare-worker)
