import { type ActionState, CheckboxField, Field, FormColumn, Heading } from "@repo/ui";
import { useState, type ReactElement } from "react";

import { BackupCodeList } from "./backup-code-list";
import { TotpVerifyForm } from "./totp-verify-form";

import type { Enrollment } from "./mfa-types";

const TotpEnrollment = ({
  action,
  enrollment,
  onVerified,
}: {
  readonly action: ActionState;
  readonly enrollment: Enrollment;
  readonly onVerified: () => void;
}): ReactElement => {
  const [saved, setSaved] = useState(false);
  return (
    <FormColumn>
      <Field multiline label="認証アプリ登録用 URI" readOnly value={enrollment.totpURI} />
      <div className="flex w-full flex-col gap-1">
        <Heading size="block">バックアップコード</Heading>
        <BackupCodeList codes={enrollment.backupCodes} />
      </div>
      <CheckboxField
        label="バックアップコードを保管しました"
        checked={saved}
        onCheckedChange={setSaved}
      />
      <TotpVerifyForm action={action} onVerified={onVerified} saved={saved} />
    </FormColumn>
  );
};

export { TotpEnrollment };
