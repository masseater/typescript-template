---
title: Web Performance API
description: ブラウザが描画と入力の計測をエントリとして残す API
---

Web Performance API は、ブラウザが描画と入力の計測をエントリとして残す。スクリプトは `PerformanceObserver` でそのエントリを受け取る。LCP は、ビューポート内で最大の内容が描かれた時刻である。

```js
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.entryType, entry.startTime);
  }
});
observer.observe({ type: "largest-contentful-paint", buffered: true });
```

`buffered: true` にすると、observer を登録する前にブラウザが記録していた LCP も届く。`startTime` はナビゲーション開始からのミリ秒である。入力の遅れは INP、レイアウトのずれは CLS である。先頭バイトまでの時間は TTFB で、ナビゲーションの `responseStart` がそれにあたる。

Resource Timing は、ページが読んだ資源ごとの時間である。DNS、TCP、先頭バイトは、一つの resource エントリの時刻の差で出る。

```js
const resource = performance.getEntriesByType("resource")[0];
const dns = resource.domainLookupEnd - resource.domainLookupStart;
const tcp = resource.connectEnd - resource.connectStart;
const ttfb = resource.responseStart - resource.startTime;
```

メインスレッドを 50 ミリ秒以上止めた処理は Long Task で、INP が伸びる原因になる。実利用者のブラウザで取るのが RUM で、決めた間隔で外から同じ URL を開くのが synthetic である。これらをサーバへ送る運搬は [HTTP](/observability/http) である。

## 参考文献

- 公式 — [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API)
- 公式 — [PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver)
- 公式 — [Performance Timeline](https://www.w3.org/TR/performance-timeline/)
- 公式 — [Largest Contentful Paint](https://www.w3.org/TR/largest-contentful-paint/)
- 公式 — [Event Timing](https://www.w3.org/TR/event-timing/)
- 公式 — [Resource Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)
- 公式 — [Resource Timing](https://www.w3.org/TR/resource-timing-2/)
- 公式 — [Long Tasks](https://developer.mozilla.org/en-US/docs/Web/API/Long_Tasks_API)
- サンプル — [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals)
- 記事 — [Web Vitals](https://web.dev/articles/vitals)
