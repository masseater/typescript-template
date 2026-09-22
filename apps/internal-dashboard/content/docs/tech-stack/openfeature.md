---
title: OpenFeature
description: 機能フラグの評価 API を共通にし、provider で Flagship などのバックエンドへつなぐ。本テンプレートは Cloudflare Flagship を使う
---

OpenFeature は、機能フラグの評価 API を共通にする CNCF の仕様である。アプリは `getBooleanValue` などの呼び出しだけを書き、どの管理サービスから値を取るかは provider が担う。provider を差し替えても、評価の呼び出しは同じ形のままにできる。

本テンプレートは **Cloudflare Flagship** を provider に使う。[Cloudflare](/tech-stack/cloudflare) の Worker には `FLAGS` binding が渡る。`@cloudflare/flagship/server` の `FlagshipServerProvider` が binding を OpenFeature に接続する。`FLAGS` が無いときは `@openfeature/server-sdk` の `TypedInMemoryProvider` が、定義に書いた既定の variation を返す。フラグのキーと variation は型付きの定義として持つ。管理画面から Flagship の値を書き換えるときは、Flagship の REST API を使う。

```ts
import { FlagshipServerProvider } from "@cloudflare/flagship/server";
import { OpenFeature } from "@openfeature/server-sdk";

await OpenFeature.setProviderAndWait(new FlagshipServerProvider({ binding: env.FLAGS }));

const client = OpenFeature.getClient();

const showMemberBoard = await client.getBooleanValue("member-board", true);
```

`setProviderAndWait` が終わるまで `getBooleanValue` は provider を通らない。`env.FLAGS` は [Alchemy](/tech-stack/alchemy) が Worker に渡す Flagship binding である。第三引数 `true` は、評価に失敗したときに返す既定値である。Flagship 側で `member-board` が off なら `false`、on なら `true` が返る。`FLAGS` binding が無い実行では、上の `FlagshipServerProvider` の代わりに `TypedInMemoryProvider` を登録し、定義の default variation がそのまま返る。

サーバー側の取得と切り替えは [Effect](/tech-stack/effect) の `FeatureFlags` サービスが OpenFeature client を包む。呼び出し側は `yield* FeatureFlags.getBoolean("member-board")` だけを書く。

## 採ると

| 見ているもの | 採る前 | 採ったあと |
| --- | --- | --- |
| `member-board` の表示 | ソースに定数や環境変数を書き、変えるたびにデプロイする | `getBooleanValue("member-board", true)` が Flagship の値を返す。ダッシュボードで変えればデプロイなしで反映する |
| ローカル実行 | Flagship が無いと評価できない | `FLAGS` binding が無いときは `TypedInMemoryProvider` が定義どおりの既定値を返す |
| 管理サービス | 製品ごとに SDK と API が違う | OpenFeature の評価 API を保ったまま、provider を Flagship から別製品へ差し替えられる |

## 参考文献

- 公式 — [OpenFeature](https://openfeature.dev/docs/reference/intro)
- 公式 — [Providers](https://openfeature.dev/docs/reference/concepts/provider)
- 公式 — [OpenFeature Node.js SDK](https://openfeature.dev/docs/reference/sdks/server/javascript/)
- 公式 — [Cloudflare Flagship](https://developers.cloudflare.com/flagship/)
- 公式 — [Get started with Flagship](https://developers.cloudflare.com/flagship/get-started/)
- サンプル — [open-feature/js-sdk](https://github.com/open-feature/js-sdk)
- サンプル — [cloudflare/flagship](https://github.com/cloudflare/flagship)
- 記事 — [Feature Toggles (aka Feature Flags)](https://martinfowler.com/articles/feature-toggles.html)
