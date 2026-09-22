import { apiData } from "@repo/runtime/client";

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

export { loadOnboardingStep, saveOnboardingStep };
