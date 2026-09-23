---
title: Base UI と shadcn
description: 挙動は Base UI が持ち、見た目のコンポーネントはリポジトリ内に保持する
---

ボタンの無効化、メニューのキーボード操作、ダイアログのフォーカス移動は Base UI（`@base-ui/react`）が持つ。見た目は持たない。色、角丸、文字は、shadcn がリポジトリへコピーしたコンポーネントの Tailwind のクラスが持つ。画面が指定するのは余白のようなレイアウトだけである。

```tsx
<Button type="button" variant="primary" disabled>
  保存
</Button>
```

`disabled` は Base UI の Button に渡る。`variant="primary"` がどのクラスになるかは、コピーしたコンポーネントのファイルに書いてある。shadcn のコンポーネントはパッケージの公開 API として依存せず、そのファイルを編集して見た目を変える。

コンポーネントを足すときの判断は [フロントエンド](/guidelines/frontend) にある。

## 採ると

| 見ているもの | 採る前 | 採ったあと |
| --- | --- | --- |
| `disabled` のボタン | 無効化、キーボード操作、フォーカス移動を画面が書く | Base UI の Button がそれらを持つ。見た目は持たない |
| `variant="primary"` | 色と角丸のクラスを、画面ごとに書く | どのクラスになるかは、コピーしたコンポーネントのファイルに書いてある。画面が指定するのは余白だけである |
| 見た目を変える | パッケージの公開 API の版を上げて、差分を追う | コピーしたファイルを編集する。そのファイルを公開 API として依存しない |

## 参考文献

- 公式 — [Base UI](https://base-ui.com/)
- 公式 — [Overview](https://base-ui.com/react/overview)
- 公式 — [Button](https://base-ui.com/react/components/button)
- 公式 — [shadcn/ui](https://ui.shadcn.com/docs)
- 公式 — [components.json](https://ui.shadcn.com/docs/components-json)
- 公式 — [TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)（shadcn を TanStack Start へ導入する）
- サンプル — [shadcn/create](https://ui.shadcn.com/create)
- 記事 — [July 2026 - Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
