# 部品の API

大本: https://imply.io/blog/an-opinionated-guide-to-component-apis

出典は設計システムの部品 API の指針である。このリポジトリでは `@repo/ui` とアプリの `shared/ui` が既に密封されている。出典の `css` / 公開 `className` / 公開 render prop は採らない。

## イベント

| 使う | 使わない |
| --- | --- |
| `onChange`、`onOpenChange`、`onValueChange`、`onCheckedChange`、`onConfirm` | `setFoo`、`handleClick`、`changeOpen`、`onScrollTable` |

値を親へ返すときは、いまの値の型を先に渡し、必要なら DOM イベントを最後の引数に足す。親の Effect Atom や TanStack Form の更新方法を部品に漏らさない。

## 真偽と多値

| 使う | 使わない |
| --- | --- |
| `open`、`disabled`、`checked`、`required`、`readOnly`（省略時は偽） | `isOpen`、`isLoading`、`hasMultiple` |
| `variant` / `size` などの文字列ユニオン | 見た目用の boolean 増殖、enum の import |

見た目の分岐は `cva` の `variant` / `size` に閉じる。振る舞いの分岐が増えたら boolean を足さず、部品を分けるかクラスタで合成する。

## 合成

- 中身は `children`。`children` を関数やオブジェクトにしない。
- ダイアログ・メニュー・テーブルは `DropdownMenu` + `Trigger` / `Content` / `Item` のようにクラスタで組む。`header={...}` / `footer={...}` のスロット props や `renderHeader` は公開しない。
- Base UI の `render` は `@repo/ui` の内側だけ。呼び出し側の API に出さない。
- `Button` に `href` / `asChild` を足さない。リンクは `ButtonLink` / `TextLink` / `CardLink`。

## 密封

| 公開する | 公開しない |
| --- | --- |
| 意味のある props（`disabled`、`type`、`variant`、制御値と `on*Change`） | `className`、スタイル props、HTML 属性の全通し（`...props`） |
| `data-slot` とデザイントークン | 呼び出し側での色・半径・影の上書き |

見た目の上書きは `@shadcn/lint` の `no-restyle`（layout / spacing のみ許可）と `libs/ui` の design-system 検査が止める。新しい見た目が要るときは部品側に `variant` を足す。

## 制御

対話する値は制御 props を既定にする（`value` + `onValueChange`、`checked` + `onCheckedChange`、`open` + `onOpenChange`）。一時値の入れ物は呼び出し側の Effect Atom / TanStack Form。部品の中で `useState` を持たない。

固定文言の確認ダイアログのように内容が決まったものだけ、文字列 props（`title` / `description` / `confirmLabel`）でよい。メニューやカード一般には広げない。
