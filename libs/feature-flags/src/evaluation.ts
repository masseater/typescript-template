import { StandardResolutionReasons } from "@openfeature/server-sdk";

import { FLAG_EVALUATION_KIND, type FlagEvaluationKind } from "./definitions.ts";

export type FlagEvaluation = Readonly<{
  enabled: boolean;
  kind: FlagEvaluationKind;
}>;

const failClosedEnabled = false;

const evaluationFromDetails = (
  details: Readonly<{
    errorCode?: string;
    reason?: string;
    value: boolean;
  }>,
): FlagEvaluation => {
  if (details.errorCode !== undefined || details.reason === StandardResolutionReasons.ERROR) {
    return { enabled: failClosedEnabled, kind: FLAG_EVALUATION_KIND.failClosed };
  }
  return { enabled: details.value, kind: FLAG_EVALUATION_KIND.evaluated };
};

export { evaluationFromDetails, failClosedEnabled };
