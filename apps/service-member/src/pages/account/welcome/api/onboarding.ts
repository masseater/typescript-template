import { apiData } from "@repo/runtime/client";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { userClient } from "#shared/api/index.ts";
import { OnboardingView } from "#shared/contracts/index.ts";

import type { OnboardingStep } from "#shared/contracts/index.ts";

const onboardingKey = ["onboarding"] as const;

async function loadOnboardingStep(): Promise<OnboardingStep> {
  const { api } = await userClient();
  return apiData(OnboardingView, await api.onboarding.get()).step;
}

async function saveOnboardingStep(step: OnboardingStep): Promise<OnboardingStep> {
  const { api } = await userClient();
  return apiData(OnboardingView, await api.onboarding.post({ step })).step;
}

const onboardingOptions = queryOptions({
  queryFn: loadOnboardingStep,
  queryKey: onboardingKey,
  retry: false,
});

const saveOnboardingOptions = mutationOptions({
  mutationFn: saveOnboardingStep,
  mutationKey: ["onboarding", "save"],
});

export { loadOnboardingStep, onboardingOptions, saveOnboardingStep };
