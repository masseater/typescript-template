import { Button, Field, FormColumn, Heading } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { maximumNameLength, maximumProfileLength } from "#shared/contracts/index.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";
import { saveProfile } from "../api/profile.ts";

import type { ReactElement } from "react";

function WelcomeProfilePage(): ReactElement {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const onSave = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await saveProfile(name, profile, []);
      await saveOnboardingStep("done");
      await navigate({ to: "/home" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "保存できませんでした。");
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-col gap-4">
      <Heading as="h1" size="page">
        基本項目の入力
      </Heading>
      <FormColumn>
        <Field
          label="ユーザー名"
          maxLength={maximumNameLength}
          name="name"
          onValueChange={setName}
          required
          value={name}
        />
        <Field
          label="自己紹介"
          maxLength={maximumProfileLength}
          multiline
          name="profile"
          onValueChange={setProfile}
          value={profile}
        />
      </FormColumn>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      <Button
        disabled={busy || name.trim() === ""}
        onClick={() => void onSave()}
        type="button"
        variant="primary"
      >
        保存してホームへ
      </Button>
    </main>
  );
}

export { WelcomeProfilePage };
