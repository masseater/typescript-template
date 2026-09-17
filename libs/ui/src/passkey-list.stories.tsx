import { PasskeyList } from "./passkey-list";
import { idleAction } from "./story-fixture";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { action: idleAction(), listError: undefined },
  component: PasskeyList,
});

const Registered = meta.story({
  args: {
    passkeys: [
      { id: "passkey_01", name: "MacBook Pro" },
      { id: "passkey_02", name: "iPhone" },
      { id: "passkey_03" },
    ],
  },
});

const Empty = meta.story({ args: { passkeys: [] } });

const Loading = meta.story({ args: { passkeys: undefined } });

const Failed = meta.story({
  args: { listError: "パスキーの取得に失敗しました。", passkeys: undefined },
  parameters: { a11y: { test: "todo" } },
});

export { Empty, Failed, Loading, Registered };
