import { Button, Field, TextareaField, buttonVariants } from "@template/ui/ui";
import type { ProfileForm } from "#pages/profile-edit/model/profile-form.ts";
import { ProfileLink } from "#shared/ui/index.ts";
import type { ReactElement } from "react";

const nameMaxLength = 100;
const profileMaxLength = 2000;

function ProfileEditor({
  form,
  homeId,
}: Readonly<{ form: ProfileForm; homeId: string }>): ReactElement {
  return (
    <form
      onSubmit={form.handleSubmit}
      aria-busy={form.pending}
      className="flex w-full max-w-md flex-col gap-4"
    >
      <Field
        label="ユーザー名"
        name="name"
        required
        maxLength={nameMaxLength}
        value={form.name}
        onChange={form.handleNameChange}
      />
      <TextareaField
        label="自己紹介"
        name="profile"
        maxLength={profileMaxLength}
        value={form.profile}
        onValueChange={form.handleProfileChange}
      />
      <p className="text-sm leading-normal text-muted-foreground">
        残り {profileMaxLength - form.profile.length} 文字
      </p>
      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" disabled={form.pending}>
          保存
        </Button>
        <ProfileLink id={homeId} className={buttonVariants()}>
          やめる
        </ProfileLink>
      </div>
    </form>
  );
}

export { ProfileEditor };
