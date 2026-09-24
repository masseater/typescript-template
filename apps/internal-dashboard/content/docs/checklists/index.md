---
title: 場面ごとにやること
description: 事業の案が出てから畳むまで、いつ何を決め、決めたことをどこに書くかを並べる
---

事業の案が出てから畳むまでを時間の順に区切り、その時点で決めることと書く場所を並べます。開発は「作っているとき」の中の作業の 1 つで、事業や運用や広報と同じ並びに置きます。

計測、請求、法令、企業への販売のように、詳しい人がいないと気づかない事業の決めごとは [ビジネス面のチェックリスト](/getting-started/business-checklist) に同じ場面の順で並べています。

## 時間の順

| 順 | 節 | 始めるきっかけ | 主に書く場所 |
| --- | --- | --- | --- |
| 1 | [案が出たとき](/checklists/idea) | 事業の案を人に話し、検討に時間を使い始めた | 案の issue |
| 2 | [やると決めたとき](/checklists/commit) | 予算か人を割くと決めた | [サービスの定義](/decisions/service)、milestone |
| 3 | [作っているとき](/checklists/build) | やると決めたときの終わる条件を満たした | GitHub Environment、コード、[事業の決めごと](/decisions/business) |
| 4 | [リリースするとき](/checklists/release) | 公開日を決めた | [運用の決めごと](/decisions/operations)、規約の版 |
| 随時 | [変更や問題が起きたとき](/checklists/change) | 計画にない依頼、障害、想定外の出来事が起きた | 変更や障害の issue |
| 定期 | [定期的に見るとき](/checklists/periodic) | 週、月、四半期、年の区切りが来た | 見た結果の issue |
| 最後 | [畳むとき](/checklists/wind-down) | サービスか機能を終わらせると決めた | 終了の issue |

リリースは一度では終わりません。機能を足すたびに 2 から 4 までを回します。公開した後は「変更や問題が起きたとき」と「定期的に見るとき」がずっと並走します。

## 書く場所

決めたことは、種類ごとに次の場所に書きます。同じことは 2 か所に書かず、片方からもう片方へリンクします。

| 種類 | 書く場所 |
| --- | --- |
| 続けて参照する決めごと | [サービスの定義](/decisions/service)、[事業の決めごと](/decisions/business)、[運用の決めごと](/decisions/operations) |
| デプロイに渡す値 | GitHub Environment の secret。キーは [使い始める手順](/getting-started/first-steps) の 3. |
| 料金や保存期間のようにコードが使う値 | コード。wiki には値を写さず、ファイルの場所を書く |
| 利用規約とプライバシーポリシーの本文 | [管理者アプリの規約](/pages/admin-terms) で公開する版 |
| 検討の途中、一度きりの判断、障害の記録 | [GitHub の issue](https://docs.github.com/ja/issues) |
| 期限と節目 | [GitHub の milestone](https://docs.github.com/ja/issues/using-labels-and-milestones-to-track-work/about-milestones) |
| コードを変えた理由 | コミットログ |

## 項目の書き方

各ページの冒頭に始めるきっかけと終わる条件を置き、項目ごとに何を決めるかと書く場所を並べます。手順はここに書かず、手順を持つ文書へリンクします。

節の区切りは [PMBOK ガイド第 8 版](https://www.pmi.org/standards/pmbok) の Focus Area（活動の種類）を場面に読み替えたものです。
