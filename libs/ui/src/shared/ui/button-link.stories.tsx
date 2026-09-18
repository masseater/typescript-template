import { ButtonLink } from "./button-link";
import preview from "../../../.storybook/preview";

const meta = preview.meta({
  args: { children: "無料で始める", size: "medium", to: "/", variant: "secondary" },
  component: ButtonLink,
});

export const Primary = meta.story({ args: { size: "large", variant: "primary" } });

export const Secondary = meta.story();
