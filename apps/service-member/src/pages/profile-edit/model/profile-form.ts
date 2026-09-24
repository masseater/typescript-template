import { useAction } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import { saveProfile } from "#entities/profile/index.ts";
import { ProfileUpdate } from "#shared/contracts/index.ts";

import type { Profile, ProfileDraft } from "#entities/profile/index.ts";

type SocialLinkField = {
  readonly id: string;
  readonly url: string;
};

type ProfileFormValues = {
  readonly name: string;
  readonly profile: string;
  readonly socialLinks: readonly SocialLinkField[];
};

function socialLinksForEditor(links: readonly string[]): readonly SocialLinkField[] {
  if (links.length === 0) {
    return [{ id: crypto.randomUUID(), url: "" }];
  }
  return links.map((url) => ({ id: crypto.randomUUID(), url }));
}

function profileDraft(values: ProfileFormValues): ProfileDraft {
  const socialLinks: string[] = [];
  for (const link of values.socialLinks) {
    const trimmed = link.url.trim();
    if (trimmed !== "") {
      socialLinks.push(trimmed);
    }
  }
  return {
    name: values.name,
    profile: values.profile,
    socialLinks,
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
      action.run(() => saveProfile(profileDraft(value)).then(() => onSaved()));
    },
    validators: {
      onSubmit: ({ value }) => {
        const decoded = Schema.decodeResult(ProfileUpdate)(profileDraft(value));
        if (decoded._tag === "Failure") {
          return decoded.failure.message;
        }
        return undefined;
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
export type { SocialLinkField };
