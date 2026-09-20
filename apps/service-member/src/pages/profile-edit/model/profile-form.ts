import { useAction } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import { saveProfile } from "#pages/profile-edit/api/profile.ts";
import { ProfileUpdate } from "#shared/contracts/index.ts";

import type { Profile, ProfileDraft } from "#pages/profile-edit/api/profile.ts";

type ProfileFormValues = {
  readonly name: string;
  readonly profile: string;
  readonly socialLinks: readonly string[];
};

function socialLinksForEditor(links: readonly string[]): readonly string[] {
  if (links.length === 0) {
    return [""];
  }
  return links;
}

function profileDraft(values: ProfileFormValues): ProfileDraft {
  return {
    name: values.name,
    profile: values.profile,
    socialLinks: values.socialLinks.map((link) => link.trim()).filter((link) => link !== ""),
  };
}

function useProfileForm(initial: Readonly<Profile>, onSaved: () => Promise<void>) {
  const action = useAction();
  const form = useForm({
    defaultValues: {
      name: initial.name,
      profile: initial.profile,
      socialLinks: socialLinksForEditor(initial.socialLinks),
    } satisfies ProfileFormValues,
    onSubmit: ({ value }) => {
      action.run(async () => {
        await saveProfile(profileDraft(value));
        await onSaved();
      });
    },
    validators: {
      onSubmit: ({ value }) => {
        const decoded = Schema.decodeUnknownResult(ProfileUpdate)(profileDraft(value));
        if (decoded._tag === "Failure") {
          return decoded.failure.message;
        }
      },
    },
  });
  return {
    blocked: action.blocked,
    error: action.error ?? "",
    form,
    pending: action.pending,
  };
}

export { useProfileForm };
export type { ProfileFormValues };
