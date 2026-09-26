import { Schema } from "effect";

import type { StackInventory } from "./inventory.ts";

const isWorkersDevDeclaration = Schema.is(
  Schema.Struct({
    enabled: Schema.optional(Schema.Unknown),
    previewsEnabled: Schema.optional(Schema.Unknown),
  }),
);

const isCoreWorkerDeclaration = Schema.is(
  Schema.Struct({
    domain: Schema.optional(Schema.Unknown),
    routes: Schema.optional(Schema.Array(Schema.Unknown)),
    workersDev: Schema.optional(Schema.Unknown),
  }),
);

const workersDevIsPrivate = (workersDev: unknown): boolean => {
  if (workersDev === false) {
    return true;
  }
  if (!isWorkersDevDeclaration(workersDev)) {
    return false;
  }
  return workersDev.enabled === false && workersDev.previewsEnabled !== true;
};

const corePublicViolation = (declared: unknown): string | undefined => {
  if (!isCoreWorkerDeclaration(declared)) {
    return "core_worker_declaration_unreadable";
  }
  if (declared.domain !== undefined) {
    return "core_worker_has_custom_domain";
  }
  if ((declared.routes ?? []).length > 0) {
    return "core_worker_has_public_routes";
  }
  if (!workersDevIsPrivate(declared.workersDev)) {
    return "core_worker_has_workers_dev";
  }
  return undefined;
};

const assertCoreNotPublic = (inventory: StackInventory): string | undefined => {
  const worker = inventory.resources["Worker"];
  if (worker?.type !== "Cloudflare.Worker") {
    return "core_worker_missing";
  }
  return corePublicViolation(worker.declared);
};

export { assertCoreNotPublic };
