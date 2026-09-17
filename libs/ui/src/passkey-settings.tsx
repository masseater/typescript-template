import { Button } from "smarthr-ui";
import { PasskeyList } from "./passkey-list";
import { PasskeyRegisterForm } from "./passkey-register-form";
import type { ReactElement } from "react";
import type { SettingsContext } from "./mfa-types";
import { useCallback } from "react";
import { usePasskeys } from "./use-passkeys";

function PasskeySettings({ context }: Readonly<{ context: SettingsContext }>): ReactElement {
  const { listError, passkeys, reload } = usePasskeys();
  const refresh = useCallback(() => {
    void reload();
  }, [reload]);
  return (
    <>
      <PasskeyRegisterForm context={context} onRegistered={reload} />
      <PasskeyList action={context.action} listError={listError} passkeys={passkeys} />
      <Button type="button" disabled={context.action.blocked} onClick={refresh}>
        パスキー一覧を更新
      </Button>
    </>
  );
}

export { PasskeySettings };
