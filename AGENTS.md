`masseater-ecosystem` に従うこと。これは masseater/skills のスキルで、状況ごとに読み込むスキルを指定する。`vp install` はスキルを `.agents/skills/` に配置する。

## コマンド

- `vp run verify` が検査をまとめて流す。pre-push フックと Stop フックも同じ verify を走らせる。

## 構成

- 構成と、依存してよい向きは ARCHITECTURE.md にある。ワークスペースを変更する前に、そのワークスペースの AGENTS.md があれば読む。ワークスペースや層の境界、不変条件が変わるときだけ ARCHITECTURE.md を直す。
