import { noop } from "es-toolkit";

import preview from "../.storybook/preview";
import { PasskeyItem } from "./passkey-item";

import type { ReactElement } from "react";

const meta = preview.meta({
  args: { action: { blocked: false, error: undefined, pending: false, run: noop } },
  component: PasskeyItem,
  render: ({ action, passkey }): ReactElement => (
    <ul>
      <PasskeyItem action={action} passkey={passkey} />
    </ul>
  ),
});

export const Named = meta.story({ args: { passkey: { id: "passkey_01", name: "MacBook Pro" } } });

export const Unnamed = meta.story({ args: { passkey: { id: "passkey_02" } } });
