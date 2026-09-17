---
title: 観測
description: ログ・トレース・メトリクスで実際の動作を確かめる方法です。
---

## 送信されるデータ

各 Worker とブラウザは OpenTelemetry 形式でログ、トレース、メトリクスを送ります。サービス名は `user-server`、`user-browser` のように、アプリ名と実行場所の組み合わせです。

## 照会する

レスポンスヘッダーの `x-request-id` と `traceparent` を使い、同じリクエストのログとトレースを突き合わせます。

```bash
pnpm observe
pnpm observe:verify
```

Grafana の MCP には `pnpm observe:mcp` で読み取り専用の権限で接続します。

## 障害を調べる

画面にエラーが表示されたら、表示されたリクエスト ID でログを検索します。同じトレースの span を見ると、DB やメール送信のどこで失敗したかがわかります。
