import { Button, Field, FormColumn, Page, StatusMessage, TextLink } from "@repo/ui";
import { useState } from "react";

import { useRecoverForm } from "#pages/recover/model/recover-form.ts";
import { memberRetentionDays } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function RecoverPage(): ReactElement {
  const [recovered, setRecovered] = useState(false);
  const form = useRecoverForm(() => {
    setRecovered(true);
  });
  if (recovered) {
    return (
      <Page title="復旧しました">
        <StatusMessage>アカウントを復旧しました。ログインしてください。</StatusMessage>
        <TextLink to="/login">ログインへ</TextLink>
      </Page>
    );
  }
  return (
    <Page title="アカウントの復旧">
      <StatusMessage>
        退会から {memberRetentionDays} 日以内のメールアドレスだけ復旧できます。
      </StatusMessage>
      <form onSubmit={form.handleSubmit}>
        <FormColumn>
          <Field
            autoComplete="username"
            label="メールアドレス"
            name="email"
            onValueChange={form.handleEmailChange}
            required
            type="email"
            value={form.email}
          />
          <Button type="submit" variant="primary" disabled={form.blocked}>
            復旧する
          </Button>
          {form.error.length > 0 ? <StatusMessage>{form.error}</StatusMessage> : null}
        </FormColumn>
      </form>
    </Page>
  );
}

export { RecoverPage };
