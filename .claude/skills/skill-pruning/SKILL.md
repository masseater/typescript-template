---
name: skill-pruning
description: 既存の skill（`.claude/skills/<name>/`）や AGENTS.md の文を削って短くするときに使う。消す候補を選び、その文がある版とない版で同じ依頼を実行して、結果が変わらない文だけを消す。
metadata:
  upstream:
    - https://github.com/vltansky/skills/blob/main/skills/agents-md-evals/SKILL.md
    - https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md
    - https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md
    - https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md
---

# skill の文を削る

1. 対象を 1 つの skill か 1 つの AGENTS.md に絞り、全文を読む。skill-authoring の基準に反する文と、`references/deletion-criteria.md` に当たる文を候補として一覧にする。
2. lint・型・テストで検出できる候補は、先にチェックを実装してから文を消す。
3. 残りの候補ごとに、その文がないと結果が変わりそうな依頼を、このリポジトリの直近の commit と PR から 2〜3 件作る。
4. worktree を 2 つ作り、片方は候補の文を残した版、もう片方は消した版にする。
5. 同じ依頼を両方の worktree で `claude -p` に 3 回ずつ渡し、`references/verification.md` の基準で判定する。
6. 消すと決めた文を消す。1 回の変更で消すのは 1 つの節までにする。skill 全体を LLM に要約させたり書き直させたりしない。
7. 消した文、試した依頼、両方の版の結果を commit ログに書き、skill-authoring の手順で PR を出す。

返答には、消した文の数と行数の変化、残した候補とその判定結果、追加したチェックを書く。
