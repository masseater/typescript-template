import { Outlet, createFileRoute, getRouteApi } from "@tanstack/react-router";

import { enterWelcomeFrame, welcomePath } from "#app/entry-conditions.ts";
import { WelcomeShell } from "#widgets/welcome-shell/index.ts";

import type { OnboardingStep } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

const progressLabel: Readonly<Record<Exclude<OnboardingStep, "done">, string>> = {
  agreement: "1 / 3 規約への同意",
  choose: "2 / 3 プロフィールの作り方",
  interview: "3 / 3 AI インタビュー",
  profile: "3 / 3 基本項目の入力",
};

const Route = createFileRoute("/_welcome")({
  beforeLoad: async ({
    location,
  }: Readonly<{ location: Readonly<{ href: string; pathname: string }> }>) =>
    enterWelcomeFrame(location.href, location.pathname),
  component: WelcomeLayout,
});

const route = getRouteApi("/_welcome");

function WelcomeLayout(): ReactElement {
  const { step } = route.useRouteContext();
  const label = step === "done" ? "" : (progressLabel[step] ?? "");
  return (
    <WelcomeShell progress={label}>
      <Outlet />
    </WelcomeShell>
  );
}

export { Route, welcomePath };
