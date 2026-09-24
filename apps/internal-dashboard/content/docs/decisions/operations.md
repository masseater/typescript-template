---
title: 運用の決めごと
description: 障害、漏えい、復旧、データの保存期間、問い合わせ、権限について決めたことを書き残すページ
---

公開してから慌てないように、公開の前に決めておくことを書きます。いつ決めるかは [リリースするとき](/checklists/release) にあります。

## 障害の連絡

- 運営側への警告は、GitHub Environment の secret に入れた宛先へ届きます。キーは [使い始める手順](/getting-started/first-steps) の 3. にあります。ここには、警告を受けてから誰が何分以内に見るかを書きます。
- 外から各アプリを定期的に見る監視は `infra/health-monitor`、エラーの通知は `infra/error-monitor` にあります。
- 利用者へ障害を知らせる場所（ステータスページ、SNS のアカウント）と、知らせる基準を書きます。
- 障害ごとの記録は [GitHub の issue](https://docs.github.com/ja/issues) に残し、ここには残し方だけを書きます。

## 漏えいの対応

- 漏えいか、そのおそれに気づいたときに、誰が判断し、誰が [個人情報保護委員会](https://www.ppc.go.jp/personalinfo/legal/leakAction/) へ報告し、どの手段で本人へ知らせるかを書きます。
- 速報と確報の期限から逆算した手順を書きます。

## バックアップと復旧

- どこまで戻せればよいか（RPO）と、何時間で戻すか（RTO）を書きます。
- 戻す手順と、実際に戻してみた日と結果を書きます。D1 の場合は [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) で戻します。

## データの保存期間

- 退会の申請から復元できる日数は `libs/config/src/features/config/member-retention.ts` にあります。変えたら、プライバシーポリシーの保管期間も同じ日に変えます。
- ログ、バックアップ、外部サービスに渡したデータを、それぞれ何日残すかを書きます。

## 問い合わせ

- 返答までの目安と、担当する人を書きます。利用者の窓口は [お問い合わせ](/pages/member-contact)、運営の受け口は [問い合わせの一覧](/pages/admin-inquiries) です。
- 外部のツールに移すときの基準（件数など）を書きます。

## セキュリティ

- 脆弱性診断をいつ、誰に頼むかと、結果の置き場を書きます。
- 外部の人が脆弱性を知らせる窓口を書きます。テンプレートには窓口がないので、決めたら [security.txt](https://securitytxt.org/) などで公開します。
- ボット対策、レート制限、WAF の方針を書きます。Cloudflare の設定は、ダッシュボードで変えずに `infra/cloudflare` で宣言します。

## 権限

- 管理者アプリ、GitHub、Cloudflare、決済代行業者のそれぞれで、誰がどの権限を持つかを書きます。
- 棚卸しの頻度と、抜けた人の権限を外す手順を書きます。
