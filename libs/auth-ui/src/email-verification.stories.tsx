import { expect } from "storybook/test";

import preview from "../storybook/preview";
import { EmailVerification } from "./email-verification";

const meta = preview.meta({ component: EmailVerification });

export const Expired = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
});
