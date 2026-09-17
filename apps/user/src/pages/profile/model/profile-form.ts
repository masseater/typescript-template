import { useEffect, useState } from "react";
import { ProfileView } from "@template/runtime/contracts";
import type { SubmitEventHandler } from "react";
import { errorMessage } from "@template/ui";
import { requestJson } from "@template/runtime/client";

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

async function loadProfile(): Promise<ProfileData> {
  return requestJson("/api/profile", ProfileView);
}

async function saveProfile(name: string, profile: string): Promise<ProfileData> {
  return requestJson("/api/profile", ProfileView, { body: { name, profile }, method: "PATCH" });
}

function useProfileDraft(): ProfileDraft {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
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

function useProfileForm(userId: string | undefined): ProfileForm {
  const draft = useProfileDraft();
  const { name, profile, show } = draft;
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  useEffect(() => {
    const controller = { active: true };
    async function load(): Promise<void> {
      try {
        const data = await loadProfile();
        if (controller.active) {
          show(data);
          setReady(true);
        }
      } catch (error) {
        if (controller.active) {
          setFailure(errorMessage(error));
        }
      }
    }
    if ((userId ?? "") !== "") {
      void load();
    }
    return (): void => {
      controller.active = false;
    };
  }, [show, userId]);
  function handleSubmit(event: FormSubmission): void {
    event.preventDefault();
    setPending(true);
    setFailure("");
    setMessage("");
    async function save(): Promise<void> {
      try {
        show(await saveProfile(name, profile));
        setMessage("プロフィールを保存しました。");
      } catch (error) {
        setFailure(errorMessage(error));
      }
      setPending(false);
    }
    void save();
  }
  return { ...draft, error: failure, handleSubmit, message, pending, ready };
}

export { useProfileForm };
export type { ProfileForm };
