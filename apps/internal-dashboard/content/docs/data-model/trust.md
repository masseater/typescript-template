---
title: 信頼と安全
description: 規約の版、同意、問い合わせ、通報、処置の関係
---

規約への同意と、問い合わせ・通報・利用者への処置の境界である。会話の中身はここにも載せない。

## ER 図

```mermaid
erDiagram
  AgreementVersion ||--o{ AgreementAcceptance : receives
  MemberAccount ||--o{ AgreementAcceptance : accepts
  Inquiry ||--o{ InquiryMessage : has
  Inquiry }o--o| MemberAccount : from-member
  Report }o--|| MemberAccount : target
  Report }o--o| MemberAccount : reporter
  ModerationAction }o--|| MemberAccount : target
  ModerationAction }o--|| AdminAccount : actor
  AgreementVersion {
    string id PK
    string version UK
    enum kind
    string body
    string summary
    datetime createdAt
    string createdBy FK
    datetime publishedAt
    string publishedBy FK
  }
  AgreementAcceptance {
    string memberId FK
    string versionId FK
    datetime acceptedAt
  }
  Inquiry {
    string id PK
    enum channel
    enum status
    string email
    string subject
    datetime createdAt
  }
  InquiryMessage {
    string id PK
    string inquiryId FK
    enum authorKind
    string body
    datetime createdAt
  }
  Report {
    string id PK
    string targetMemberId FK
    string reporterMemberId FK
    enum reason
    enum status
    string body
    datetime createdAt
  }
  ModerationAction {
    string id PK
    string targetMemberId FK
    string actorAdminId FK
    enum kind
    string note
    datetime createdAt
  }
```

## 不変条件

- AgreementVersion の `kind` は `terms` か `privacy` である。`kind` ごとに、登録時に同意を要するか・未同意のあいだ会員の操作を止めるかを設定が持つ。今は両方が登録時に必須で、操作を止めるのは `terms` だけである
- `version` は種類をまたいで一意である。`publishedAt` が入った版は本文を変えられず、公開は取り消せない。公開したときは AuditEvent に `agreement_published` を残す
- AgreementAcceptance は公開済みの版にだけ作れる。同じ会員と版の組は 1 件で、会員を消すと消えるが、版は同意が残るあいだ消せない
- 会員に求める再同意の判定は 1 か所で行う。会員ごとに「公開済みの最新版に未同意の `kind` の集合」を返し、登録時の同意、API の門、会員の画面はそれを使う
- 公開の `/contact` から来る Inquiry は MemberAccount を持たないことがある。会員の `/support` から来る Inquiry は MemberAccount を必ず持つ
- Inquiry への返信は管理者アプリだけが書く。wiki は読むだけで InquiryMessage を足さない
- Report の `status` は `open` / `actioned` / `dismissed` である。処置したら対応する ModerationAction を 1 件以上残す
- ModerationAction の `kind` は少なくとも `suspend` / `unsuspend` / `warn` を持つ。停止と解除は MemberAccount の `status` と同時に変わる

## 画面

- [規約への同意](/pages/member-agreement)
- [お問い合わせ](/pages/member-contact)
- [会員のお問い合わせ](/pages/member-support)
- [管理者の問い合わせ](/pages/admin-inquiries)
- [通報](/pages/admin-reports)
- [利用者の詳細](/pages/admin-member-detail)
- [規約](/pages/admin-terms)
