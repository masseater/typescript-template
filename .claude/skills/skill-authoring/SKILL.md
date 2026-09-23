---
name: skill-authoring
description: このリポジトリの skill（`.claude/skills/<name>/SKILL.md`）を作る・直すときに読む。書き方の基準、検証、返答の形を決める。
license: MIT
metadata:
  upstream: https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/authoring-a-skill.md
---

# skill の作成・変更

**skill の文体の責任は自分が持つ。**

1. `.claude/skills/<name>/SKILL.md` に置き、frontmatter に `name`（ディレクトリ名と同じ）と `description` を書く。詳細は同じディレクトリの `references/` に分ける。
2. 検証する。frontmatter、参照ファイルの存在、他 skill へのリンクは `tools/dont-review-it/src/features/dont-review-it/repository/claude-skills.test.ts` が検査する。
3. 構造的な規則ならテストを足す。主観的な内容なら足さない。
4. AGENTS.md の merge 手順に従って PR を出す。

迷ったら消す。判断を変える文だけを残す。何をするかを命じ、理由は書かない。理由がないと混乱する規則にだけ説明を付ける。文の調子は扱う範囲に合わせる。型・README・設定など構造的な正本を指し示し、機械的に検出できる規則は skill に書かず型・lint・テストにする。他の skill にはパスで委ね、内容を繰り返さない。繰り返し踏むのに skill になっていない手順があれば、新しい skill を提案する。

**返答:** skill の要約、主な設計判断、検証結果。
