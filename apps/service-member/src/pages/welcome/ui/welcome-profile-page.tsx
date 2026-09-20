import { Button, Field, FormColumn, Heading, useAction } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";

import { saveProfile } from "#pages/profile-edit/api/profile.ts";
import { ProfileUpdate, maximumNameLength, maximumProfileLength } from "#shared/contracts/index.ts";
import { fieldError } from "#shared/forms/field-error.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ProfileDraft } from "#pages/profile-edit/api/profile.ts";
import type { ReactElement, FormEvent } from "react";

function welcomeDraft(values: { readonly name: string; readonly profile: string }): ProfileDraft {
  return { name: values.name, profile: values.profile, socialLinks: [] };
}

function WelcomeProfilePage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();
  const form = useForm({
    defaultValues: { name: "", profile: "" },
    onSubmit: ({ value }) => {
      action.run(async () => {
        await saveProfile(welcomeDraft(value));
        await saveOnboardingStep("done");
        await navigate({ to: "/home" });
      });
    },
    validators: {
      onSubmit: ({ value }) => {
        const decoded = Schema.decodeUnknownResult(ProfileUpdate)(welcomeDraft(value));
        if (decoded._tag === "Failure") {
          return decoded.failure.message;
        }
      },
    },
  });
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  }
  return (
    <main className="flex flex-col gap-4">
      <Heading as="h1" size="page">
        基本項目の入力
      </Heading>
      <form noValidate onSubmit={handleSubmit}>
        <FormColumn>
          <form.Field name="name">
            {(field) => (
              <Field
                label="ユーザー名"
                maxLength={maximumNameLength}
                name="name"
                onValueChange={field.handleChange}
                value={field.state.value}
                error={fieldError(field.state.meta.errors)}
              />
            )}
          </form.Field>
          <form.Field name="profile">
            {(field) => (
              <Field
                label="自己紹介"
                maxLength={maximumProfileLength}
                multiline
                name="profile"
                onValueChange={field.handleChange}
                value={field.state.value}
                error={fieldError(field.state.meta.errors)}
              />
            )}
          </form.Field>
        </FormColumn>
        {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
        <Button disabled={action.blocked} type="submit" variant="primary">
          保存してホームへ
        </Button>
      </form>
    </main>
  );
}

export { WelcomeProfilePage };
