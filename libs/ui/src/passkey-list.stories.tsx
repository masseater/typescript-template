import { PasskeyList } from "./passkey-list";
import { noop } from "es-toolkit";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: {
    action: { blocked: false, error: undefined, pending: false, run: noop },
    listError: undefined,
  },
  component: PasskeyList,
});

export const Registered = meta.story({
  args: {
    passkeys: [
      { id: "passkey_01", name: "MacBook Pro" },
      { id: "passkey_02", name: "iPhone" },
      { id: "passkey_03" },
    ],
  },
});

export const Empty = meta.story({ args: { passkeys: [] } });

export const Loading = meta.story({ args: { passkeys: undefined } });

export const Failed = meta.story({
  args: { listError: "パスキーの取得に失敗しました。", passkeys: undefined },
});
