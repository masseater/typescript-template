import {
  FormTextField,
  errorMessage,
  formColumnClassName,
  formValidator,
  useToast,
} from "@template/ui";
import { ProfileUpdate, maximumNameLength } from "@template/runtime/contracts";
import type { Profile } from "#entities/profile/index.ts";
import { ProfileActions } from "./profile-actions.tsx";
import { ProfileBiography } from "./profile-biography.tsx";
import type { ReactElement } from "react";
import type { TextFieldApi } from "@template/ui";
import { profileCollection } from "#entities/profile/index.ts";
import { useDbClient } from "@tanstack/react-db";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";

const ProfileInput = formValidator(ProfileUpdate);

function ProfileEditor({ profile }: Readonly<{ profile: Profile }>): ReactElement {
  const collection = useDbClient().collection(profileCollection);
  const navigate = useNavigate();
  const notify = useToast();
  const form = useForm({
    defaultValues: { name: profile.name, profile: profile.profile },
    onSubmit: async ({
      value,
    }: Readonly<{ value: Readonly<{ name: string; profile: string }> }>): Promise<void> => {
      const saved = collection.update(profile.id, (draft) => {
        draft.name = value.name.trim();
        draft.profile = value.profile;
      });
      await navigate({ params: { id: profile.id }, to: "/users/$id" });
      try {
        await saved.isPersisted.promise;
        notify("success", "プロフィールを保存しました。");
      } catch (error) {
        notify("error", errorMessage(error));
      }
    },
    validators: { onSubmit: ProfileInput },
  });
  function submit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    void form.handleSubmit();
  }
  return (
    <form onSubmit={submit} noValidate className={formColumnClassName}>
      <form.Field name="name">
        {(field: TextFieldApi): ReactElement => (
          <FormTextField
            field={field}
            label="ユーザー名"
            name="name"
            required
            maxLength={maximumNameLength}
          />
        )}
      </form.Field>
      <form.Field name="profile">
        {(field: TextFieldApi): ReactElement => <ProfileBiography field={field} />}
      </form.Field>
      <ProfileActions homeId={profile.id} />
    </form>
  );
}

export { ProfileEditor };
