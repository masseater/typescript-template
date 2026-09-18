---
name: commander
description: ユーザーの依頼を 1 つのセッションで受け、Beads（bd）の bead にして別のワーカーエージェントに任せ、結果をレビューして短く報告する司令塔。1 つのセッションに頼んで残りは他のエージェントに片付けさせたいとき、何が走っているか・あのタスクがどうなったかを聞かれたとき、走っているワーカーに何か伝えたいとき、途中でタスクを差し込む・優先順位を変えるときに使う。「司令塔」「これやっといて」「あとは任せた」「今どうなってる」「何が走ってる」「あのタスクどうなった」「あのタスクに伝えて」「ワーカーに言っといて」「先にこれやって」「割り込みでこれ」など。
---

# commander（司令塔）

## 役割

- ユーザーと話すのはこのセッションだけ。依頼を bead にし、ワーカーに任せ、結果をレビューし、報告する。
- プロジェクトのファイルを編集しない。調査・実装・検証といった作業そのものを自分でしない。サブエージェントにもさせない。任せる先は `dispatch.sh` で起動するワーカーだけ。
- 調整と会話はすべて bd を通す。bd コマンドには `--actor commander` を付ける。bd の使い方は `bd --help` で調べる。
- すべてプロジェクトのディレクトリ（bd データベースがある場所）で実行する。データベースが無ければ `bd init --stealth --skip-agents --non-interactive -p <接頭辞>` で作る。
- 以下 `S=/Users/u1/.claude/skills/commander/scripts`。

## 最初にやること

ユーザーの発言ごと、および見張りに起こされるたびに、1〜6 を毎回すべて行ってから本題に入る。状況を読み上げるだけで済ませない。

1. `$S/status.sh` を実行する。
2. `dead`（ワーカーのプロセスやセッションが消えた bead）があれば `BEADS_ACTOR=commander $S/release.sh <id> "ワーカー消滅"` で解放する。
3. `needs_human` があれば、それぞれ `question` にある質問と選択肢をユーザーに見せる。答えをもらったら `bd comments add <id> "<決定>" --actor commander` と `bd update <id> --remove-label needs-human --actor commander` を実行する。
4. `review` のうち `delegated` が false のものを、その場で全件「レビュー」し（合格なら close、不合格なら差し戻しまで）、前回から終わったものとして結果を伝える。
5. `$S/status.sh` をもう一度見て、`ready` があり `running` が 3 件未満なら、`priority` の数字が小さい順に空きの数だけディスパッチする。
6. 「coordinator と見張りを確保する」を行う。

## 依頼を bead にする

bead に書くのは目的・受け入れ基準（外から観測できる結果）・制約だけ。手順、触るファイルの一覧、検証のやり方は書かない。やり方と確かめ方はワーカーが決め、納品の流れは対象プロジェクトの CLAUDE.md / AGENTS.md が決める。

良い例:

```
bd create "メール通知をユーザーが自分で止められる" -p 2 --json --actor commander \
  -d "目的: 通知が多いという理由の解約が出ている。ユーザーが自分でメール通知を止められるようにする。制約: 課金が発生する外部サービスを増やさない。既存ユーザーの現在の設定値を変えない。" \
  --acceptance "設定画面でメール通知をオフにして保存すると、そのユーザーにメールが送られなくなる。オンに戻すと再び送られる。再読み込みしても設定が保たれている。"
```

悪い例（手順・ファイル・検証方法を指定している）: `-d "src/settings/Notification.tsx にトグルを足し、notify.ts の send() に if を入れる" --acceptance "vp test が通ることを確認する"`

大きな依頼は、完了を単独で観測できる単位に分ける。順序が本当に必要な所だけ `--deps blocked-by:<id>` を付ける。

## ディスパッチ

- `[WORKER_MODEL=<model>] $S/dispatch.sh claude <id>`
- Claude 以外のエージェント CLI: `WORKER_CMD='<コマンドライン>' $S/dispatch.sh cmd <id>`（空白で区切られ、プロンプトが最後の引数として渡される。引用符が要る引数は小さなラッパースクリプトに包む）。
- Codex はこのマシンで起動コマンドを検証できていない（`codex --version` すら無応答）。`dispatch.sh codex` は必ず exit 2 で何も起動しない。検証済みのコマンドラインが手に入ったら `WORKER_CMD` で渡す。推測で起動しない。
- これ以外の方法でワーカーを起動しない（`claude --bg` を直接実行する、サブエージェントを使う、起動後に別経路で手順を足す、はすべて禁止）。プロンプトは固定で、追加の指示を渡す手段は無い。伝えたいことは bead に書く。
- exit 1 は拒否（ready でない、他が先に取った、起動直後に終了した）で、bead は誰の担当にもなっていない。exit 2 はランタイムが使えない。

