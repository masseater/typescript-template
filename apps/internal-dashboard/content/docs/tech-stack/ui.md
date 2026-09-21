---
title: Base UI と shadcn
description: 挙動は Base UI が持ち、見た目の部品はリポジトリ内に保持する
---

画面の部品は 2 層に分かれる。挙動の層と、見た目をリポジトリ内に保持する層である。

Base UI（`@base-ui/react`）は、見た目を持たない挙動を提供する。ボタンの無効化、メニューのキーボード操作、ダイアログのフォーカス拘束を部品が担う。画面側は、その挙動にクラス名を与えて用いる。

shadcn は、その挙動の上に載せる部品を依存パッケージのまま利用せず、リポジトリ内へ配置して保持する方式である。見た目は Tailwind CSS のクラスと CSS 変数で定義する。色、角丸、影、文字は部品が持ち、画面は余白のようなレイアウトのみを指定する。

部品を追加するときの判断は [フロントエンド](/guidelines/frontend) が持つ。

## 参照

- 挙動の公式ドキュメントは [Base UI](https://base-ui.com/) である。概要は [Overview](https://base-ui.com/react/overview)、ボタンは [Button](https://base-ui.com/react/components/button) に記載される。
- 部品の配置方式の公式ドキュメントは [shadcn/ui](https://ui.shadcn.com/docs) である。設定ファイルは [components.json](https://ui.shadcn.com/docs/components-json)、TanStack Start への導入は [TanStack Start](https://ui.shadcn.com/docs/installation/tanstack) に記載される。
- 見た目の組み合わせをブラウザ上で構成する環境は [shadcn/create](https://ui.shadcn.com/create) である。
- Base UI を既定とした経緯は [July 2026 - Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) に記載される。
