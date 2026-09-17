---
title: 観測
description: ログとトレースで実際の動作を確かめる方法です。
---

## 記録されるデータ

観測は Cloudflare と Pulumi だけで完結します。外部の観測サービスやコンテナは使いません。

各 Worker とブラウザは、同じ形の構造化ログを出します。サービス名は `user-server`、`user-browser` のように、アプリ名と実行場所の組み合わせです。サーバー側の span は、Workers ランタイムの自動トレースが D1、fetch、Workers AI、メール送信について記録します。

| 環境     | 記録先                                                              |
| -------- | ------------------------------------------------------------------- |
| ローカル | Cloudflare Local Explorer（`wrangler dev`、`vp dev`、`vp preview`） |
| 本番     | Cloudflare Workers Logs と Workers Traces                           |

本番の無料プランの上限は、ログとトレースの span を合わせて 1 日 200,000 イベントです。

## 照会する

レスポンスヘッダーの `x-request-id` を使い、同じリクエストのログとトレースを突き合わせます。

ローカルでは、起動中のアプリの Local Explorer を次のコマンドで照会します。`--app` には `http://127.0.0.1:<ポート>/` を指定します。

```bash
vp run observe request --app http://127.0.0.1:3001/ --request-id <x-request-id の値>
vp run observe logs --app http://127.0.0.1:3001/ --level error
vp run observe:verify --app http://127.0.0.1:3001/
```

ブラウザでは `http://localhost:<ポート>/cdn-cgi/local/explorer` を開くと、同じログとトレースを見られます。

本番では、Cloudflare ダッシュボードの Workers & Pages にある Observability で検索します。AI からは、リポジトリの `.mcp.json` に定義した Cloudflare の Workers Observability MCP で照会します。初回は Cloudflare の OAuth 認可が必要です。

```text
request_id = "<x-request-id の値>"
error.fingerprint = "<通知に書かれた fingerprint>"
```

## 障害を調べる

画面にエラーが表示されたら、表示されたリクエスト ID でログを検索します。同じトレースの span を見ると、DB やメール送信のどこで失敗したかがわかります。

エラーのログには、メッセージ本文を残しません。残すのは次の値です。

- `error.type`
- `error.locations`（ビルド後のファイルでの位置）
- `error.fingerprint`（型とスタック上位から作ったグループの識別子）
- `release`

`error.locations` を元のソースの位置に戻すには、デプロイした端末で次のコマンドを実行します。`--release` にはログの `release` の値を指定します。

```bash
vp run observe:symbolicate --app user --release <release> "/assets/index-abc.js:1:234"
```

デプロイのたびに、そのリリースの source map を `.local/source-maps/<アプリ>/releases/<release>/` に保管しています。サーバーの未捕捉例外は、Cloudflare に上げた source map で Workers Logs 上でも元の行に戻ります。

## エラー通知

共有スタックのエラー監視 Worker が 5 分ごとに Workers Logs を照会します。次のエラーを、Cloudflare の Email 送信で運用者のアドレスに通知します。

- 初めて出た fingerprint のエラー
- 1 日以上出ていなかったのに再発したエラー

監視自体が失敗したときも、1 日 1 回まで通知します。
