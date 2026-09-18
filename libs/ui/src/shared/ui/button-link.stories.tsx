import preview from "../../../.storybook/preview";
import { ButtonLink } from "./button-link";

const meta = preview.meta({
  args: { children: "無料で始める", size: "medium", to: "/", variant: "secondary" },
  component: ButtonLink,
});

export const Primary = meta.story({ args: { size: "large", variant: "primary" } });

export const Secondary = meta.story();
