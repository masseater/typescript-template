---
name: skill-authoring
description: このリポジトリの skill（`.claude/skills/<name>/SKILL.md`）を作る・直すときに読む。書き方の基準、検証、返答の形を決める。
license: MIT
metadata:
  upstream: https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/playbooks/authoring-a-skill.md
---

# skill の作成・変更

1. `.claude/skills/<name>/SKILL.md` に置き、frontmatter に `name`（ディレクトリ名と同じ）と `description` を書く。詳細は同じディレクトリの `references/` に分ける。
2. 検証する。frontmatter、参照ファイルの存在、他 skill へのリンクは `tools/dont-review-it/src/features/dont-review-it/repository/claude-skills.test.ts` がチェックする。
3. 構造的な規則ならテストを足す。主観的な内容なら足さない。
4. AGENTS.md の merge 手順に従って PR を出す。

既存の skill や AGENTS.md を削るときは `references/pruning.md` を読む。

迷ったら消す。判断を変える文だけを残す。何をするかを命じ、理由は書かない。理由がないと混乱する規則にだけ説明を付ける。文の調子は扱う範囲に合わせる。機械的に検出できる規則は skill に書かず型・lint・テストにする。「〜は〜に従う」「〜は〜が持つ」「〜は〜で定義する」のように置き場所だけを述べる文は書かない。繰り返し踏むのに skill になっていない手順があれば、新しい skill を提案する。

禁止は抽象語で書かず、避けたいパターンを具体的に列挙する。例外として許す形があれば、それも書く。出力に新しいパターンが現れたら列挙に足す。「よく考えて」「推論を書き出して」のように思考量を指示する文は書かない。途中で止まってほしくない手順では、止まり方の種類を名指しする（例: 次の手順を宣言する要約で終える）。

語は読み手が公式ドキュメントで目にする表記に合わせる。

- 識別子・API・コマンド・ライブラリの概念名は英語のまま backtick で囲む。
- 定訳のない語に訳語を作らない。カタカナ語として定着した語（コンポーネント、エントリポイント）はカタカナのまま書く。
- 言い換えるときは元の語の限定を落とさない（「型チェック」を「確認」にしない）。擬人化は別の擬人化に置き換えず、「警告なしに」「エラーを出さずに」のように何が起きないかで書く。
- textlint の AI 語の指摘には、意味を保つ英語や定着したカタカナ語で応える。意味の弱い和語に逃げない。`.textlintrc.json` の `allows` にはユーザーの指示なしに語を足さない。定着させたくない言い換えは `.textlint-ai-words.json` に足す。

**返答:** skill の要約、主な設計判断、検証結果。
