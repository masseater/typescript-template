import type { ProfileView } from "@template/runtime/contracts";
import type { SubmitEventHandler } from "react";
import { errorMessage } from "@template/ui";
import { useState } from "react";

type ProfileData = typeof ProfileView.Type;

interface ProfileDraft {
  readonly handleNameChange: (value: string) => void;
  readonly handleProfileChange: (value: string) => void;
  readonly name: string;
  readonly profile: string;
  readonly show: (data: Readonly<ProfileData>) => void;
}

interface ProfileForm extends ProfileDraft {
  readonly error: string;
  readonly message: string;
  readonly pending: boolean;
  readonly ready: boolean;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
}

function useProfileDraft(loaded: Readonly<ProfileData> | undefined): ProfileDraft {
  const [name, setName] = useState(loaded?.name ?? "");
  const [profile, setProfile] = useState(loaded?.profile ?? "");
  function show(data: Readonly<ProfileData>): void {
    setName(data.name);
    setProfile(data.profile);
  }
  return {
    handleNameChange: setName,
    handleProfileChange: setProfile,
    name,
    profile,
    show,
  };
}

type FormSubmission = Readonly<{ preventDefault: () => void }>;

function useProfileForm(
  loaded: Readonly<ProfileData> | undefined,
  save: (name: string, profile: string) => Promise<ProfileData>,
): ProfileForm {
  const draft = useProfileDraft(loaded);
  const { name, profile, show } = draft;
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  function handleSubmit(event: FormSubmission): void {
    event.preventDefault();
    setPending(true);
    setFailure("");
    setMessage("");
    async function submit(): Promise<void> {
      try {
        show(await save(name, profile));
        setMessage("プロフィールを保存しました。");
      } catch (error) {
        setFailure(errorMessage(error));
      }
      setPending(false);
    }
    void submit();
  }
  return { ...draft, error: failure, handleSubmit, message, pending, ready: loaded !== undefined };
}

export { useProfileForm };
export type { ProfileForm };
