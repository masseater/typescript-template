---
title: ローカル開発
description: 手元でアプリを起動し、ブラウザで操作するまでの手順です。
---

## 初回の準備

依存の追加、script の実行、lint、テスト、ビルドはすべて Vite+ の `vp` コマンドから行います。`vp` を入れてから依存をインストールします。インストール時に Git フックも設定されます。

```bash
curl -fsSL https://vite.plus | bash
vp install
```

ローカル用の認証情報と各アプリの `.dev.vars` を作り、メール受信用のサービスを起動します。

```bash
vp run --filter @template/dev setup
vp run --filter @template/local up
```

`vp run --filter @template/local up` は Mailpit を起動します。Mailpit は `http://localhost:8025` で開けます。ログとトレースは各アプリに組み込まれた Cloudflare の Local Explorer に記録され、`http://localhost:<ポート>/cdn-cgi/local/explorer` で開けます。

## アプリの起動と停止

ビルド済みの Worker をアプリごとに起動します。起動したアプリは tmux の中で動き続けます。

```bash
vp run build
vp run --filter @template/dev start user
vp run --filter @template/dev status
vp run --filter @template/dev stop user
```

| アプリ | URL                     |
| ------ | ----------------------- |
| user   | `http://localhost:3001` |
| admin  | `http://localhost:3002` |
| wiki   | `http://localhost:3003` |

`vp run --filter @template/dev start` は portless の LAN モードも起動し、`https://template-user.local`、`https://template-admin.local`、`https://template-wiki.local`、`https://template-mailpit.local` で同じ LAN の端末から開けるようにします。別の PC で開くときは、`vp run --filter @template/dev connect` が表示する証明書の信頼コマンドをその PC で一度だけ実行してください。Local Explorer はローカル以外の Host からの要求を拒否するため、LAN の端末からは開けません。

## ブラウザで操作する

`vp run --filter @template/dev browser user` で agent-browser を開きます。admin と wiki は、管理者アカウントでログインしてから使います。
