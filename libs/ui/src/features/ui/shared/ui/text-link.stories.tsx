import preview from "../../../../../storybook/preview";
import { TextLink } from "./text-link";

const meta = preview.meta({ args: { children: "条件をクリア", to: "/" }, component: TextLink });

export const Default = meta.story();
