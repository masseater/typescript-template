作業を始める前に `repo-conventions` と `vite-plus` の skill を読み、従う。どちらも masseater/skills にあり、`vp install` が `.agents/skills/` に入れる。

## コマンド

- `vp run verify` が検査をまとめて流す。pre-push フックと Stop フックも同じ verify を走らせる。
- テストを 1 つだけ走らせるときは、`apps/web` で `vp test run <ファイル>` を実行する。
- D1 のスキーマは `*.table.ts` に書き、`apps/web` で `vp run db:generate` を実行してマイグレーションを作る。better-auth のテーブルは `vp run auth:generate` で生成する。

## 構成

- 構成と、依存してよい向きは ARCHITECTURE.md にある。ワークスペースや層の境界、不変条件が変わるときだけ ARCHITECTURE.md を直す。
- 誰にでも見せる静的なページは `apps/lp` の形で作る。
