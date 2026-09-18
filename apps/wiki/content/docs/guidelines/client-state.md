---
title: クライアントの状態
description: 画面が扱う値ごとに、正本をどこに置き、どの仕組みで持つかを決めるための判断基準
---

画面が扱う値には、正しい値を持つ場所がそれぞれ 1 つある。この文書ではそれを正本と呼ぶ。守りたいのは、どの値についても正本が 1 つに決まり、その持ち方がコードの置き場所から読み取れる状態である。
同じ値を 2 つの仕組みが持つと、片方だけが更新されて表示が食い違い、どちらを直すべきかを読み手が判定できなくなる。

使えない API と、仕組みごとの置き場所のうち機械が判定できる部分は、lint と依存の検査が持つ。この文書が持つのは、値の正本がどこにあるかという、機械が判定できない境界だけである。

## 正本を決める

- MUST: 値を持たせる前に、その正本がサーバー・URL・端末・画面のどこにあるかを決める
- PROHIBIT: 1 つの値を 2 つの仕組みに持たせる
- IF: 正本がどこにあるかを決められない; THEN MUST: 実装する前に確認を求める

## 正本がサーバーにある値

admin・wiki・`libs/ui` の読み込みは、まだ `requestAtom` で持っている。この節の Query に関する項目は、user アプリに対して効いており、それ以外にはそれぞれを Query へ移した時点から効く。

- IF: `requestAtom` が既に持っている読み込みを直す; THEN MAY: Query へ移すまで `requestAtom` のまま直す
- IF: 正本がサーバーにある値を新しく読む; THEN
  - MUST: TanStack Query で読む
  - MUST: `queryOptions` を FSD の `api` segment に置く
  - PROHIBIT: Effect Atom で読む
- IF: 複数の箇所に表示しているサーバーの値を、保存の完了を待たずに書き換えて見せる; THEN
  - MUST: TanStack DB の Query collection に持たせ、collection への書き込みで反映する
  - MUST: collection の同期を、上の項目で決めた Query の読み込みに任せる
  - PROHIBIT: Query のキャッシュや Effect Atom を手で書き換えて反映する
  - 失敗したときの巻き戻しと、同じ値を表示している全箇所への反映は、collection が持つ

## 正本が URL にある値

- IF: URL へ書き戻す前の入力中の値である; THEN MUST: URL の値を鍵にした `Atom.family` で持つ
- IF: リロードやリンクの共有で復元したい値である; THEN
  - MUST: TanStack Router の search に置き、Effect Schema で検証する
  - PROHIBIT: 同じ値をクライアントの状態に写して持つ

## 正本が端末にある値

いま、この種類の値は無い。この節は、端末に残す値を初めて足した時点から効く。

- IF: サーバーへ送らず、次に開いたときにも残したい値である; THEN MUST: Effect Atom の `Atom.kvs` で持つ

## 正本が画面にある値

この節の項目は、当てはまる範囲が狭いものから並べてある。最初に当てはまった項目に従う。

- IF: `<form>` で送信する入力値と、その検証である; THEN
  - MUST: TanStack Form で持つ
  - MUST: 検証に、サーバーが同じ値を検証する Effect Schema の定義をそのまま渡す
  - この項目は、[コードの書き方](/guidelines/writing-code) の「外から入った値を内側の型にする」にある、判定を書く手段を 1 つに保つ規範に乗る
- IF: 利用者の操作で始まる非同期処理の、進行中と失敗である; THEN
  - MUST: `libs/ui` の `useAction` で持つ
  - PROHIBIT: フォームの送信だけを TanStack Form の送信状態で持つ
- IF: 入力やイベントの発火を間引く; THEN MUST: TanStack Pacer で間引く
- IF: 別の値が変わったら作り直す値である; THEN MUST: その値を鍵にした `Atom.family` で持つ
- IF: 画面の上で生まれて画面を離れたら消えてよい値である; THEN
  - MUST: Effect Atom で持つ
  - MUST: 1 つのコンポーネントだけが読む値を `libs/ui` の `localState` で持つ
  - MUST: 複数の部品が読む値を、モジュールに置いた Atom で持つ
  - PROHIBIT: TanStack DB の local-only collection で持つ

## 値として持たないもの

- IF: 長いリストのうち描画する範囲を計算する; THEN
  - MUST: 範囲の計算を TanStack Virtual に任せる
  - MUST: その周りで足す値を、この文書の区分に従って持つ
