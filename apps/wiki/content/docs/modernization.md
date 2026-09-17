---
title: モダン化計画
description: TanStack Start、Elysia、Effect を土台に、採用する技術と現在の構成から置き換えるものをまとめた計画です。
---

TanStack Start、Elysia、Effect v4 を土台にし、Cloudflare 上で動かします。TanStack 系のライブラリは基本すべて採用し、alpha や beta の段階でも使います。SaaS には依存しません。

優先度の ★5 は入れない理由がないもの、★4 は強く推奨するもの、★3 は要件が合えば入れるもの、★2 は様子を見ながら入れるものを表します。

## 現在の構成から置き換えるもの

| 現在             | 置き換え先                                         | 置き換える理由                                                                                     |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Pulumi           | Alchemy v2                                         | Cloudflare のリソース定義と、そのリソースを使うアプリのコードを 1 つの Effect プログラムに書けます |
| valibot、zod     | Effect Schema                                      | 検証とシリアライズのスキーマを Effect の型に揃えます                                               |
| Sentry           | Workers の OTLP エクスポートと Effect の OTLP 出力 | SaaS に依存せず、トレースとログを同じ trace ID で外部に送れます                                    |
| Drizzle ORM 0.45 | Drizzle ORM v1                                     | `drizzle-orm/effect-schema` で DB スキーマから Effect Schema を作れます                            |

## 基盤

| 優先度 | 採用するもの                   | 役割                                                                                                                      |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 前提   | TanStack Start                 | フルスタックのフレームワークです                                                                                          |
| 前提   | Elysia                         | 外部に公開する HTTP API を担います。Cloudflare アダプタは experimental で、OpenAPI の型生成と静的ファイル配信は使えません |
| 前提   | Effect v4                      | エラー、依存注入、並行処理を型で扱います                                                                                  |
| ★5     | React 19 と React Compiler     | 手作業のメモ化をなくします                                                                                                |
| ★5     | TypeScript 7                   | 型検査を高速化します                                                                                                      |
| ★5     | Vite+（Oxlint、Oxfmt、Vitest） | lint、format、test、ビルドをまとめて担います                                                                              |
| ★5     | pnpm workspaces                | モノレポを管理します                                                                                                      |
| ★5     | Effect Schema                  | スキーマを 1 つに揃えます                                                                                                 |
| ★5     | Better Auth                    | 認証を担います                                                                                                            |
| ★5     | Drizzle ORM v1                 | D1 と Durable Objects の SQLite の両方に対応したドライバを持ちます                                                        |
| ★4     | Varlock                        | 環境変数の契約を型付きで検査します                                                                                        |

ORM は Prisma と Kysely も比べたうえで Drizzle にしました。
Prisma 8 では SQLite が experimental で、Prisma 7 はバンドルが約 1.6MB あります。Kysely は Effect v4 で公式の連携が削除され、D1 と Durable Objects のドライバもサードパーティ製です。

## Cloudflare

| 優先度 | 採用するもの                      | 役割                                                                                                     |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ★5     | `@cloudflare/vite-plugin`         | TanStack Start を開発中から workerd 上で動かします                                                       |
| ★5     | `@cloudflare/vitest-pool-workers` | 本物の D1、KV、Durable Objects を相手にテストします                                                      |
| ★5     | D1                                | 共有データを保存します。トランザクションがないので、まとめて書き込むときは Drizzle の `batch` を使います |
| ★5     | Durable Objects（SQLite）         | ユーザー単位の状態を持ち、通知や新着投稿を WebSocket で届けます                                          |
| ★5     | Cloudflare Flagship               | OpenFeature のプロバイダです。サーバー側で評価した値をローダーで画面に渡します                           |
| ★5     | Alchemy v2                        | IaC です                                                                                                 |
| ★4     | Cloudflare Workflows V2           | 途中で落ちても再開できる多段処理を担います                                                               |
| ★4     | Queues                            | 非同期処理のキューです                                                                                   |
| ★4     | R2                                | 投稿画像などのファイルを保存します                                                                       |
| ★4     | Workers の OTLP エクスポート      | Workers のトレースとログを外部に送ります                                                                 |
| ★4     | effect-cf                         | Cloudflare の binding を Effect の Layer として扱います                                                  |
| ★3     | KV                                | セッションなど、読み込みの多いデータをキャッシュします                                                   |
| ★2     | Containers                        | Workers で動かないネイティブ依存の処理を逃がします                                                       |

## TanStack 系

| 優先度 | 採用するもの      | 役割                                                                                                                     |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ★5     | TanStack Query    | サーバーデータの取得とキャッシュを担います                                                                               |
| ★5     | TanStack DB       | いいねやコメントを楽観的に更新し、同じデータを表示している全箇所へ即座に反映します。同期には Query collection を使います |
| ★5     | TanStack Virtual  | 無限スクロールのフィードを描画します                                                                                     |
| ★5     | TanStack Form     | フォームの状態と検証を担い、Effect Schema をそのまま渡します                                                             |
| ★5     | TanStack Table v9 | 表のロジックを担います                                                                                                   |
| ★5     | TanStack Devtools | 各ライブラリの devtools を 1 つのパネルにまとめます                                                                      |
| ★3     | TanStack Pacer    | debounce、throttle、rate limit を担います                                                                                |

