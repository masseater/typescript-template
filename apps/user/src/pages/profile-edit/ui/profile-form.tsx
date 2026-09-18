import { Field, FormColumn } from "@template/ui";
import type { Profile } from "#entities/profile/index.ts";
import { ProfileEditor } from "./profile-editor.tsx";
import type { ReactElement } from "react";

function ProfileForm({ profile }: Readonly<{ profile: Profile }>): ReactElement {
  return (
    <>
      <FormColumn>
        <Field label="メールアドレス" name="email" type="email" readOnly value={profile.email} />
      </FormColumn>
      <ProfileEditor profile={profile} />
    </>
  );
}

export { ProfileForm };
