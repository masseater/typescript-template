import { useAtom } from "@effect/atom-react";
import { useAction } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import { saveProfile } from "#pages/profile-edit/api/profile.ts";

import type { Profile } from "#pages/profile-edit/api/profile.ts";
import type { SubmitEventHandler } from "react";

type DraftLink = Readonly<{ id: string; url: string }>;

interface ProfileFields {
  readonly name: string;
  readonly profile: string;
  readonly socialLinks: readonly DraftLink[];
}

interface ProfileForm extends ProfileFields {
  readonly blocked: boolean;
  readonly error: string;
  readonly handleNameChange: (value: string) => void;
  readonly handleProfileChange: (value: string) => void;
  readonly handleSocialLinksChange: (values: readonly DraftLink[]) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly pending: boolean;
}

function toDrafts(urls: readonly string[]): readonly DraftLink[] {
  if (urls.length === 0) {
    return [{ id: crypto.randomUUID(), url: "" }];
  }
  return urls.map((url) => ({ id: crypto.randomUUID(), url }));
}

function savedLinks(drafts: readonly DraftLink[]): readonly string[] {
  const links: string[] = [];
  for (const draft of drafts) {
    const url = draft.url.trim();
    if (url !== "") {
      links.push(url);
    }
  }
  return links;
}

const fieldsAtom = Atom.family((initial: Profile) =>
  Atom.make<ProfileFields>({
    name: initial.name,
    profile: initial.profile,
    socialLinks: toDrafts(initial.socialLinks),
  }),
);

function useProfileForm(initial: Readonly<Profile>, onSaved: () => Promise<void>): ProfileForm {
  const [fields, setFields] = useAtom(fieldsAtom(initial));
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await saveProfile(fields.name, fields.profile, savedLinks(fields.socialLinks));
      await onSaved();
    });
  }
  return {
    ...fields,
    blocked: action.blocked,
    error: action.error ?? "",
    handleNameChange: (name) => {
      setFields((current) => ({ ...current, name }));
    },
    handleProfileChange: (profile) => {
      setFields((current) => ({ ...current, profile }));
    },
    handleSocialLinksChange: (socialLinks) => {
      setFields((current) => ({ ...current, socialLinks }));
    },
    handleSubmit,
    pending: action.pending,
  };
}

export { useProfileForm };
export type { DraftLink, ProfileForm };
