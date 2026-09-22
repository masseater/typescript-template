import { Button } from "@repo/ui";

import { PasskeyList } from "./passkey-list";
import { PasskeyRegisterForm } from "./passkey-register-form";
import { usePasskeys } from "./use-passkeys";

import type { ReactElement } from "react";
import type { SettingsContext } from "./mfa-types";

const PasskeySettings = ({ context }: Readonly<{ context: SettingsContext }>): ReactElement => {
  const { listError, passkeys, reload } = usePasskeys();
  return (
    <>
      <PasskeyRegisterForm
        context={context}
        onRegistered={() => {
          reload();
          return Promise.resolve();
        }}
      />
      <PasskeyList action={context.action} listError={listError} passkeys={passkeys} />
      <Button type="button" disabled={context.action.blocked} onClick={reload}>
        {"パスキー一覧を更新"}
      </Button>
    </>
  );
};

export { PasskeySettings };
