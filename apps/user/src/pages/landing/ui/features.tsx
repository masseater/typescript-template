import { Heading, Icon } from "@template/ui/ui";
import { SearchIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { Feature } from "./feature.tsx";
import type { ReactElement } from "react";

const features = [
  {
    description: "名前と自己紹介を書いて、自分のページを持てます。",
    icon: <Icon icon={UserRoundIcon} size="large" tone="primary" />,
    title: "プロフィールを作る",
  },
  {
    description: "名前で検索して、気になる人のプロフィールを開けます。",
    icon: <Icon icon={SearchIcon} size="large" tone="primary" />,
    title: "他の利用者を探す",
  },
  {
    description: "パスキーと 2 段階認証で、ログインを強くできます。",
    icon: <Icon icon={ShieldCheckIcon} size="large" tone="primary" />,
    title: "アカウントを守る",
  },
] as const;

function Features(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12">
      <Heading as="h2">できること</Heading>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types */}
        {features.map((feature) => (
          <Feature
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </ul>
    </section>
  );
}

export { Features };
