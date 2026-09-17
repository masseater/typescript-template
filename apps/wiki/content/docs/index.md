---
title: はじめに
description: このリポジトリの開発者向け wiki です。
---

この wiki は `apps/wiki/content/docs` に置いた Markdown から生成します。ページの本文、サイドバー、検索索引、MCP の応答はすべて同じ Markdown から作られます。

## ページを追加する

`apps/wiki/content/docs` に `.md` ファイルを追加すると、ファイル名がそのまま URL になります。先頭の frontmatter に `title` と `description` を書きます。

```md
---
title: ページの題名
description: 検索結果に表示する一文
---
```

## 検索する

画面右上の検索欄では、語句の一致と文章の意味の近さを合わせて順位を付けます。「リリースの手順を知りたい」のように、ページに出てこない言い回しでも該当ページを探せます。

## AI エージェントから使う

`/mcp` は MCP サーバーです。`search`、`list_pages`、`get_page` の 3 つのツールで、wiki の検索と本文の取得ができます。

```json
{ "mcpServers": { "wiki": { "type": "http", "url": "https://<wiki のドメイン>/mcp" } } }
```
