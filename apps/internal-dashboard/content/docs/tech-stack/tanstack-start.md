---
title: TanStack Start
description: URL を画面に対応させ、初期データとサーバー専用の処理を扱うフレームワーク
---

TanStack Start は、React による画面と、その画面がサーバーで実行する処理を一体として扱うフルスタックフレームワークである。実行環境は Cloudflare Workers であり、開発時も同一の workerd 上で動作する。

ルーティングはファイルシステムに対応する。ファイル名が URL となり、名称がアンダースコアで始まる区間は URL に現れないレイアウトである。

データ取得には次の区別がある。

- **loader** は、該当 URL への遷移時に実行され、画面の初期データを返す。
- **server function** は `createServerFn` で定義する。呼び出しはクライアントから行えるが、本体はサーバーでのみ実行される。アプリケーション外部から呼び出す HTTP API とは別であり、外部向けの入口にはサーバールートを用いる。

画面表示後にクライアントがデータを保持し、再取得し、同一キーの部品間で共有する機構は [TanStack Query](/tech-stack/tanstack-query) である。loader はその代替ではない。

## 参照

- 公式ドキュメントは [TanStack Start](https://tanstack.com/start/latest) である。概要は [Overview](https://tanstack.com/start/latest/docs/framework/react/overview)、server function は [Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) に定義される。
- Workers 上の構成は [Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) と [TanStack Start · Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/) に記載される。
- サンプルは [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare) である。
- 解説記事は [TanStack Start v1 Release Candidate](https://tanstack.com/blog/announcing-tanstack-start-v1) と [Why choose TanStack Start and Router?](https://tanstack.com/blog/why-tanstack-start-and-router) である。