## フロントエンド

user アプリは業務アプリではなく、Facebook のような SNS の画面を想定します。

フロントを含むアプリは [Feature-Sliced Design](https://fsd.how/ja/docs/get-started/overview/) で構成し、層の境界を [steiger](https://github.com/feature-sliced/steiger) で検査します。
TanStack Start のルートファイルは app 層の薄いアダプタにとどめ、画面は pages 層に置きます。

### 見た目を SmartHR 風にする

shadcn/ui を挙動と a11y の骨格として使い、見た目だけを SmartHR 風に書き換えます。部品は `shared/ui` に置き、このリポジトリの中で直接カスタムします。

```
┌───────────────────────────────────────┐
│ pages / features                      │  余白は className で指定する
└──────────────────┬────────────────────┘
                   │ import
┌──────────────────▼────────────────────┐
│ shared/ui                             │  色・角丸・影・文字を部品が持つ
└──────────────────┬────────────────────┘
                   │
┌──────────────────▼────────────────────┐
│ shadcn/ui (Base UI, style: Vega)      │  挙動と a11y
└──────────────────┬────────────────────┘
                   │
┌──────────────────▼────────────────────┐
│ Tailwind CSS v4 @theme                │  smarthr-ui のトークン値を移植する
└───────────────────────────────────────┘
```

1. style は Vega から始めます。SNS の画面ではコンパクトな Mira や Nova だと窮屈になり、Maia は角丸が大きすぎて SmartHR の見た目と合いません。
2. smarthr-ui（MIT）のトークン値を `@theme` と shadcn/ui の CSS 変数に移植します。移植するのは色（`MAIN`、`GREY_*`、`DANGER`、`WARNING_YELLOW`）、角丸（4px / 6px / 8px）、影（`layer-0` から `layer-4`）、文字サイズと行間、フォーカスリングの色（`OUTLINE`）です。
3. 余白の基準値 `--spacing` は変えません。SmartHR の余白は 8px 刻みなので既定の 4px 基準で表現でき、基準値を変えると shadcn/ui の部品の寸法が崩れます。
4. 和文フォントのフォールバック、アイコンセット、境界線と影の使い分けを揃えます。
5. ブランド色（`BRAND`）とロゴは移植しません。

### 見た目のルールを lint で守らせる

[@shadcn/lint](https://github.com/shadcn-ui/lint) を Oxlint の `jsPlugins` で読み込みます。余白の上書きは許可し、色、角丸、影、文字を部品の外から変えることを禁止します。

```json
{
  "jsPlugins": ["@shadcn/lint"],
  "settings": { "shadcn": { "ui": "@template/ui/ui" } },
  "rules": {
    "shadcn/no-restyle": ["error", { "allow": ["layout", "spacing"] }],
    "shadcn/no-raw-colors": "error",
    "shadcn/no-arbitrary-values": "error",
    "shadcn/no-unknown-classes": "error"
  },
  "overrides": [{ "files": ["libs/ui/src/shared/ui/**"], "rules": { "shadcn/no-restyle": "off" } }]
}
```

### その他のフロントエンドのライブラリ

| 優先度 | 採用するもの                                       | 役割                                                     |
| ------ | -------------------------------------------------- | -------------------------------------------------------- |
| ★5     | Paraglide JS                                       | i18n を担います。TanStack Start の公式サンプルがあります |
| ★5     | `@smarthr/wareki`                                  | 和暦を変換します                                         |
| ★5     | Storybook 10、`@storybook/addon-mcp`、Vitest addon | AI が部品を参照、再利用、テストできるようにします        |
| ★4     | Storybook a11y addon（axe）                        | 描画結果の a11y 違反を検出します                         |
| ★3     | `temporal-polyfill`                                | Safari でも Temporal を使えるようにします                |
| ★2     | Motion                                             | アニメーションを担います                                 |

## フィーチャーフラグ

| 優先度 | 採用するもの                            | 役割                                               |
| ------ | --------------------------------------- | -------------------------------------------------- |
| ★5     | `@openfeature/react-sdk` とサーバー SDK | フラグを評価し、値が変わると該当箇所を再描画します |

## 品質と運用

| 優先度 | 採用するもの                            | 役割                                               |
| ------ | --------------------------------------- | -------------------------------------------------- |
| ★5     | Vitest browser mode と Playwright       | 実ブラウザでテストと E2E を実行します              |
| ★5     | MSW                                     | 外部 HTTP だけを置き換えます                       |
| ★5     | knip                                    | 使われていない export や依存を検出します           |
| ★4     | Effect の OTLP 出力                     | Effect のスパンとログを OpenTelemetry で送ります   |
| ★4     | Renovate と pnpm の `minimumReleaseAge` | 依存を更新し、公開直後のパッケージは取り込みません |
| ★3     | Scalar                                  | OpenAPI から API ドキュメントの画面を作ります      |
| ★3     | dependency-cruiser                      | steiger で表せない import の制約を検出します       |
| ★3     | k6                                      | 負荷試験を行います                                 |
| ★2     | Stryker                                 | ミューテーションテストで、テストの検出力を測ります |
