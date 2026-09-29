<!-- fallow:agent-install v1 authored sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -->
<!-- fallow:agent-install v1 claude-import:start -->

@AGENTS.md
<!-- fallow:agent-install v1 claude-import:end -->

# CLAUDE.md

## 最上位原則

強制・推奨・指示の手段は次の順で選ぶ。

1. ライブラリ公式の統合手段を使う。lint ルール、skill、plugin、CLI、diagnostics などである。
2. 公式になければ、既にそれを実現しているライブラリやツールを探して使う。
3. それもなければ、方針や注意点を提言しているブログ・issue・discussion を探して従う。
4. 自作は本当の最終手段である。自作するときは、何を探して何が合わなかったかをコミットメッセージに残す。

検査を通すために設定を無効化・簡易化したり、閾値を下げたりしてはならない。
数値の設定はツールの既定値を保つ。

## ドキュメントとコメント

- ドキュメントはすぐ腐るため、必要最小限にする。
- コードを説明する手書きドキュメントは書かない。価値があるのは自動生成されたものだけである。
- 手書きの文章は root の CLAUDE.md・SPEC.md・DESIGN.md と root の docs/ に限る。
- コードコメントは書かない。「なぜ」はコミットメッセージに書く。

## 配置

- 設定を含むあらゆるものをワークスペース内に置く。
- lint・fmt・check だけは Vite+ の仕様上 root の単一設定である。
- アプリの src/ 直下には FSD のレイヤーだけを置く。
- FSD はコロケーションが本質である。使われる場所の近くに置き、再利用されるまで切り出さない。

## 状態

- UI 状態は effect-atom、サーバー状態は TanStack Query だけで扱う。
- 状態は boolean フラグの組ではなく、排他的な status として判別共用体で表す。

## 検証

作業の完了は `vp run verify` が通ることである。
