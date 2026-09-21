import { Button, Heading, STATUS_VARIANT, StatusMessage, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";

import { MemberPage } from "#widgets/member-page/index.ts";
import { saveOnboardingStep } from "../api/onboarding.ts";

import type { ReactElement } from "react";

function WelcomeInterviewPage(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();

  const finish = (): void => {
    action.run(() =>
      Effect.runPromise(
        Effect.gen(function* skipInterview() {
          yield* Effect.promise(() => saveOnboardingStep("done"));
          yield* Effect.promise(() => navigate({ to: "/home" }));
        }),
      ),
    );
  };

  return (
    <main className="flex flex-col gap-6">
      <MemberPage
        name="あなたのページ"
        nameAs="p"
        socialLinks={[]}
        biography={
          <p className="text-base leading-relaxed text-muted-foreground">
            答えが、この自己紹介になります。
          </p>
        }
      />
      <section className="flex flex-col gap-3">
        <Heading as="h1" size="page">
          AI インタビュー
        </Heading>
        <p className="text-lg leading-relaxed text-foreground">なんて呼べばいいですか？</p>
        <StatusMessage variant={STATUS_VARIANT.pending}>
          登録直後の AI
          インタビュー本体は、設定のインタビューと合わせて後続で接続します。いまはスキップしてホームへ進めます。
        </StatusMessage>
        {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
        <Button disabled={action.blocked} onClick={finish} type="button" variant="primary">
          ホームへ進む
        </Button>
        <Button disabled={action.blocked} onClick={finish} type="button" variant="secondary">
          インタビューをスキップ
        </Button>
      </section>
    </main>
  );
}

export { WelcomeInterviewPage };
