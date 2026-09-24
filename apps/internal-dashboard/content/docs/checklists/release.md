---
title: リリースするとき
description: 公開日を決めてから、公開して振り返りを残すまで
---

- 始めるきっかけ: 公開日を決めたとき
- 終わる条件: 公開し、振り返りが残り、次の [やると決めたとき](/checklists/commit) に渡すものがある

## 公開の前

- 本番の DB を D1 のままにするかを決めます。本番のデータが入った後に替えると、データの移行も伴います。判断の分かれ目は [使い始める手順](/getting-started/first-steps) の 4. にあります。書く場所: 判断の結果は [サービスの定義](/decisions/service#性質と規模)。DB を替えるなら `infra/cloudflare` と `libs/db`
- 本番で使う決済代行業者を決めます。判断の分かれ目は [使い始める手順](/getting-started/first-steps) の 5. にあります。書く場所: [事業の決めごと](/decisions/business#料金と請求)
- 障害の連絡、漏えいの対応、復旧の目標、データの保存期間、問い合わせの担当を決めます。書く場所: [運用の決めごと](/decisions/operations)
- 特定商取引法に基づく表記と料金の表示を決めます。項目は [ビジネス面のチェックリスト](/getting-started/business-checklist) の「リリースするとき（公開の前）」にあります。書く場所: [事業の決めごと](/decisions/business#法令と届出)
- 利用規約とプライバシーポリシーの本文を決めます。書く場所: [管理者アプリの規約](/pages/admin-terms) の草稿
- 本番の値を決めます。書く場所: GitHub Environment `production` の secret。キーは [使い始める手順](/getting-started/first-steps) の 3. にあります。
- 受け入れの条件を満たしているかを確かめます。満たさない機能は公開から外すか、[機能フラグ](/tech-stack/openfeature) で閉じます。

## 公開の日

- 決める人が公開を承認します。本番への適用と承認の手順は [使い始める手順](/getting-started/first-steps) の 3. にあります。
- 利用規約とプライバシーポリシーの版を [管理者アプリの規約](/pages/admin-terms) で公開します。
- 検索に載せるパスを決めます。検索エンジン向けの設定を外したことは本番の応答で確かめます。初期値は [使い始める手順](/getting-started/first-steps) の 3. にあります。書く場所: `libs/runtime/src/features/runtime/responses.ts`
- 問い合わせの窓口が動くことを確かめます。利用者の窓口は [お問い合わせ](/pages/member-contact)、運営の受け口は [問い合わせの一覧](/pages/admin-inquiries) です。
- 決めておいた告知先へ告知します。

## 公開の後

- 品質の定義で決めた指標が本番で取れていることを確かめます。
- 振り返りを書きます。うまくいったことと次に変えることです。書く場所: 公開の milestone に紐づく issue
