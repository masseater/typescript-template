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

| 名前                           | 用途                                          |
| ------------------------------ | --------------------------------------------- |
| `OPENROUTER_API_KEY`           | verify ワークフローの jev-lint                |
| `CLAUDE_CODE_OAUTH_TOKEN`      | verify 失敗時に Claude Code が自動修正する    |
| `INFRA_GITHUB_APP_PRIVATE_KEY` | `infra/github` を反映する GitHub App の秘密鍵 |

Actions variables の `INFRA_GITHUB_APP_CLIENT_ID` に、その GitHub App の Client ID を登録する。
GitHub App は Repository permissions の Administration を Read and write にして作り、このリポジトリにインストールする。
GitHub Actions の `GITHUB_TOKEN` には Administration の権限を付けられないためである。

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
