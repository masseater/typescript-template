import { Separator } from "./separator";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ component: Separator });

export const Default = meta.story({ args: { label: "または" } });
