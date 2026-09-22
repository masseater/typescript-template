---
title: Browser
description: 利用者が待った時間の時計が始まる場所
---

Browser は、利用者が待った時間の時計が始まる場所である。ページのスクリプトが持つ `performance.now()` は、その文書の中で単調に増える。ナビゲーションがいつ応答の先頭バイトを受けたかは、ブラウザが `navigation` エントリとして残す。

```js
const navigation = performance.getEntriesByType("navigation")[0];
const firstByte = navigation.responseStart;
```

`responseStart` は、そのナビゲーションの開始を 0 としたミリ秒で、応答の先頭バイトが届いた時刻である。スクリプトが自分で `Date.now()` を引いても、この値は出てこない。描画や入力の計測へ渡すのが [Web Performance API](/observability/web-performance-api) で、サーバへ出る要求そのものは [HTTP](/observability/http) である。

## 参考文献

- 公式 — [Performance](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- 公式 — [Navigation timing](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_timing_API)
- 公式 — [Navigation Timing](https://www.w3.org/TR/navigation-timing-2/)
