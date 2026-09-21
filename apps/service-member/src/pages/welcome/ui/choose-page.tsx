import { Button, Heading, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { MemberPage } from "#widgets/member-page/index.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function ChoosePage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();

  const choose = (step: "interview" | "profile"): void => {
    action.run(async () => {
      await saveOnboardingStep(step);
      await navigate({ to: step === "profile" ? "/welcome/profile" : "/welcome/interview" });
    });
  };

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="page">
          プロフィールの作り方
        </Heading>
        <p className="text-base leading-normal text-foreground">
          インタビューに答えると、このページが埋まります。
        </p>
      </div>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <MemberPage
        name="あなたのページ"
        nameAs="p"
        socialLinks={[]}
        biography={
          <p className="text-base leading-relaxed text-muted-foreground">
            質問に答えると、自己紹介がここに書かれます。
          </p>
        }
        actions={
          <Button
            disabled={action.blocked}
            onClick={() => {
              choose("interview");
            }}
            type="button"
            variant="primary"
          >
            AI にインタビューしてもらう
          </Button>
        }
      />
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm leading-normal text-muted-foreground">
          質問ではなく、項目を自分で書くこともできます。
        </p>
        <Button
          disabled={action.blocked}
          onClick={() => {
            choose("profile");
          }}
          type="button"
          variant="secondary"
        >
          自分で入力する
        </Button>
      </div>
    </main>
  );
}

export { ChoosePage };
