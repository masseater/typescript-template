---
title: Effect
description: 失敗の種類と必要なサービスを型に載せ、入口で実行する書き方
---

Effect は、非同期処理を「呼んだ瞬間に走る関数」ではなく、「成功の値、失敗の種類、必要なサービスを型に持った記述」として扱うライブラリです。`async` / `await` と例外に慣れていると、次の違いから入ると読みやすくなります。

- 記述は、作っただけでは動きません。`Effect.fn` や `Effect.gen` が返す値を、Worker の入口やテストが `runPromise` したときにはじめて実行します。途中で落ちた処理を、呼び忘れの例外ではなく、実行した側が結果として受け取れます。
- 失敗は、取りこぼした `throw` ではなく型に載ります。wiki の `guardAccess` は、セッションが無いことと、検証そのものができないことを分け、後者だけをエラーとして残します。呼び出し側は、どの失敗を成功へ畳んだかを型で見られます。
- DB や設定のような依存は、引数で引き回す代わりに `yield*` でサービスから取ります。足りないサービスは型に残るので、入口で渡し忘れるとコンパイルが通りません。
- 外から来た未知の値（環境変数、JSON）は Effect Schema で検証してから中へ入れます。予算監視の設定は `Schema.decodeUnknownEffect` がこの形です。通らなければ、その値を使った処理へ進みません。

インフラの宣言も同じ書き方です。`infra/cloudflare` の Worker や D1 は、Effect のプログラムの中で宣言します。宣言の仕組みは [Alchemy](/tech-stack/alchemy) です。

## 画面では Atom で購読する

サーバーの Effect とは別に、画面が「いまの取得結果」を持つために Effect Atom（`effect/unstable/reactivity` の `Atom`）を使っています。`libs/ui` の `requestAtom` は、Promise を返す関数を Effect に包んで Atom にし、成功と失敗と待ちを 1 つの値にします。

会員ホームのフィードがこの形です。`HomePage` は `useAtomValue(feedAtom)` で結果を読み、失敗ならその文言を、まだ無ければ「読み込み中」を出します。これは [TanStack Query](/tech-stack/tanstack-query) のキャッシュではありません。URL を開くときの loader でもありません。
