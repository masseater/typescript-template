---
title: TanStack Start
description: URL を画面に結び、初期データとサーバーだけの処理を載せるフレームワーク
---

TanStack Start は、React の画面と、その画面がサーバーで行う処理を 1 つのフレームワークにまとめたものです。デプロイ先は Cloudflare Workers で、開発中も同じ workerd の上で動かせます。

ルートはファイル名が URL になります。アンダースコアで始まる区間は、URL に出ないレイアウトです。

データを読む入口は、用途で分かれます。

- **loader** は、その URL へ移るときに走り、画面の初期データを渡します。
- **server function** は `createServerFn` で定義し、クライアントから引数を渡してサーバーだけで実行します。アプリの外から叩く HTTP API とは別です。外向けの入口が要るときは、server function ではなくサーバーのルートを使います。

開いたあとにクライアントがデータを保持し、再取得し、複数の部品で共有する仕組みは [TanStack Query](/tech-stack/tanstack-query) です。loader はその代わりではありません。

## 公式と読みもの

- 公式は [TanStack Start](https://tanstack.com/start/latest) です。最初に読むなら [概要](https://tanstack.com/start/latest/docs/framework/react/overview) と [server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) です。
- Workers への載せ方は [Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) と [Cloudflare のフレームワークガイド](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/) にあります。
- 動くサンプルは [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare) です。あの例は wrangler でデプロイします。このリポジトリの資源の宣言は [Alchemy](/tech-stack/alchemy) です。
- 何を足したフレームワークなのかは [TanStack Start v1 Release Candidate](https://tanstack.com/blog/announcing-tanstack-start-v1) と [Why choose TanStack Start and Router?](https://tanstack.com/blog/why-tanstack-start-and-router) が短いです。
