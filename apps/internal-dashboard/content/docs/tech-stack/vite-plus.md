---
title: Vite+
description: 開発サーバー、検査、テスト、依存関係のインストールを vp に統合したツールチェーン
---

Vite+ のコマンド名は `vp` である。開発サーバー、ビルド、テスト、lint、フォーマット、モノレポのタスクをここから実行する。`vite` コマンドは使わない。中身は Vite、Rolldown、Vitest、Oxlint、Oxfmt である。

```sh
vp dev
vp test
vp install effect
```

`vp install` は依存の解決を自分では行わない。そのプロジェクトのパッケージマネージャを起動する。

## 参考文献

- 公式 — [Vite+](https://viteplus.dev/)
- 公式 — [Getting Started](https://viteplus.dev/guide/)
- 公式 — [Installing Dependencies](https://viteplus.dev/guide/install)
- 公式 — [Migrate to Vite+](https://viteplus.dev/guide/migrate)
- 記事 — [Announcing Vite+](https://voidzero.dev/posts/announcing-vite-plus)
- 記事 — [Announcing Vite+ Beta](https://voidzero.dev/posts/announcing-vite-plus-beta)
