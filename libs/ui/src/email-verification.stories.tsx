import { HttpResponse, http } from "msw";
import { EmailVerification } from "./email-verification";
import { expect } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({ component: EmailVerification });

export const Expired = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
});

export const Unreachable = meta.story({
  beforeEach: ({ msw }) => {
    globalThis.history.replaceState(undefined, "", "#token=unreachable");
    msw.use(http.post("/api/verify-email", () => HttpResponse.error()));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Failed to fetch");
  },
});
