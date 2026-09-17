import type { ChangeEventHandler, SubmitEventHandler } from "react";
import { useCallback, useState } from "react";
import type { ProfileView } from "@template/runtime/contracts";
import { errorMessage } from "@template/ui";

type ProfileData = typeof ProfileView.Type;

interface ProfileDraft {
  readonly handleNameChange: ChangeEventHandler<HTMLInputElement>;
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

type FieldEvent = Readonly<{ target: Readonly<{ value: string }> }>;

function useProfileDraft(loaded: Readonly<ProfileData> | undefined): ProfileDraft {
  const [name, setName] = useState(loaded?.name ?? "");
  const [profile, setProfile] = useState(loaded?.profile ?? "");
  const handleNameChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event: FieldEvent) => {
      setName(event.target.value);
    },
    [],
  );
  const handleProfileChange = useCallback((next: string): void => {
    setProfile(next);
  }, []);
  const show = useCallback((data: Readonly<ProfileData>): void => {
    setName(data.name);
    setProfile(data.profile);
  }, []);
  return { handleNameChange, handleProfileChange, name, profile, show };
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
  const handleSubmit = useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event: FormSubmission) => {
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
    },
    [name, profile, save, show],
  );
  return { ...draft, error: failure, handleSubmit, message, pending, ready: loaded !== undefined };
}

export { useProfileForm };
export type { ProfileForm };
