import type { ChangeEventHandler, SubmitEventHandler } from "react";
import { object, parse, string } from "valibot";
import { useCallback, useEffect, useState } from "react";
import type { InferOutput } from "valibot";
import { requestJson } from "@template/runtime/client";

const profileSchema = object({
  email: string(),
  id: string(),
  name: string(),
  profile: string(),
});

type ProfileData = InferOutput<typeof profileSchema>;

interface ProfileDraft {
  readonly handleNameChange: ChangeEventHandler<HTMLInputElement>;
  readonly handleProfileChange: ChangeEventHandler<HTMLTextAreaElement>;
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

function failureMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

async function loadProfile(): Promise<ProfileData> {
  return parse(profileSchema, await requestJson("/api/profile"));
}

async function saveProfile(name: string, profile: string): Promise<ProfileData> {
  const body = await requestJson("/api/profile", { body: { name, profile }, method: "PATCH" });
  return parse(profileSchema, body);
}

type FieldEvent = Readonly<{ target: Readonly<{ value: string }> }>;

function useProfileDraft(): ProfileDraft {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const handleNameChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event: FieldEvent) => {
      setName(event.target.value);
    },
    [],
  );
  const handleProfileChange = useCallback<ChangeEventHandler<HTMLTextAreaElement>>(
    (event: FieldEvent) => {
      setProfile(event.target.value);
    },
    [],
  );
  const show = useCallback((data: Readonly<ProfileData>): void => {
    setName(data.name);
    setProfile(data.profile);
  }, []);
  return { handleNameChange, handleProfileChange, name, profile, show };
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
          setFailure(failureMessage(error, "取得に失敗しました。"));
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
  const handleSubmit = useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event: FormSubmission) => {
      event.preventDefault();
      setPending(true);
      setFailure("");
      setMessage("");
      async function save(): Promise<void> {
        try {
          show(await saveProfile(name, profile));
          setMessage("プロフィールを保存しました。");
        } catch (error) {
          setFailure(failureMessage(error, "保存に失敗しました。"));
        }
        setPending(false);
      }
      void save();
    },
    [name, profile, show],
  );
  return { ...draft, error: failure, handleSubmit, message, pending, ready };
}

export { useProfileForm };
export type { ProfileForm };
