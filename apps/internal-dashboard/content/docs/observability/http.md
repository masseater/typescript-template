---
title: HTTP
description: ブラウザとサーバが、要求と応答と計時を往復させるプロトコル
---

HTTP は、ブラウザとサーバが要求と応答を往復させるプロトコルである。状態コードは応答の意味を一つに決め、所要時間は送り始めから応答を受け終わるまでである。どの状態コードを選ぶかは [観測性](/guidelines/observability) が持つ。

```http
GET /users/123 HTTP/1.1
Host: app.example
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

HTTP/1.1 200 OK
content-type: application/json
server-timing: db;dur=12
```

`server-timing` の `db;dur=12` は、サーバがデータベースに使った 12 ミリ秒を、応答のヘッダでブラウザへ返す。ナビゲーションのエントリは、これを `serverTiming` の `name` と `duration` として持つ。`traceparent` の桁の意味は [W3C Trace Context](/observability/trace-context) が持つ。

## 参考文献

- 公式 — [HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP)
- 公式 — [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
- 公式 — [Server Timing](https://www.w3.org/TR/server-timing/)
