作業を始める前に `repo-conventions` と `vite-plus` の skill を読み、従う。どちらも masseater/skills にあり、`vp install` が `.agents/skills/` に入れる。

## コマンド

- `vp run verify` が検査をまとめて流す。pre-push フックと Stop フックも同じ verify を走らせる。

## 構成

- 構成と、依存してよい向きは ARCHITECTURE.md にある。ワークスペースを変更する前に、そのワークスペースの AGENTS.md があれば読む。ワークスペースや層の境界、不変条件が変わるときだけ ARCHITECTURE.md を直す。
