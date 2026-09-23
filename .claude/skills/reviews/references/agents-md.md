# 各 workspace の AGENTS.md

各 workspace（pnpm workspace で 1 workspace と判定される単位）に AGENTS.md と、そのシンボリックリンクの CLAUDE.md を置く。

- この workspace が何を提供するかを書く。
- 主な技術スタックのメジャーバージョンを書く。
- 注意点が明確にあれば書く。無ければ書かない。
- 外部公開される可能性があるなら、どこにどう公開されるかを書く。
- どこから参照されているか、他の workspace のこと、開発方法や検証コマンド（`package.json` の `scripts` と `vite.config.ts` の `run.tasks` を読めば分かる）は書かない。
- 迷ったら書かない。
