import type { SubmitEventHandler } from "react";
import { useState } from "react";

import type { Profile } from "#pages/profile-edit/api/profile.ts";
import { saveProfile } from "#pages/profile-edit/api/profile.ts";
import { errorMessage } from "@repo/ui";

interface ProfileForm {
  readonly error: string;
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
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  async function save(): Promise<void> {
    try {
      await saveProfile(name, profile);
      await onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
    }
    setPending(false);
  }
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    setPending(true);
    setFailure("");
    void save();
  }
  return {
    error: failure,
    handleNameChange: setName,
    handleProfileChange: setProfile,
    handleSubmit,
    name,
    pending,
    profile,
  };
}

export { useProfileForm };
export type { ProfileForm };
