---
name: agents-md
description: 各workspaceのAGENTS.mdの書き方について。
---

各 workspace (pnpm workspace で 1 workspace と判定される単位)には必ず AGENTS.md とそれのシンボリックリンクである CLAUDE.md を配置する。中身の書き方は以下をベースにすること。

- 使用している主な技術スタックのメジャーバージョンを記載する。
- 注意点が明確にあれば記載する。なければ書かない。
- この workspace は何を提供するものかを書く。
- どこに参照されているかは書かない。
- 外部公開される可能性がある時は、どこにどう公開されるのかを書く。
- 他の workspace のことは書かない。
- 開発方法や検証コマンドは package.json の scripts と vite.config.ts の run.tasks を読めば分かるので書かない。
- 書くべきかどうか迷ったら書かない。
