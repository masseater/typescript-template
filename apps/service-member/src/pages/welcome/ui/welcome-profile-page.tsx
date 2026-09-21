import { Button, Field, FormColumn, Heading, localState, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { maximumNameLength, maximumProfileLength } from "#shared/contracts/index.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";
import { saveProfile } from "../api/profile.ts";

import type { ReactElement } from "react";

const useName = localState("");
const useProfile = localState("");

function WelcomeProfilePage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();
  const [name, setName] = useName();
  const [profile, setProfile] = useProfile();

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
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <Button
        disabled={action.blocked || name.trim() === ""}
        onClick={() => {
          action.run(async () => {
            await saveProfile(name, profile, []);
            await saveOnboardingStep("done");
            await navigate({ to: "/home" });
          });
        }}
        type="button"
        variant="primary"
      >
        保存してホームへ
      </Button>
    </main>
  );
}

export { WelcomeProfilePage };
