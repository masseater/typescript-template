import { TextLink } from "./text-link";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ args: { children: "条件をクリア", to: "/" }, component: TextLink });

export const Default = meta.story();
