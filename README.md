# typescript-template

## セットアップ

```sh
vp install
cp .env.example .env
cp apps/web/.env.example apps/web/.env
vp run verify
```

## 環境変数

ルートの `.env` に書く。

| 名前                 | 用途                              |
| -------------------- | --------------------------------- |
| `OPENROUTER_API_KEY` | jev-lint（`vp run verify`）の判定 |

`apps/web/.env` に書く。

| 名前                          | 用途                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`       | デプロイ先の Cloudflare アカウント                          |
| `CLOUDFLARE_API_TOKEN`        | Cloudflare の認証                                           |
| `CLOUDFLARE_API_KEY`          | `CLOUDFLARE_API_TOKEN` の代わりに Global API Key を使う場合 |
| `CLOUDFLARE_EMAIL`            | `CLOUDFLARE_API_KEY` と組で使う                             |
| `ALCHEMY_STAGE`               | Alchemy のステージ名（任意）                                |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry の送信先（任意）                              |
| `OTEL_EXPORTER_OTLP_HEADERS`  | OTLP の認証ヘッダー（任意）                                 |

## GitHub の設定

リポジトリの Actions secrets に次を登録する。

| 名前                      | 用途                                       |
| ------------------------- | ------------------------------------------ |
| `OPENROUTER_API_KEY`      | verify ワークフローの jev-lint             |
| `CLAUDE_CODE_OAUTH_TOKEN` | verify 失敗時に Claude Code が自動修正する |

Settings → Actions → General で「Allow GitHub Actions to create and approve pull requests」を有効にする。
release-pleaseと自動修正がPRを作るためである。

## 起動とデプロイ

```sh
cd apps/web
vp run dev
vp run deploy
```
