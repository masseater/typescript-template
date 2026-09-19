import { useAction } from "@repo/ui";
import { useState } from "react";

import { saveProfile } from "#pages/profile-edit/api/profile.ts";

import type { Profile } from "#pages/profile-edit/api/profile.ts";
import type { SubmitEventHandler } from "react";

interface ProfileForm {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleNameChange: (value: string) => void;
  readonly handleProfileChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly name: string;
  readonly pending: boolean;
  readonly profile: string;
}

function useProfileForm(initial: Readonly<Profile>, onSaved: () => Promise<void>): ProfileForm {
  const [name, setName] = useState(initial.name);
  const [profile, setProfile] = useState(initial.profile);
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await saveProfile(name, profile);
      await onSaved();
    });
  }
  return {
    blocked: action.blocked,
    error: action.error,
    handleNameChange: setName,
    handleProfileChange: setProfile,
    handleSubmit,
    name,
    pending: action.pending,
    profile,
  };
}

export { useProfileForm };
export type { ProfileForm };
