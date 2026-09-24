---
name: presentation
description: プレゼン資料（登壇、社内説明、提案、勉強会、デモ）を作る・直すときに使う。要件、構成、台本、スライドの順に組み立て、スライドは構成から作る。出力形式（HTML、pptx など）を問わず使う。
license: MIT
metadata:
  upstream: https://github.com/vicky-tiq/skill-presentation-build
  upstream-storytelling: https://github.com/ericgandrade/claude-superskills/tree/main/skills/storytelling-expert
---

# プレゼン資料の作成

## スライド

- 発表者が口頭で話す説明、つなぎ、結論に至る理由は、スライドから発表者ノートへ移す。
- スライドに残すのは、聞き手が目で見る必要があるもの（数値、図、比較、固有名詞、コード、話の見出し）だけにする。
- 文章の段落は、キーワードか図に置き換える。
- 1 枚に主張が 2 つ以上あれば、スライドを分ける。
- どのスライドも同じ数・同じ長さの箇条書きになっていたら、内容に合わせて図や 1 行に変える。
- 口頭の説明なしで読まれる資料（配布資料、発表なしの共有）では、説明を本文に書いてよい。

## 手順

基準は `references/` にあり、この手順は順番を変えずに進める。構成が決まる前にスライドを作らない。

1. `presentations/<YYYY-MM-DD>-<slug>/`（以下 `<資料>`）を作り、以降の成果物をすべてここに置く。既存の資料を直すときはその資料のディレクトリを `<資料>` にする。
2. `references/brief.md` に沿って `<資料>/brief.md` を書く。目的、聴衆、覚えて帰ってほしい 1 文を、渡された素材から読み取れなければユーザーに 1 問ずつ聞く。1 文にまとまらないうちは次へ進まない。
3. `references/structures.md` から話の型と本論の並べ方を 1 つずつ選び、`<資料>/brief.md` の末尾に、選んだ型と並べ方を書く。
4. `references/section-map.md` に沿って `<資料>/section-map.md` を書き、ユーザーに見せて直してもらう。直しが返るまで台本とスライドに進まない。
5. `references/script.md` に沿って `<資料>/script.md` を書く。
6. 冒頭の「スライド」に沿って、台本の各文を目で見る必要があるものと口頭で話すものに分け、目で見るものだけと `references/slides.md` の基準でスライドを作る。口頭で話すものは発表者ノートと台本に置く。形式の指定がなければ `<資料>/index.html` 1 ファイルにする。pptx など別の形式を指定されたらその形式で作り、中身はこの手順の成果物から作る。
7. `references/checklist.md` の全項目を確かめる。スライドは agent-browser で全枚を表示し、スクリーンショットで文字のはみ出し、重なり、読めない大きさがないかを見る。落ちた項目は該当する手順に戻って直す。
8. AGENTS.md の merge 手順に従って PR を出す。

返答: 覚えて帰ってほしい 1 文、選んだ型、セクション数と時間配分、成果物のパス、`references/checklist.md` で落ちて直した項目。
