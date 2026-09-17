import type { types } from "@pulumi/cloudflare";

export const workerObservability = {
  enabled: true,
  headSamplingRate: 1,
  logs: { enabled: true, headSamplingRate: 1, invocationLogs: false },
} satisfies types.input.WorkerObservability;
