import { PasskeyItem } from "./passkey-item";
import type { ReactElement } from "react";
import { idleAction } from "./story-fixture";
import preview from "../.storybook/preview";

const meta = preview.meta({
  args: { action: idleAction() },
  component: PasskeyItem,
  render: ({ action, passkey }): ReactElement => (
    <ul>
      <PasskeyItem action={action} passkey={passkey} />
    </ul>
  ),
});

const Named = meta.story({ args: { passkey: { id: "passkey_01", name: "MacBook Pro" } } });

const Unnamed = meta.story({ args: { passkey: { id: "passkey_02" } } });

export { Named, Unnamed };
