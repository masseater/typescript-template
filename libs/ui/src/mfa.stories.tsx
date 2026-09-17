import { HttpResponse, http } from "msw";
import { passkeyListPath, session } from "./story-fixture";
import { MFASettings } from "./mfa";
import { expect } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { session: session() },
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(passkeyListPath, () => HttpResponse.json([{ id: "passkey_01", name: "iPhone" }])),
    );
  },
  component: MFASettings,
});

export const NotEnrolled = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("iPhone")).toBeInTheDocument();
  },
});

export const Enrolled = meta.story({ args: { session: session({ twoFactorEnabled: true }) } });

export const Admin = meta.story({
  args: { session: session({ role: "admin", twoFactorEnabled: true }) },
});
