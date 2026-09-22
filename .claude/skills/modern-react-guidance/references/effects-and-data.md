# Effect とデータ

大本: https://github.com/adhhamdev/modern-react-guidance/blob/main/references/effects-and-data.md

Effect に書いてよいのは、React が知らない外部（DOM、計測、ウィジェット、データではない購読）との同期だけである。後始末を返す。

| やりたいこと                    | 書き方                                             |
| ------------------------------- | -------------------------------------------------- |
| props や state から計算できる値 | レンダー中に計算する                               |
| prop が変わったら state を戻す  | 子に `key` を渡すか、レンダー中に計算する          |
| 親に変化を知らせる              | イベントハンドラで親の関数を呼ぶ                   |
| サーバーデータを取る            | TanStack Query。`queryOptions` は `api` セグメント |
| 画面の一時状態                  | Effect Atom                                        |
| マウント時に一度だけ何かする    | まずイベントかローダーにできないか見る             |

`use(promise)` で取得しない。`useEffect` の中で `fetch` して state に入れない。`useSyncExternalStore` は使わない。

`useEffectEvent` は、Effect の依存を増やさずに最新の props を読むときだけ使う。
