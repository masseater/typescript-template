---
name: react-best-practices
description: >
  非同期の瀑布を消す。独立した Effect や Promise を直列に待たず、使わない枝では await せず、安い同期条件を先に見る。Suspense で殻を先に出す。React の部品、ローダー、API、サーバー処理を書く・直す・レビューするときに、他の性能メモより先にこの skill の async 規則を適用する。
license: MIT
metadata:
  version: "1.0.0"
  upstream: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
  upstream-author: Vercel Engineering
---

# React best practices

大本は https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices （skill の宣言は MIT。本文は https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md ）。優先度がいちばん高いのは瀑布を消す `async-` 規則で、ここがその正本である。React 19 の API の選び方は `.claude/skills/modern-react-guidance/SKILL.md` に従う。

出典が Next.js、SWR、`useState`、`useMemo`、`useRef`、`better-all`、リクエストをまたぐ LRU を例にしている箇所は、このリポジトリでは採らない。

## 瀑布

独立した処理を、前の結果を使わないのに順番に待たない。

- Effect なら `Effect.all` か `Effect.forEach` に `{ concurrency: "unbounded" }` を渡す。順番が仕様なら `{ concurrency: 1 }` と書く。省略しない。
- Effect の外の Promise なら `Promise.all`。`.then` は `no-promise-chain` が拒否するので、依存のある続きは `Effect.flatMap` か async 関数の中で `await` する。
- `better-all` は入れない。

依存が一部だけのときは、依存しない側を先に走らせ、依存する側は必要な値ができてから始める。両方を一つの `Effect.all` に載せる。

```ts
const loaded = Effect.all(
  {
    config: fetchConfig,
    profile: fetchUser.pipe(Effect.flatMap((user) => fetchProfile(user.id))),
  },
  { concurrency: "unbounded" },
);
```

使わない枝で待たない。安い同期条件が既に偽なら、その先の flag も I/O も始めない。

API とサーバー処理では、認証結果に依存しない読み取りを、認証を待ってから始めない。認証と無関係な Effect は同じ `Effect.all` で先に走らせる。

殻（ナビ、ヘッダー、フッター）をデータの完了まで止めない。データが要る部分だけ Suspense の内側に置く。サーバーデータ自体は TanStack Query で、`use(fetch(...))` では取らない。レイアウトの分岐に必須な値だけ、殻の外で待つ。

詳細は `rules/` にある。

## 採らない出典

| 出典 | 代わり |
| --- | --- |
| SWR | TanStack Query |
| `useMemo` / `useCallback` / `memo` | Compiler。`project/no-manual-memoization` |
| `useState` / `useRef` でローディングや一時値を持つ | `useAction`、`useTransition`、Effect Atom |
| `next/dynamic`、`after()`、React `cache()` をリクエストをまたいで使う | TanStack Start のローダーと、Worker では `project/cross-request-state` が拒否する共有待ち |
| barrel import | `no-barrel-import` / `no-barrel-module` |
| ハンドラを ref にしまう | `useEffectEvent`。依存配列には入れない |

## 規則

- `rules/async-parallel.md` — https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-parallel.md
- `rules/async-defer-await.md` — https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-defer-await.md
- `rules/async-cheap-condition-before-await.md` — https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-cheap-condition-before-await.md
- `rules/async-dependencies.md` — https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-dependencies.md
- `rules/async-api-routes.md` — https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-api-routes.md
- `rules/async-suspense-boundaries.md` — https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/async-suspense-boundaries.md
- `rules/advanced-effect-event-deps.md` — https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/advanced-effect-event-deps.md
- `rules/rendering-activity.md` — https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/rendering-activity.md
