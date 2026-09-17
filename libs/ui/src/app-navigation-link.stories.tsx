import { AppNavigationLink } from "./app-navigation-link";
import type { ReactElement } from "react";
import preview from "../.storybook/preview";

const meta = preview.meta({
  component: AppNavigationLink,
  render: ({ href, label }): ReactElement => (
    <ul>
      <AppNavigationLink href={href} label={label} />
    </ul>
  ),
});

const Default = meta.story({ args: { href: "/security", label: "認証設定" } });

export { Default };
