import { SignUpForm } from "./signup";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const meta = preview.meta({ args: { onSent: noop }, component: SignUpForm });

export const Default = meta.story();
