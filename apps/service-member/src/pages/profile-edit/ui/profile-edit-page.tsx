import { Field, FormColumn, Page, STATUS_VARIANT, StatusMessage, useToast } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Effect } from "effect";

import { useProfileForm } from "#pages/profile-edit/model/profile-form.ts";
import { PhotoEditor } from "./photo-editor.tsx";
import { ProfileEditor } from "./profile-editor.tsx";

import type { Profile } from "#pages/profile-edit/api/profile.ts";
import type { ReactElement } from "react";

function showSaved(
  memberId: string,
  invalidate: () => Promise<unknown>,
  goToProfile: (memberId: string) => Promise<unknown>,
  notify: (kind: "success", message: string) => void,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* afterSave() {
      yield* Effect.promise(() => invalidate());
      yield* Effect.promise(() => goToProfile(memberId));
      notify("success", "プロフィールを保存しました。");
    }),
  );
}

function ProfileEditPage({ initial }: Readonly<{ initial: Profile }>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  const form = useProfileForm(initial, () =>
    showSaved(
      initial.id,
      () => router.invalidate(),
      (id) => navigate({ params: { id }, to: "/users/$id" }),
      notify,
    ),
  );
  return (
    <Page title="プロフィールの編集">
      <FormColumn>
        <Field label="メールアドレス" name="email" type="email" readOnly value={initial.email} />
      </FormColumn>
      <PhotoEditor profile={initial} />
      <ProfileEditor form={form} homeId={initial.id} />
      {form.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
      )}
    </Page>
  );
}

export { ProfileEditPage };
