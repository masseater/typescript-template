import { AppNavigation } from "./app-navigation";
import preview from "../.storybook/preview";

const meta = preview.meta({ component: AppNavigation, parameters: { layout: "fullscreen" } });

export const Default = meta.story({
  args: {
    links: [
      { href: "/", label: "ホーム" },
      { href: "/security", label: "認証設定" },
      { href: "/profile", label: "プロフィール" },
    ],
  },
});
