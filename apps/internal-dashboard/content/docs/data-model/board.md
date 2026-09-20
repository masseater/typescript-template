---
title: 掲示板
description: スレッドと投稿、著者、タイムラインの関係
---

会員がトピックごとに書き込むための境界である。ホームのフィードが追う「動き」の 1 つでもある。

## ER 図

```mermaid
erDiagram
  BoardThread ||--o{ BoardPost : contains
  MemberAccount ||--o{ BoardThread : opens
  MemberAccount ||--o{ BoardPost : writes
  BoardThread {
    string id PK
    string authorId FK "退会で null"
    string title "100 文字まで"
    datetime createdAt
    datetime lastPostedAt
    int postCount
  }
  BoardPost {
    string id PK
    string threadId FK
    string authorId FK "退会で null"
    string body "5,000 文字まで"
    datetime createdAt
  }
```

## 不変条件

- 掲示板を読み書きできるのは会員だけである。無料・有料を問わず、すべての会員がスレッドを立て、返信できる
- 読める・書ける・著者として名前を出せる、の 3 つは同じ 1 つの会員の条件で判定する。停止中の会員を除く条件はこの 1 か所に足す
- BoardThread を作ったとき、本文を持つ最初の BoardPost を同じ操作で 1 件作る
- BoardPost を作ったとき、同じ操作で BoardThread の `postCount` を 1 進め、`lastPostedAt` を投稿の日時にする
- スレッドの一覧は `lastPostedAt` の新しい順である
- 停止中・退会済みの著者の投稿は、スレッド上では「利用できない利用者」として出し、プロフィールへは進めない。退会で著者の行が消えても投稿は残る
- 自分をブロックしている利用者の新規スレッドと投稿は、自分の一覧と詳細に出さない
- 投稿の削除は著者本人か、管理者の処置だけが行う。削除した投稿の位置は空けず、削除済みであることを示す

## 画面

- [掲示板](/pages/member-board)
- [ホーム](/pages/member-home)
- [通知](/pages/member-notifications)
