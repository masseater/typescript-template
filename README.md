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

Actions の secrets と variables、GitHub App、Actions による PR 作成の許可を設定する。
手順は `setup-github` スキル（`docs/skills/setup-github/SKILL.md`）にある。

## 起動とデプロイ

```sh
cd apps/web
vp run dev
vp run deploy
```

リポジトリ設定とルールセットは `infra/github` で Alchemy が管理する。
main への push で verify が通ると、GitHub Actions から反映される。
