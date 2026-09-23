# フロントエンド

見た目・UI 部品・レイアウトを触る前にルートの `DESIGN.md` を読むことは `AGENTS.md` が決めている。React の書き方は `.claude/skills/modern-react-guidance/SKILL.md`、非同期の瀑布は `.claude/skills/react-best-practices/SKILL.md`。

- UI の部品は `libs/ui` の基礎（`libs/ui/package.json` が持つ React、shadcn、Tailwind CSS）の上に載せる。
- アプリ固有の画面組み立ては各アプリの FSD 境界の内側に置き、共通にできる見た目だけを `libs/ui` へ切り出す。
- 外部の UI キットのデモやブロック集を、依存や規範の根拠にしない。
- 画面の構成と遷移の判断は `apps/internal-dashboard/content/docs/pages/` に置く。references に混ぜない。
