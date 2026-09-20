import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { OnboardingView } from "#shared/contracts/index.ts";

import type { OnboardingStep } from "#shared/contracts/index.ts";

async function loadOnboardingStep(): Promise<OnboardingStep> {
  const { api } = await userClient();
  return apiData(OnboardingView, await api.onboarding.get()).step;
}

async function saveOnboardingStep(step: OnboardingStep): Promise<OnboardingStep> {
  const { api } = await userClient();
  return apiData(OnboardingView, await api.onboarding.post({ step })).step;
}

export { loadOnboardingStep, saveOnboardingStep };
