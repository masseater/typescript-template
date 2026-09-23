import preview from "../../../../../storybook/preview";
import { Separator } from "./separator";

const meta = preview.meta({ component: Separator });

export const Default = meta.story({ args: { label: "または" } });
