# @repo/dont-review-it

- レビューで答えが一意に決まる書き方を、oxlint の preset と CLI の検査で止める。
- 技術スタック: oxlint 1, Effect 4, Vite+ 0.3。
- npm へは `private` を付けず `publishConfig.access: public` で出す。公開する取り込み面は `dontReviewItPreset`。公開するコマンドは `dont-review-it` と `dont-review-it-canonical-literal-types`。
- MUST: 直し方が一意に決まらない問いはルールにしない。
- MUST: ルールを足すときは、同じ束の構成と `docs/lint` の文書を同じ変更に含める。
