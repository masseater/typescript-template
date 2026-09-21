---
title: アカウント
description: 利用者・運用担当・社内の人のアカウント、認証手段、セッション、招待の関係
---

[[会員アカウント]]・[[管理者アカウント]]・[[社内アカウント]] は別の実体である。1 つの人物が複数の立場を持つときは、アカウントも複数持つ。利用者アプリの資格情報で管理者アプリや wiki には入れない。[[セッション]] と [[招待]] もこの境界に入る。

## ER 図

```mermaid
erDiagram
  MemberAccount {
    string id PK
    string email UK
    boolean emailVerified
    enum status
    datetime createdAt
    datetime leftAt
  }
  AdminAccount {
    string id PK
    string email UK
    boolean emailVerified
    enum permission
    enum status
    datetime createdAt
  }
  StaffAccount {
    string id PK
    string email UK
    boolean emailVerified
    enum permission
    datetime createdAt
  }
  Credential {
    string id PK
    string accountId FK
    enum kind
  }
  Passkey {
    string id PK
    string accountId FK
    string credentialId UK
    enum audience
  }
  TotpFactor {
    string id PK
    string accountId FK
    boolean verified
  }
  Session {
    string id PK
    string accountId FK
    enum audience
    enum authenticationMethod
    boolean strong
    datetime expiresAt
  }
  Invite {
    string id PK
    string tokenHash UK
    string email
    enum targetKind
    enum permission
    string inviterId FK
    datetime expiresAt
    datetime acceptedAt
  }
  MemberAccount ||--o{ Credential : owns
  MemberAccount ||--o{ Passkey : owns
  MemberAccount ||--o{ TotpFactor : owns
  MemberAccount ||--o{ Session : opens
  AdminAccount ||--o{ Credential : owns
  AdminAccount ||--o{ Passkey : owns
  AdminAccount ||--o{ TotpFactor : owns
  AdminAccount ||--o{ Session : opens
  StaffAccount ||--o{ Credential : owns
  StaffAccount ||--o{ Passkey : owns
  StaffAccount ||--o{ TotpFactor : owns
  StaffAccount ||--o{ Session : opens
  Invite }o--o| AdminAccount : creates
  Invite }o--o| StaffAccount : creates
```

## 不変条件

- MemberAccount の `status` は `active` / `suspended` / `left` のどれか 1 つである。有料か無料かは [契約](/data-model/billing) の PlanSubscription が決める
- `suspended` の MemberAccount はログインできず、開いていた Session は閉じ、他の利用者から見えない。データは残り、`active` に戻せば元どおりになる
- AdminAccount の `permission` は「閲覧のみ」「操作できる」「管理者を追加できる」のどれか 1 つで、招待のときに決まる。DB のブートストラップで作る最初の AdminAccount は「管理者を追加できる」になる
- AdminAccount の `status` は `active` / `suspended` のどちらかで、`suspended` の AdminAccount は管理者アプリにログインできない
- StaffAccount の `permission` は「閲覧のみ」「変更できる」のどれか 1 つで、招待のときに決まる。DB のブートストラップで作る最初の StaffAccount は「変更できる」になる
- 「管理者を追加できる」の有効な AdminAccount と「変更できる」の有効な StaffAccount は、それぞれ最後の 1 人を下げたり無効にしたり削除したりできない
- Session の `audience` は、そのアカウントが入れるアプリのうち、実際に開いたアプリと一致する。会員は利用者アプリ、管理者は管理者アプリ、社内の利用者は wiki にだけ入れる
- 管理者アプリと wiki の管理操作に入れる Session は、パスキー、またはパスワードに認証アプリを重ねた認証だけを強い認証とする。バックアップコードだけの Session は強くない
- Invite の `targetKind` は `admin` か `staff` で、受け取り側のアプリが決まる。利用者の新規登録は Invite を使わない
- Invite はトークンの SHA-256 ハッシュだけを持ち、平文のトークンは招待メールにしか現れない。有効期限は発行から 7 日で、`acceptedAt` が入った Invite は二度と受け取れない
- 同じ `email` に開いている Invite は同時に 1 つまでで、すでに登録されている `email` には発行できない

## 画面

- 利用者の登録と確認: [新規登録](/pages/member-signup)
- 利用者のログイン: [ログイン](/pages/member-login)
- 管理者のログインと招待: [管理者のログイン](/pages/admin-login)、[管理者](/pages/admin-admins)
- 社内の利用者: [社内ダッシュボードのレイアウト](/pages/internal-dashboard-layout)
