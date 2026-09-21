---
title: TanStack Start
description: URL を画面に結び、初期データとサーバーだけの処理を載せるフレームワーク
---

TanStack Start は、React の画面と、その画面がサーバーで行う処理を 1 つのフレームワークにまとめたものです。会員アプリ、管理アプリ、wiki、司令塔がこれを使います。デプロイ先は Cloudflare Workers で、開発中も `@cloudflare/vite-plugin` により同じ workerd の上で動きます。

## ファイルが URL になる

ルートは `src/app/routes` のファイル名が URL です。`_member` のようにアンダースコアで始まる区間は、URL に出ないレイアウトです。ルートファイルは app 層の薄い接続にとどめ、画面の中身は pages 層に置きます。この分け方は [モダン化計画](/plans/modernization) のフロントエンドの節が持っています。

会員ホームのルートは、`createFileRoute("/_member/home")` で `HomePage` を指すだけです。フィードの取得は、このファイルには書いてありません。

## データを読む入口は 1 つではない

画面のデータを Start が全部持つわけではありません。いまコードにある入口は次の 3 つです。

- **ページ自身が読む。** ホームは `requestAtom` から `loadHomeFeed` を呼びます。これは Start の loader ではありません。読み方は [Effect](/tech-stack/effect) にあります。
- **loader。** その URL へ移るときに走り、初期データを画面へ渡します。プロフィール編集ルートの `loader: loadProfile`、会員一覧、掲示板がこの形です。loader の関数が直接 DB を開くわけではなく、型の付いた API クライアントを呼びます。そのクライアントはサーバーではプロセス内、ブラウザでは HTTP です。
- **server function。** `createServerFn` で定義し、クライアントから引数を渡してサーバーだけで実行します。wiki の本文は `loadWikiPage` がこの形で、ルートの loader がそれを呼びます。認証の内側でページを読み、無いパスは `notFound` になります。

`/api/$` は、これらとは別の入口です。`elysiaServer` が Elysia のアプリをそのルートへ載せ、ブラウザ以外のクライアントも同じ HTTP API を呼びます。画面の loader を、外部向け API の代わりには使っていません。

開いたあとにクライアントがデータを保持し、再取得し、複数の部品で共有する仕組みは [TanStack Query](/tech-stack/tanstack-query) です。Start の loader はその代わりではありません。
