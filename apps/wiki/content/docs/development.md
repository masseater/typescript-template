---
title: ローカル開発
description: 手元でアプリを起動し、ブラウザで操作するまでの手順です。
---

## 初回の準備

ローカル用の認証情報と各アプリの `.dev.vars` を作り、観測基盤の設定を用意します。

```bash
pnpm dev:setup
pnpm services:up
```

`pnpm services:up` は Grafana LGTM と Mailpit を起動します。Grafana は `http://localhost:3100`、Mailpit は `http://localhost:8025` で開けます。

## アプリの起動と停止

ビルド済みの Worker をアプリごとに起動します。起動したアプリは tmux の中で動き続けます。

```bash
pnpm build
pnpm dev:start user
pnpm dev:status
pnpm dev:stop user
```

| アプリ | URL                     |
| ------ | ----------------------- |
| user   | `http://localhost:3001` |
| admin  | `http://localhost:3002` |
| wiki   | `http://localhost:3003` |

Tailscale に接続しているマシンでは、`localhost` の代わりに `https://<マシン名>.<tailnet>.ts.net:<ポート>` で起動します。同じ tailnet の別の PC から、そのままブラウザで開けます。`pnpm dev:connect` を実行すると、Grafana と Mailpit も tailnet に公開し、各 URL を表示します。

## ブラウザで操作する

`pnpm dev:browser user` で agent-browser を開きます。admin と wiki は、管理者アカウントでログインしてから使います。
