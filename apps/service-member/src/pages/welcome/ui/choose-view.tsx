import { Button, Heading } from "@repo/ui";

import { MemberPage } from "#widgets/member-page/index.ts";

import type { ReactElement } from "react";

function ChooseView({
  blocked,
  error,
  onInterview,
  onProfile,
}: Readonly<{
  blocked: boolean;
  error?: string;
  onInterview: () => void;
  onProfile: () => void;
}>): ReactElement {
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
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
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
          <Button disabled={blocked} onClick={onInterview} type="button" variant="primary">
            AI にインタビューしてもらう
          </Button>
        }
      />
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm leading-normal text-muted-foreground">
          質問ではなく、項目を自分で書くこともできます。
        </p>
        <Button disabled={blocked} onClick={onProfile} type="button" variant="secondary">
          自分で入力する
        </Button>
      </div>
    </main>
  );
}

export { ChooseView };
