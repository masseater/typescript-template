---
title: Feature-Sliced Design
description: 画面のコードをレイヤー、スライス、セグメントに分け、下の層だけを import する
---

Feature-Sliced Design は、フロントエンドのコードをレイヤー、スライス、セグメントに分ける。`src` の直下に置けるのは `app`、`pages`、`widgets`、`features`、`entities`、`shared` だけである。`processes` は廃止されているので置かない。レイヤー名を増やすこともしない。

モジュールが import できるのは、自分より下のレイヤーだけである。同じレイヤーの別スライスは import しない。`pages/profile` は `pages/settings` を知らない。`app` と `shared` にはスライスが無く、その中のセグメント同士は import できる。スライスの外から見えるのは、そのスライスの `index.ts` だけである。セグメントのファイルを直接 import しない。

画面そのものは `pages` のスライスに置く。一度しか出てこない操作も、そこに残す。複数の画面で同じ操作を繰り返すときは `features` に出す。業務の用語そのもの、たとえば会員やセッションは `entities` に置く。entity が別の entity の型をフィールドに含むときだけ、`@x` 経由で型を渡す。それ以外の関係は、上のレイヤーに書く。業務を含まない再利用は `shared`、アプリをまたぐ見た目を `libs/ui` へ出す判断は [フロントエンド](/guidelines/frontend) が持つ。

仕様は `widgets` を勧めていない。特定の画面だけの塊は `pages` に残し、繰り返す操作は `features` に出す。アプリ全体の枠は `app` に置ける。

[TanStack Start](/tech-stack/tanstack-start) のルートファイルは `app/routes` に置く。URL と、ページの public API を繋ぐだけにして、画面の中身は持たない。

| ファイル | 役割 |
| --- | --- |
| `src/app/routes/_member/users.$id.tsx` | `/users/123` とページを繋ぐ |
| `src/pages/profile/index.ts` | スライスの外から import できる公開 API |
| `src/pages/profile/ui/` | その画面の表示 |
| `src/pages/profile/api/` | その画面の取得 |
| `src/pages/profile/model/` | その画面の型と検証 |

```tsx
import { ProfilePage, loadMember } from "#pages/profile/index.ts";
```

`loadMember` はルートの loader から呼ぶ。`ProfilePage` は、loader の結果を受け取って表示する。`pages/profile/ui/profile-page.tsx` をルートから直接 import しない。

層の外のファイル、上の層への import、public API を通さない import は steiger が失敗させる。コマンドは `steiger src --fail-on-warnings` である。

## 参考文献

- 公式 — [Feature-Sliced Design](https://fsd.how/)
- 公式 — [Layers](https://fsd.how/docs/reference/layers/)
- 公式 — [Slices and segments](https://fsd.how/docs/reference/slices-segments/)
- 公式 — [Public API](https://fsd.how/docs/reference/public-api/)
- 公式 — [概要（日本語）](https://fsd.how/ja/docs/get-started/overview/)
- 公式 — [Tutorial](https://fsd.how/docs/get-started/tutorial/)
- サンプル — [feature-sliced/examples](https://github.com/feature-sliced/examples)
- 記事 — [Migration from v2.0](https://fsd.how/docs/guides/migration/from-v2-0/)
- 検証 — [steiger](https://github.com/feature-sliced/steiger)
