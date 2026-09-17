import { EmailVerification } from "./email-verification";
import { expect } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({ component: EmailVerification });

export const Expired = meta.story({
  parameters: { a11y: { config: { rules: [{ enabled: false, id: "color-contrast" }] } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
});
