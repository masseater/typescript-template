import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Icon } from "./icon";
import preview from "../../../.storybook/preview";

const meta = preview.meta({ args: { icon: CircleCheckIcon }, component: Icon });

export const Medium = meta.story();

export const Small = meta.story({ args: { size: "small" } });

export const Large = meta.story({ args: { icon: CircleAlertIcon, size: "large" } });

export const Primary = meta.story({ args: { tone: "primary" } });
