import { Heading } from "@repo/ui";

import { Feature } from "./feature.tsx";

import type { ReactElement } from "react";
import type { SketchKind } from "./feature-sketch.tsx";

const features: ReadonlyArray<{
  description: string;
  reverse?: boolean;
  sketch: SketchKind;
  title: string;
}> = [
  {
    description: "名前と自己紹介を書いて、自分のページを持てます。",
    sketch: "profile",
    title: "プロフィールを作る",
  },
  {
    description: "名前で検索して、気になる人のプロフィールを開けます。",
    reverse: true,
    sketch: "search",
    title: "他の利用者を探す",
  },
  {
    description: "パスキーと 2 段階認証で、ログインを強くできます。",
    sketch: "security",
    title: "アカウントを守る",
  },
];

function Features(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-wide flex-col gap-10 px-4 py-16">
      <Heading as="h2">できること</Heading>
      <ul className="flex flex-col gap-12">
        {features.map((feature) => (
          <Feature
            key={feature.title}
            title={feature.title}
            description={feature.description}
            sketch={feature.sketch}
            reverse={feature.reverse}
          />
        ))}
      </ul>
    </section>
  );
}

export { Features };
