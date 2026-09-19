import { noop } from "es-toolkit";

import preview from "../storybook/preview";
import { SignUpForm } from "./signup";

const meta = preview.meta({ args: { onSent: noop }, component: SignUpForm });

export const Default = meta.story();
