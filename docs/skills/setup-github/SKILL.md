---
name: setup-github
description: このテンプレートから作ったリポジトリの GitHub 側を設定する。Actions の secrets と variables、infra/github を反映する GitHub App、Actions による PR 作成の許可を揃える。テンプレートから新しいリポジトリを作ったとき、main の verify ワークフローの github ジョブが認証で落ちたときに使う。
---

# GitHub の設定

作業は `gh` で行う。対象リポジトリを `REPO=<owner>/<name>` として、各コマンドに `--repo "$REPO"` を付ける。
`gh` で設定できない手順は、ユーザーにブラウザで行う手順と URL を渡す。

## 1. スタック名を変える

`apps/web/alchemy.run.ts` と `infra/github/alchemy.run.ts` の `Stack` の第一引数は、テンプレートの名前のままになっている。
状態は Cloudflare アカウントの中でスタック名ごとに保存されるため、同じアカウントを使う別のリポジトリと名前が重なると、互いのリソースを置き換えてしまう。
リポジトリ名に合わせて変える。

## 2. GitHub App を用意する

`infra/github` はリポジトリ設定とルールセットを変更するため、Repository permissions の Administration に Read and write が要る。
GitHub Actions の `GITHUB_TOKEN` にはこの権限を付けられないため、GitHub App のトークンを使う。

- 既にこの用途の App があれば、`https://github.com/apps/<app-slug>/installations/new` から対象リポジトリにインストールしてもらう。
- なければ `https://github.com/settings/apps/new` で作ってもらう。Organization なら `https://github.com/organizations/<org>/settings/apps/new` で作る。
  Webhook は無効、Repository permissions は Administration だけ Read and write にする。
  作ったら秘密鍵を生成し、対象リポジトリにインストールする。

## 3. variables と secrets を登録する

```sh
gh variable set INFRA_GITHUB_APP_CLIENT_ID --repo "$REPO" --body "<App の Client ID>"
gh secret set INFRA_GITHUB_APP_PRIVATE_KEY --repo "$REPO" < <秘密鍵の .pem>
gh secret set OPENROUTER_API_KEY --repo "$REPO"
gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo "$REPO"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO"
gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO"
```

| 名前                           | 種類     | 用途                                        |
| ------------------------------ | -------- | ------------------------------------------- |
| `INFRA_GITHUB_APP_CLIENT_ID`   | variable | `infra/github` を反映する GitHub App        |
| `INFRA_GITHUB_APP_PRIVATE_KEY` | secret   | 同じ App の秘密鍵                           |
| `OPENROUTER_API_KEY`           | secret   | verify ワークフローの jev-lint              |
| `CLAUDE_CODE_OAUTH_TOKEN`      | secret   | verify 失敗時に Claude Code が自動修正する  |
| `CLOUDFLARE_ACCOUNT_ID`        | secret   | デプロイ先と Alchemy の状態を置くアカウント |
| `CLOUDFLARE_API_TOKEN`         | secret   | 同じアカウントの API トークン               |

Organization のリポジトリなら、Organization の secrets と variables に一度登録すれば、各リポジトリでの登録は要らない。

## 4. Actions に PR の作成を許可する

release-please と自動修正が PR を作るため、Actions に PR の作成を許可する。

```sh
gh api --method PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true
```

## 5. 反映を確かめる

main に push し、verify ワークフローの `github` ジョブが通ることを `gh run watch --repo "$REPO"` で確かめる。
通ったら、`gh api "repos/$REPO" --jq .pull_request_creation_policy` が `collaborators_only` を返すことを確かめる。
`gh api "repos/$REPO/rulesets"` に `protect default branch` があることも確かめる。
