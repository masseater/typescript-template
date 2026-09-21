---
title: Alchemy
description: Cloudflare 上に残る資源を Effect のプログラムとして宣言する
---

Worker の目標状態は、プログラムに書く。

```ts
const worker = yield* Worker("Worker", {
  name: "app",
  main: "./dist/index.js",
  env: { DB: database },
});
```

`env.DB` が、Worker のコードから見る binding になる。binding の説明は [Cloudflare](/tech-stack/cloudflare) にある。`alchemy plan` は、今のアカウントとこの宣言の差を表示する。適用すると、アカウントが宣言に一致する。状態ファイルは、宣言した `"Worker"` とアカウント上の実体との対応を覚えておく。

コンソールで Worker を作っても、このプログラムには一行も現れない。

これは v2 の書き方である。v1 のサンプルは `async` / `await` で資源を宣言する。

一つの単位へまとめる条件、適用を行う主体、状態ファイルの置き場所は [インフラ](/guidelines/infrastructure) が定める。

## 参考文献

- 公式 — [Alchemy v2](https://v2.alchemy.run/)
- 公式 — [Cloudflare チュートリアル](https://v2.alchemy.run/cloudflare/tutorial/part-1/)
- 公式 — [Worker](https://v2.alchemy.run/cloudflare/compute/workers/)
- 公式 — [Migrating from v1](https://v2.alchemy.run/guides/migrating-from-v1/)
- サンプル — [examples/cloudflare-worker](https://github.com/alchemy-run/alchemy/tree/main/examples/cloudflare-worker)
