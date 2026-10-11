# typescript-template

## セットアップ

```sh
vp install
cp .env.example .env
vp exec --filter web alchemy profile edit --add Cloudflare
vp run verify
```

Cloudflare の認証情報は環境変数ではなく Alchemy のプロファイル（`~/.alchemy`）で管理する。
デプロイと `.mcp.json` の Cloudflare MCP は、どちらもこのプロファイルの認証情報を使う。

## 環境変数

ルートの `.env` に書く。

| 名前                 | 用途                          |
| -------------------- | ----------------------------- |
| `OPENROUTER_API_KEY` | push 前に走る jev-lint の判定 |

## GitHub の設定

リポジトリの Actions secrets に次を登録する。

| 名前                      | 用途                                                    |
| ------------------------- | ------------------------------------------------------- |
| `OPENROUTER_API_KEY`      | verify ワークフローの jev-lint                          |
| `CLAUDE_CODE_OAUTH_TOKEN` | verify 失敗時に Claude Code が自動修正する              |
| `ALCHEMY_GITHUB_TOKEN`    | `infra/github` のリポジトリ設定とルールセットを反映する |

`ALCHEMY_GITHUB_TOKEN` は、このリポジトリの Administration に書き込み権限を持つ fine-grained PAT である。
GitHub Actions の `GITHUB_TOKEN` にはこの権限を付けられない。

Settings → Actions → General で「Allow GitHub Actions to create and approve pull requests」を有効にする。
release-pleaseと自動修正がPRを作るためである。

## 起動とデプロイ

```sh
cd apps/web
vp run dev
vp run deploy
```

リポジトリ設定とルールセットは `infra/github` で Alchemy が管理する。
main への push で verify が通ると反映される。手元からは `infra/github` で `vp run deploy` を実行する。
