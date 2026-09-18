import { useState } from "react";

import { BackupCodeList } from "./backup-code-list";
import { CheckboxField } from "./shared/ui/checkbox-field";
import { Field } from "./shared/ui/field";
import { FormColumn } from "./shared/ui/form-column";
import { Heading } from "./shared/ui/heading";
import { TotpVerifyForm } from "./totp-verify-form";

import type { ReactElement } from "react";
import type { ActionState } from "./action";
import type { Enrollment } from "./mfa-types";

type TotpEnrollmentProps = {
  readonly action: ActionState;
  readonly enrollment: Enrollment;
  readonly onVerified: () => void;
};

const TotpEnrollment = ({ action, enrollment, onVerified }: TotpEnrollmentProps): ReactElement => {
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
