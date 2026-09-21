import { Field, FormColumn, Page, STATUS_VARIANT, StatusMessage, useToast } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";

import { useProfileForm } from "#pages/profile-edit/model/profile-form.ts";
import { ProfileEditor } from "./profile-editor.tsx";

import type { Profile } from "#pages/profile-edit/api/profile.ts";
import type { ReactElement } from "react";

function ProfileEditPage({ initial }: Readonly<{ initial: Profile }>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  function showSaved(): Promise<void> {
    return Effect.runPromise(
      Effect.gen(function* afterSave() {
        yield* Effect.promise(() => router.invalidate());
        yield* Effect.promise(() => navigate({ params: { id: initial.id }, to: "/users/$id" }));
        notify("success", "プロフィールを保存しました。");
      }),
    );
  }
  const form = useProfileForm(initial, showSaved);
  return (
    <Page title="プロフィールの編集">
      <FormColumn>
        <Field label="メールアドレス" name="email" type="email" readOnly value={initial.email} />
      </FormColumn>
      <ProfileEditor form={form} homeId={initial.id} />
      {form.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
      )}
    </Page>
  );
}

export { ProfileEditPage };
