import { noArrayMutation } from "../../lint/oxlint/rules/mutation-and-failure/no-array-mutation--derive-new-array.ts";
import { noDiscardedFailure } from "../../lint/oxlint/rules/mutation-and-failure/no-discarded-failure--receive-and-surface-it.ts";
import { noEmptyCatch } from "../../lint/oxlint/rules/mutation-and-failure/no-empty-catch--throw-or-handle.ts";
import { noFloatingPromise } from "../../lint/oxlint/rules/mutation-and-failure/no-floating-promise--await-the-result.ts";
import { noHandRolledServerRead } from "../../lint/oxlint/rules/mutation-and-failure/no-hand-rolled-server-read--use-tanstack-query.ts";
import { noLoggedAndContinuedFailure } from "../../lint/oxlint/rules/mutation-and-failure/no-logged-and-continued-failure--stop-or-recover.ts";
import { noPromiseChain } from "../../lint/oxlint/rules/mutation-and-failure/no-promise-chain--use-async-await.ts";
import { noReassign } from "../../lint/oxlint/rules/mutation-and-failure/no-reassign--use-spread-or-iife.ts";
import { noReceiverMutation } from "../../lint/oxlint/rules/mutation-and-failure/no-receiver-mutation--derive-new-value.ts";
import { noSilentCatch } from "../../lint/oxlint/rules/mutation-and-failure/no-silent-catch--rethrow-or-handle.ts";
import { requireQueryOptionsInApiSegment } from "../../lint/oxlint/rules/mutation-and-failure/require-query-options-in-api-segment--move-query-options-to-api.ts";
import { noClassAsMutableCell } from "../../plugin.ts";

import type { WorkspaceLintRule } from "../../lint-rule-authoring/index.ts";

export const mutationAndFailureBundle: readonly WorkspaceLintRule[] = [
  noArrayMutation,
  noClassAsMutableCell,
  noDiscardedFailure,
  noEmptyCatch,
  noFloatingPromise,
  noHandRolledServerRead,
  noLoggedAndContinuedFailure,
  noPromiseChain,
  noReassign,
  noReceiverMutation,
  noSilentCatch,
  requireQueryOptionsInApiSegment,
];
