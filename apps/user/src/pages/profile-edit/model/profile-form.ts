import { errorMessage } from "@template/ui";
import { useState, type SubmitEventHandler } from "react";

import { saveProfile, type Profile } from "#pages/profile-edit/api/profile.ts";

type ProfileForm = {
  readonly error: string;
  readonly handleNameChange: (value: string) => void;
  readonly handleProfileChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly name: string;
  readonly pending: boolean;
  readonly profile: string;
};

const useProfileForm = (initial: Readonly<Profile>, onSaved: () => Promise<void>): ProfileForm => {
  const [name, setName] = useState(initial.name);
  const [profile, setProfile] = useState(initial.profile);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const save = async (): Promise<void> => {
    try {
      await saveProfile(name, profile);
      await onSaved();
    } catch (error) {
      setFailure(errorMessage(error));
    }
    setPending(false);
  };
  const handleSubmit = (event: Readonly<{ preventDefault: () => void }>): void => {
    event.preventDefault();
    setPending(true);
    setFailure("");
    void save();
  };
  return {
    error: failure,
    handleNameChange: setName,
    handleProfileChange: setProfile,
    handleSubmit,
    name,
    pending,
    profile,
  };
};

export { useProfileForm };
export type { ProfileForm };
