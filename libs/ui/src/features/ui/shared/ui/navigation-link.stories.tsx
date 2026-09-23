import preview from "../../../../../storybook/preview";
import { NavigationLink } from "./navigation-link";

const meta = preview.meta({
  args: { children: "ホーム", to: "/", variant: "item" },
  component: NavigationLink,
});

export const NavigationItem = meta.story();

export const Side = meta.story({ args: { variant: "side" } });

export const Brand = meta.story({ args: { children: "Template", variant: "brand" } });
