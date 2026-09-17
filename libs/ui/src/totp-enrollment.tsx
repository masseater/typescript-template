import type { ChangeEventHandler, ReactElement } from "react";
import { Heading, Stack } from "smarthr-ui";
import { useCallback, useState } from "react";
import type { ActionState } from "./action";
import { BackupCodeList } from "./backup-code-list";
import type { Enrollment } from "./mfa-types";
import { TotpVerifyForm } from "./totp-verify-form";

interface TotpEnrollmentProps {
  readonly action: ActionState;
  readonly enrollment: Enrollment;
  readonly onVerified: () => void;
}

function TotpEnrollment({ action, enrollment, onVerified }: TotpEnrollmentProps): ReactElement {
  const [saved, setSaved] = useState(false);
  const toggleSaved = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    setSaved(event.target.checked);
  }, []);
  return (
    <Stack>
      <label htmlFor="totp-uri">認証アプリ登録用 URI</label>
      <textarea id="totp-uri" readOnly value={enrollment.totpURI} autoComplete="off" />
      <Heading>バックアップコード</Heading>
      <BackupCodeList codes={enrollment.backupCodes} />
      <label>
        <input type="checkbox" checked={saved} onChange={toggleSaved} />
        バックアップコードを保管しました
      </label>
      <TotpVerifyForm action={action} onVerified={onVerified} saved={saved} />
    </Stack>
  );
}

export { TotpEnrollment };