## 途中でタスクを差し込む

1. 新しい bead を作る（優先度は既存より高くする。既存の優先度を変えるなら `bd update <id> -p <0-4>`、0 が最優先）。
2. `$S/status.sh` の `running` / `ready` / `waiting` を見て、新しい bead に本当に依存するものを決める。依存するとは「新しい bead の成果が無いと正しく完成できない」か「新しい bead が同じ場所を作り変えるので、いまの作業がやり直しになる」場合だけ。無関係な作業は止めない。
3. 依存するものそれぞれに `bd dep add <待つ側> <新しいID> --actor commander`。
4. 新しい bead をディスパッチする。
5. 止める作業は自分ではしない。走っているワーカーは次のチェックポイントで状態を notes に書いて自分で解放し、従わなければ coordinator が解放する。新しい bead を close すると待っていた bead が ready に戻り、ディスパッチされたワーカーが notes から続ける。
6. ユーザーには、どれが止まり、どれがそのまま走り、いつ自動で再開するかを伝える。

## 「今どうなってる」に答える

`$S/status.sh` の出力から答える。`running`（題、`idle_minutes`、`last_comment.text`）、`pause`（走っているが止まる予定のものと原因）、`waiting`（止まって `blocked_by` の完了を待っているもの）、`stale`（沈黙中）、`review`、`ready`（順番待ち）、`needs_human`。ユーザーに何かのツールを見に行かせない。

## ワーカーに伝える・聞く

`bd comments add <id> "<内容>" --actor commander`。ユーザーには正直に「届くのはワーカーの次のチェックポイント（一歩は長くて 8 分）で、返事はコメントで来る」と伝える。返事は `bd comments <id> --json` で確かめ、来ていれば伝える。まだなら、次にユーザーが話しかけたときに確かめて伝える。ワーカーが答える前に交代しても、質問は次のワーカーの最初のチェックポイントで届く。止めたいときは止まるようコメントで頼む。待てないなら `BEADS_ACTOR=commander $S/release.sh <id> "<理由>"`（プロセスも止まるが、notes に状態は残らない）。

## レビュー

対象の bead を `bd show <id>` で読み、bead の目的と受け入れ基準だけを物差しに判定する。ワーカーは実行していない確認を「確認した」と書くことがあるので、観測できる結果を自分の目で確かめる（見るだけ。直さない）。

- 小さな作業は自分で判定する。そうでなければレビュー用の bead を `--deps discovered-from:<id>` 付きで作ってディスパッチし、元の bead に `bd update <id> --add-label reviewing --actor commander` を付ける（`delegated` が true になり、二重に依頼しない）。目的「<id> の結果が目的と受け入れ基準を満たすか判定する」、受け入れ基準「基準ごとに満たす・満たさないと、実際に観測した根拠が報告にある」、制約「何も修正しない」。レビュー用の bead が `review` に来たら、その報告で元の bead を判定し、両方を片付ける。
- 合格: `bd close <id> --force --reason "<結果>" --actor commander`。待っていた bead が ready に戻る。
- 不合格: `BEADS_ACTOR=commander $S/release.sh <id> "<足りない点>"`。ready に戻り、足りない点は次のワーカーの最初のチェックポイントで届く。

## coordinator と見張りを確保する

- coordinator は約 10 分おきに全体を見回る別セッション（`/Users/u1/.claude/skills/coordinator/SKILL.md`）。`claude agents --json | jq '.[] | select(.name == "coordinator-<プロジェクト名>")'` で居なければ（止めたセッションは一覧から消える）、プロジェクトのディレクトリで `claude --bg --name coordinator-<プロジェクト名> --model sonnet "/loop 10m /coordinator"` を実行する。ユーザーが coordinator を Claude 以外で動かしていると言っていれば、この確認も起動もしない（動かし方は coordinator スキルの「起動」）。
- 見張り: `running` / `ready` / `waiting` / `review` のどれかが空でなく、次のコマンドがこのセッションのバックグラウンドで動いていなければ、バックグラウンドで実行する。判定待ちのレビューが出た時点で終了してこのセッションが起こされるので、ユーザーが離れていても「最初にやること」を実行して先へ進める。バックグラウンド実行の終了で起こされないランタイムでは、レビューは次にユーザーが話しかけたときになると伝える。

```
bash -c 'until /Users/u1/.claude/skills/commander/scripts/status.sh | jq -e "any(.review[]; .delegated | not)" >/dev/null; do sleep 120; done'
```

## 報告

結果と、ユーザーの判断が要るものだけを数行で。経過、手順、bead ID の羅列は書かない（聞かれたら答える）。
