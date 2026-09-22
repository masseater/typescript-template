import { getRouteApi } from "@tanstack/react-router";

import { WelcomeShell } from "./welcome-shell.tsx";

import type { OnboardingStep } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

const progressLabel: Readonly<Record<Exclude<OnboardingStep, "done">, string>> = {
  agreement: "1 / 3 規約への同意",
  choose: "2 / 3 プロフィールの作り方",
  interview: "3 / 3 AI インタビュー",
  profile: "3 / 3 基本項目の入力",
};

const route = getRouteApi("/_welcome");

function WelcomeLayout(): ReactElement {
  const { step } = route.useRouteContext();
  const label = step === "done" ? "" : (progressLabel[step] ?? "");
  return <WelcomeShell progress={label} />;
}

export { WelcomeLayout };
