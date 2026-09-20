import { Field, FormColumn } from "@repo/ui";

import { maximumNameLength, maximumProfileLength } from "#shared/contracts/index.ts";
import { fieldError } from "#shared/forms/index.ts";
import { ProfileActions } from "./profile-actions.tsx";
import { SocialLinksEditor } from "./social-links-editor.tsx";

import type { useProfileForm } from "#pages/profile-edit/model/profile-form.ts";
import type { ReactElement, FormEvent } from "react";

function ProfileEditor({
  formState,
  homeId,
}: Readonly<{ formState: ReturnType<typeof useProfileForm>; homeId: string }>): ReactElement {
  const { blocked, form, pending } = formState;
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  }
  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={pending}>
      <FormColumn>
        <form.Field name="name">
          {(field) => (
            <Field
              label="ユーザー名"
              name="name"
              maxLength={maximumNameLength}
              value={field.state.value}
              onValueChange={field.handleChange}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="profile">
          {(field) => (
            <>
              <Field
                multiline
                label="自己紹介"
                name="profile"
                maxLength={maximumProfileLength}
                value={field.state.value}
                onValueChange={field.handleChange}
                error={fieldError(field.state.meta.errors)}
              />
              <p className="text-sm leading-normal text-muted-foreground">
                残り {maximumProfileLength - field.state.value.length} 文字
              </p>
            </>
          )}
        </form.Field>
        <form.Field name="socialLinks">
          {(field) => (
            <SocialLinksEditor
              values={field.state.value}
              onChange={field.handleChange}
              errors={field.state.meta.errors}
            />
          )}
        </form.Field>
        <ProfileActions blocked={blocked} homeId={homeId} />
      </FormColumn>
    </form>
  );
}

export { ProfileEditor };
