---
title: ローカル開発
description: 手元でアプリを起動し、ブラウザで操作するまでの手順です。
---

## 初回の準備

ローカル用の認証情報と各アプリの `.dev.vars` を作り、メール受信用のサービスを起動します。

```bash
pnpm dev:setup
pnpm services:up
```

`pnpm services:up` は Mailpit を起動します。Mailpit は `http://localhost:8025` で開けます。ログとトレースは各アプリに組み込まれた Cloudflare の Local Explorer に記録され、`http://localhost:<ポート>/cdn-cgi/local/explorer` で開けます。

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

Tailscale に接続しているマシンでは、`localhost` の代わりに `https://<マシン名>.<tailnet>.ts.net:<ポート>` で起動します。同じ tailnet の別の PC から、そのままブラウザで開けます。`pnpm dev:connect` を実行すると、Mailpit も tailnet に公開し、各 URL を表示します。Local Explorer はローカル以外の Host からの要求を拒否するため、tailnet 経由では開けません。

## ブラウザで操作する

`pnpm dev:browser user` で agent-browser を開きます。admin を開くと、ローカル用の管理者認証情報が自動で設定されます。
