import { NavigationLink } from "./navigation-link";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: { children: "ホーム", to: "/", variant: "item" },
  component: NavigationLink,
});

export const Item = meta.story();

export const Side = meta.story({ args: { variant: "side" } });

export const Brand = meta.story({ args: { children: "Template", variant: "brand" } });
