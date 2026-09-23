---
title: Alchemy
description: Cloudflare 上に残る資源を Effect のプログラムとして宣言する
---

Alchemy は、Cloudflare 上の資源の目標を Effect のプログラムに書く。適用するとアカウントがその記述へ合う。`alchemy plan` は、いまのアカウントと記述の差分を出す。状態ファイルは、記述した名前とアカウント上の資源との対応を持つ。管理画面だけで作った Worker は、このプログラムに残らない。

```ts
// prettier-ignore
const worker = yield* Worker("Worker", {
  name: "app",
  main: "./dist/index.js",
  env: { DB: database },
});
```

`env.DB` が、Worker から見る binding になる。binding 自体は [Cloudflare](/tech-stack/cloudflare) に書く。上の形は v2 で、v1 のサンプルは `async` / `await` で資源を作る。

Worker を所有するパッケージの Stack は、そのパッケージの `alchemy.run.ts` に置く。共有資源の Stack は `infra/cloudflare` が持つ。何を一つのプログラムにまとめるか、誰が適用するか、状態ファイルをどこに置くかは [インフラ](/guidelines/infrastructure) が持つ。

## 採ると

| 見ているもの | 採る前 | 採ったあと |
| --- | --- | --- |
| Worker と D1 | 管理画面で作り、名前をソースに写す | `Worker("Worker", { env: { DB: database } })` が目標になる。`alchemy plan` が、いまのアカウントとこの記述の差を出す |
| 管理画面だけで作った Worker | ソースに無くても、アカウントには残る | このプログラムに残らない。状態ファイルが対応を持つのは、記述した名前だけである |
| 資源の作り方 | v1 のサンプルは `async` / `await` で作る | v2 は Effect の `yield*` で作る |

## 参考文献

- 公式 — [Alchemy v2](https://v2.alchemy.run/)
- 公式 — [Cloudflare チュートリアル](https://v2.alchemy.run/cloudflare/tutorial/part-1/)
- 公式 — [Worker](https://v2.alchemy.run/cloudflare/compute/workers/)
- 公式 — [Migrating from v1](https://v2.alchemy.run/guides/migrating-from-v1/)
- サンプル — [examples/cloudflare-worker](https://github.com/alchemy-run/alchemy/tree/main/examples/cloudflare-worker)
