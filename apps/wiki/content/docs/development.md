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

`pnpm dev:start` は portless の LAN モードも起動し、`https://template-user.local`、`https://template-admin.local`、`https://template-wiki.local`、`https://template-grafana.local`、`https://template-mailpit.local` で同じ LAN の端末から開けるようにします。別の PC で開くときは、`pnpm dev:connect` が表示する証明書の信頼コマンドをその PC で一度だけ実行してください。

## ブラウザで操作する

`pnpm dev:browser user` で agent-browser を開きます。admin を開くと、ローカル用の管理者認証情報が自動で設定されます。
