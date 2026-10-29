const hero = {
  title: "typescript-template",
  lead: "Cloudflare で動く TypeScript の Web アプリを、検査・CI・デプロイがそろった状態から始める。",
  action: "GitHub で見る",
  href: "https://github.com/masseater/typescript-template",
} as const;

const features = {
  title: "入っているもの",
  items: [
    {
      title: "検査を 1 回で流す",
      body: "型検査・lint・テスト・依存の監査を vp run verify にまとめた。手元と CI で同じ検査が走る。",
    },
    {
      title: "push すれば本番に出る",
      body: "main に入ったコミットは、検査が通ったあとに Cloudflare へデプロイされる。",
    },
    {
      title: "公開ページは静的に置く",
      body: "このページはビルド時に HTML にしたもので、Worker を通らずに静的アセットとして返る。",
    },
  ],
} as const;

const steps = {
  title: "始め方",
  items: [
    "テンプレートからリポジトリを作る",
    "apps/web/app-name.ts のアプリ名を変える",
    "vp run verify を通して main に push する",
  ],
} as const;

export { features, hero, steps };
