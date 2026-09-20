import preview from "@repo/ui/storybook/preview";

import { SignUpForm } from "./signup";

const meta = preview.meta({ args: { onSent: () => undefined }, component: SignUpForm });

export const Default = meta.story();
