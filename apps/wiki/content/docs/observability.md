---
title: 観測
description: ログ・トレース・メトリクスで実際の動作を確かめる方法です。
---

## 送信されるデータ

各 Worker とブラウザは、ログとトレースを記録します。サービス名は `user-server`、`user-browser` のように、アプリ名と実行場所の組み合わせです。

送信先は環境で変わります。

| 環境     | 送信先                                    | 条件                                           |
| -------- | ----------------------------------------- | ---------------------------------------------- |
| ローカル | Grafana LGTM（OpenTelemetry）             | `OTEL_EXPORTER_OTLP_ENDPOINT` が設定されている |
| 本番     | Cloudflare Workers Logs と Workers Traces | `OTEL_EXPORTER_OTLP_ENDPOINT` がない           |

本番では、ブラウザのイベントとアプリのエラーを構造化ログとして Workers Logs に出します。サーバー側の span は Workers の自動トレースが記録します。無料プランの上限は、ログとトレースの span を合わせて 1 日 200,000 イベントです。

## 照会する

レスポンスヘッダーの `x-request-id` と `traceparent` を使い、同じリクエストのログとトレースを突き合わせます。

ローカルでは次のコマンドを使います。

```bash
pnpm observe
pnpm observe:verify
```

Grafana の MCP には `pnpm observe:mcp` で読み取り専用の権限で接続します。

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
pnpm observe:symbolicate --app user --release <release> "/assets/index-abc.js:1:234"
```

デプロイのたびに、そのリリースの source map を `.local/source-maps/<アプリ>/releases/<release>/` に保管しています。サーバーの未捕捉例外は、Cloudflare に上げた source map で Workers Logs 上でも元の行に戻ります。

## エラー通知

共有スタックのエラー監視 Worker が 5 分ごとに Workers Logs を照会します。次のエラーを Webhook に通知します。

- 初めて出た fingerprint のエラー
- 1 日以上出ていなかったのに再発したエラー

監視自体が失敗したときも、1 日 1 回まで通知します。
