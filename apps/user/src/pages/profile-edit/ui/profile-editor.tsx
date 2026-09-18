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
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";

interface ProfileEditorProps {
  readonly onSave: (name: string, profile: string) => Promise<void>;
  readonly profile: Profile;
}

const ProfileInput = formValidator(ProfileUpdate);

function ProfileEditor({ onSave, profile }: ProfileEditorProps): ReactElement {
  const navigate = useNavigate();
  const notify = useToast();
  const form = useForm({
    defaultValues: { name: profile.name, profile: profile.profile },
    onSubmit: async ({
      value,
    }: Readonly<{ value: Readonly<{ name: string; profile: string }> }>): Promise<void> => {
      const saved = onSave(value.name.trim(), value.profile);
      await navigate({ params: { id: profile.id }, to: "/users/$id" });
      try {
        await saved;
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
