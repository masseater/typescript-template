import { Atom } from "effect/unstable/reactivity";
import type { Profile } from "#pages/profile-edit/api/profile.ts";
import type { SubmitEventHandler } from "react";
import { saveProfile } from "#pages/profile-edit/api/profile.ts";
import { useAction } from "@template/ui";
import { useAtom } from "@effect/atom-react";

interface ProfileFields {
  readonly name: string;
  readonly profile: string;
}

interface ProfileForm extends ProfileFields {
  readonly error: string;
  readonly handleNameChange: (value: string) => void;
  readonly handleProfileChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly pending: boolean;
}

const fieldsAtom = Atom.family((initial: Profile) =>
  Atom.make<ProfileFields>({ name: initial.name, profile: initial.profile }),
);

function useProfileForm(initial: Readonly<Profile>, onSaved: () => Promise<void>): ProfileForm {
  const [fields, setFields] = useAtom(fieldsAtom(initial));
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await saveProfile(fields.name, fields.profile);
      await onSaved();
    });
  }
  function handleNameChange(name: string): void {
    setFields((current) => ({ ...current, name }));
  }
  function handleProfileChange(profile: string): void {
    setFields((current) => ({ ...current, profile }));
  }
  return {
    ...fields,
    error: action.error ?? "",
    handleNameChange,
    handleProfileChange,
    handleSubmit,
    pending: action.pending,
  };
}

export { useProfileForm };
export type { ProfileForm };
