import type { types } from "@pulumi/cloudflare";

export const workerObservability = {
  enabled: true,
  headSamplingRate: 1,
  logs: { enabled: true, headSamplingRate: 1, invocationLogs: false },
  traces: { enabled: true, headSamplingRate: 1, propagationPolicy: "accept" },
} satisfies types.input.WorkerObservability;
