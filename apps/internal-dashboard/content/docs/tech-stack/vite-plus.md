---
title: Vite+
description: 開発サーバー、検査、テスト、依存関係のインストールを vp に統合したツールチェーン
---

打つコマンドは `vp` である。

```sh
vp dev
vp test
vp install effect
```

Vite+ は Vite に、テスト、lint、フォーマット、モノレポのタスク実行を足したものである。入口は `vite` ではない。中身は Vite、Rolldown、Vitest、Oxlint、Oxfmt である。

`vp install` は、パッケージの解決を自分ではしない。そのリポジトリが使っているパッケージマネージャを起動する。

## 参考文献

- 公式 — [Vite+](https://viteplus.dev/)
- 公式 — [Getting Started](https://viteplus.dev/guide/)
- 公式 — [Installing Dependencies](https://viteplus.dev/guide/install)
- 公式 — [Migrate to Vite+](https://viteplus.dev/guide/migrate)
- 記事 — [Announcing Vite+](https://voidzero.dev/posts/announcing-vite-plus)
- 記事 — [Announcing Vite+ Beta](https://voidzero.dev/posts/announcing-vite-plus-beta)
