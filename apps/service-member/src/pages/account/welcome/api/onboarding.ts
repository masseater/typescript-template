import { apiData } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";

import { userClient } from "#shared/api/index.ts";
import { OnboardingView } from "#shared/contracts/index.ts";

import type { OnboardingStep } from "#shared/contracts/index.ts";

function loadOnboardingStep(): Promise<OnboardingStep> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.onboarding.get().then((response) => apiData(OnboardingView, response).step),
  );
}

function saveOnboardingStep(step: OnboardingStep): Promise<OnboardingStep> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.onboarding.post({ step }).then((response) => apiData(OnboardingView, response).step),
  );
}

const onboardingOptions = queryOptions({
  queryFn: loadOnboardingStep,
  queryKey: ["onboarding"],
  retry: false,
});

export { loadOnboardingStep, onboardingOptions, saveOnboardingStep };
