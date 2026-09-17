import { HttpResponse, http } from "msw";
import { passkeyListPath, settingsContext } from "./story-fixture";
import { PasskeySettings } from "./passkey-settings";
import { expect } from "storybook/test";
import preview from "../.storybook/preview";

const meta = preview.meta({ args: { context: settingsContext() }, component: PasskeySettings });

export const Registered = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(passkeyListPath, () =>
        HttpResponse.json([
          { id: "passkey_01", name: "MacBook Pro" },
          { id: "passkey_02", name: "iPhone" },
        ]),
      ),
    );
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("MacBook Pro")).toBeInTheDocument();
  },
});

export const Empty = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(http.get(passkeyListPath, () => HttpResponse.json([])));
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("登録されたパスキーはありません。")).toBeInTheDocument();
  },
});

export const Failed = meta.story({
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(passkeyListPath, () =>
        HttpResponse.json({ message: "パスキーの取得に失敗しました。" }, { status: 500 }),
      ),
    );
  },
  parameters: { a11y: { test: "todo" } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toBeInTheDocument();
  },
});
