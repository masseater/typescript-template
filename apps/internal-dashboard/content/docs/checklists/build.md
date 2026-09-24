---
title: 作っているとき
description: 計画に沿って作り、最初のデプロイを経て、受け入れの条件を満たすまで
---

- 始めるきっかけ: [やると決めたとき](/checklists/commit) の終わる条件を満たしたとき
- 終わる条件: 受け入れの条件を満たし、[リリースするとき](/checklists/release) へ移れる

## 作り始めるとき

- サービス名と LP の文言を決めます。書く場所: `apps/service-member/src/shared/config/service.ts` と [LP](/pages/member-lp)。手順は [使い始める手順](/getting-started/first-steps) の 1. にあります。
- 残す概念と捨てる概念を決めます。書く場所: [データモデル](/data-model/overview)、[用語集](/glossary)、`libs/db` のスキーマ。手順は [使い始める手順](/getting-started/first-steps) の 2. にあります。

## 最初に staging へデプロイする前

- 環境ごとの名前の接頭辞、ドメイン、送信元のメールアドレス、警告の宛先、月の予算を決めます。書く場所: GitHub Environment `staging` の secret。キーと形式は [使い始める手順](/getting-started/first-steps) の 3. にあります。
- 外部サービスの契約とアカウントを、決めた持ち主の名義で作ります。書く場所: [事業の決めごと](/decisions/business#ドメインとアカウント)
- 料金と無料期間をテンプレートの初期値から変えるかを決めます。書く場所: [事業の決めごと](/decisions/business#料金と請求) に挙げたコードのファイル

## 作っているあいだ

- 開発は [開発の流れ](/getting-started/development-flow) に沿って進めます。品質の確認は CI とレビューで行います。
- 品質の定義で決めた指標を、作った機能ごとに測れるようにします。信号の層は [Observability](/observability) にあります。
- 仕様を決めたらその日のうちに wiki の該当ページを直します。決めた経緯はコミットログに書きます。
- 決めた頻度で進み具合を報告します。想定する利用者には staging で途中のものを触ってもらい、その反応を issue に残します。
- リスクの一覧の対応を実行します。新しく見つかったリスクはラベルを付けた issue にします。
- 作業の偏りを見て、人の割り当てを直します。
