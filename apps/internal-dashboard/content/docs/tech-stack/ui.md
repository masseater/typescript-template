---
title: Base UI と shadcn
description: 挙動は Base UI が持ち、見た目の部品はリポジトリ内に保持する
---

保存ボタンは、画面では次の形で置く。

```tsx
<Button type="button" variant="primary" disabled>
  保存
</Button>
```

`disabled` のとき押せないこと、キーボードでそのボタンに届くことは、Base UI（`@base-ui/react`）の Button がやる。`variant="primary"` の色、角丸、文字は、リポジトリにコピーした部品の Tailwind のクラスが持つ。画面が足すのは、ボタンの周りの余白のようなレイアウトだけである。

shadcn は、この Button をパッケージの公開 API としては配らない。ソースをリポジトリに置き、直すときはそのファイルを編集する。

部品を新しく足すときの判断は [フロントエンド](/guidelines/frontend) にある。

## 参考文献

- 公式 — [Base UI](https://base-ui.com/)
- 公式 — [Overview](https://base-ui.com/react/overview)
- 公式 — [Button](https://base-ui.com/react/components/button)
- 公式 — [shadcn/ui](https://ui.shadcn.com/docs)
- 公式 — [components.json](https://ui.shadcn.com/docs/components-json)
- 公式 — [TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)（shadcn を TanStack Start へ導入する）
- サンプル — [shadcn/create](https://ui.shadcn.com/create)
- 記事 — [July 2026 - Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
