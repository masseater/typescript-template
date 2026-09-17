---
title: はじめに
description: このリポジトリの開発者向け wiki です。
---

この wiki は `apps/wiki/content/docs` に置いた Markdown から生成します。ページの本文、サイドバー、検索索引、MCP の応答はすべて同じ Markdown から作られます。

閲覧できるのは、多要素認証を済ませた管理者アカウントだけです。

## ページを追加する

`apps/wiki/content/docs` に `.md` ファイルを追加すると、ファイル名がそのまま URL になります。先頭の frontmatter に `title` と `description` を書きます。

```md
---
title: ページの題名
description: 検索結果に表示する一文
---
```

## 検索する

画面左上の検索欄では、語句の一致と文章の意味の近さを合わせて順位を付けます。「本番に反映したい」のように、ページに出てこない言い回しでも該当ページを探せます。

文章の意味の近さは Cloudflare Workers AI の埋め込みモデル `@cf/baai/bge-m3` で計算します。Workers AI を使えないローカル環境では、語句の一致だけで検索します。

## AI エージェントから使う

`/mcp` は MCP サーバーです。`search`、`list_pages`、`get_page` の 3 つのツールで、wiki の検索と本文の取得ができます。

```json
{ "mcpServers": { "wiki": { "type": "http", "url": "https://<wiki のドメイン>/mcp" } } }
```

MCP クライアントは OAuth で接続します。初回の接続でブラウザが開くので、管理者アカウントでログインして連携を許可します。
