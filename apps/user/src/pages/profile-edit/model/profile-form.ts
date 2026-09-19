import { useAction } from "@repo/ui";
import { useState } from "react";

import { saveProfile } from "#pages/profile-edit/api/profile.ts";

import type { Profile } from "#pages/profile-edit/api/profile.ts";
import type { SubmitEventHandler } from "react";

type DraftLink = Readonly<{ id: string; url: string }>;

interface ProfileForm {
  readonly blocked: boolean;
  readonly error: string;
  readonly handleNameChange: (value: string) => void;
  readonly handleProfileChange: (value: string) => void;
  readonly handleSocialLinksChange: (values: readonly DraftLink[]) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly name: string;
  readonly pending: boolean;
  readonly profile: string;
  readonly socialLinks: readonly DraftLink[];
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

function useProfileForm(initial: Readonly<Profile>, onSaved: () => Promise<void>): ProfileForm {
  const [name, setName] = useState(initial.name);
  const [profile, setProfile] = useState(initial.profile);
  const [socialLinks, setSocialLinks] = useState<readonly DraftLink[]>(() =>
    toDrafts(initial.socialLinks),
  );
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await saveProfile(name, profile, savedLinks(socialLinks));
      await onSaved();
    });
  }
  return {
    blocked: action.blocked,
    error: action.error ?? "",
    handleNameChange: setName,
    handleProfileChange: setProfile,
    handleSocialLinksChange: setSocialLinks,
    handleSubmit,
    name,
    pending: action.pending,
    profile,
    socialLinks,
  };
}

export { useProfileForm };
export type { DraftLink, ProfileForm };
