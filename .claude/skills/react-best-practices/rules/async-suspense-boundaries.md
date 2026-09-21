# 殻をデータの完了まで止めない

大本: https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-suspense-boundaries.md

ナビ、ヘッダー、フッターは、本体のデータが終わるまで描画を止めてはいけない。データが要る部分だけ `<Suspense>` の内側に置く。

サーバーデータの取得は TanStack Query である。`use(promise)` で fetch しない。`queryOptions` は FSD の `api` セグメントに置く。

レイアウトの分岐に必須な値だけ、殻の外で待つ。小さなクエリで Suspense の切り替わりの方が目立つときは、殻と一緒に待ってよい。
