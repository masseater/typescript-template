import preview from "../../../storybook/preview";
import { Avatar } from "./avatar";

const meta = preview.meta({ args: { name: "山田 太郎" }, component: Avatar });

export const Medium = meta.story();

export const Small = meta.story({ args: { size: "small" } });

export const Large = meta.story({ args: { size: "large" } });

export const Latin = meta.story({ args: { name: "taro yamada" } });
