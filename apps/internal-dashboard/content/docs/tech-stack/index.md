---
title: 技術スタック
description: 初めて読む人が、画面からインフラまでの担当を判断するための節
---

この節は、コードを開いたときに、そのファイルがどの技術の仕事をしているかを判断するためのものです。採用の優先度と、まだ入っていないものの台帳は [モダン化計画](/plans/modernization) が持ちます。部品をどこに置くかの判断は [フロントエンド](/guidelines/frontend)、外に残る状態をどう宣言するかの判断は [インフラ](/guidelines/infrastructure) が持ちます。ライブラリの版は `pnpm-workspace.yaml` の catalog が持ち、この節には書きません。

ここに無い Elysia、Drizzle、Better Auth、Vite+ なども動いています。領域ごとの一行の対応は [このテンプレートは何か](/getting-started/what-is-this) にあります。

## ページ

- [TanStack Start](/tech-stack/tanstack-start) — URL と画面、画面が最初に読むデータ
- [TypeScript](/tech-stack/typescript) — アプリからインフラ宣言までを通した言語
- [Effect](/tech-stack/effect) — 失敗と依存を型に載せるサーバーの書き方
- [TanStack Query](/tech-stack/tanstack-query) — 開いたあとのサーバーデータをクライアントが共有する仕組み
- [Base UI と shadcn](/tech-stack/ui) — 挙動と、このリポジトリが持つ見た目の部品
- [Alchemy](/tech-stack/alchemy) — Cloudflare に残る資源の宣言
- [Cloudflare](/tech-stack/cloudflare) — アプリが実際に動く場所と、渡される binding

## 1 つの画面が届くまで

会員アプリのホームを開くとき、処理は次の順で層を渡ります。

1. ブラウザのリクエストは Cloudflare Workers に届きます。アプリのプロセスは常駐せず、リクエストのたびに Worker が応答します。
2. URL は TanStack Start のファイルルートに着地します。`apps/service-member/src/app/routes/_member/home.tsx` は画面そのものを持たず、pages 層の `HomePage` を指すだけです。
3. ホームのフィードは、ルートの loader では読みません。`HomePage` が Effect Atom の `requestAtom` で `loadHomeFeed` を呼び、その先は Elysia の `api.home.feed` です。クライアントは `userClient` で、サーバー上ではアプリをプロセス内で呼び、ブラウザでは同じ API を HTTP で呼びます。
4. 別の URL では、ルートの loader が初期データを渡します。プロフィール編集や会員一覧、掲示板がこの形で、中で呼んでいるのも同じ種類の API クライアントです。wiki の本文は `createServerFn` の `loadWikiPage` を loader から呼びます。
5. 失敗しうる処理と、DB やセッションへの依存は Effect で書きます。wiki がページを見せてよいかは `guardAccess` が、セッションの失敗の種類を型の上で分けています。
6. ボタンやダイアログの挙動は Base UI、見た目の部品は `libs/ui` に置いた shadcn の部品です。画面は `@repo/ui` から import します。
7. Worker や D1 などの実体は、ダッシュボードの手作業ではなく Alchemy の宣言が作ります。アプリは binding 名（`DB`、`EMAIL` など）でそれらを受け取ります。

画面を開いたあと、サーバーの出来事を購読し続ける経路は TanStack Query です。いまその経路を使っているのは司令塔です。
