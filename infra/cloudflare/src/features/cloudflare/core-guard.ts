import { Option, Schema } from "effect";

import type { StackInventory } from "./inventory.ts";

const WorkersDevSetting = Schema.Union([
  Schema.Boolean,
  Schema.Struct({
    enabled: Schema.optionalKey(Schema.Unknown),
    previewsEnabled: Schema.optionalKey(Schema.Unknown),
  }),
]);

const CoreWorkerDeclaration = Schema.Struct({
  domain: Schema.optionalKey(Schema.Unknown),
  routes: Schema.optionalKey(Schema.Array(Schema.Unknown)),
  workersDev: Schema.optionalKey(WorkersDevSetting),
});

const workersDevIsPrivate = (workersDev: typeof WorkersDevSetting.Type | undefined): boolean => {
  if (workersDev === false) {
    return true;
  }
  if (typeof workersDev !== "object") {
    return false;
  }
  return workersDev.enabled === false && workersDev.previewsEnabled !== true;
};

const corePublicViolation = (declared: unknown): string | undefined =>
  Option.match(Schema.decodeUnknownOption(CoreWorkerDeclaration)(declared), {
    onNone: () => "core_worker_declaration_unreadable",
    onSome: (worker) => {
      if (worker.domain !== undefined) {
        return "core_worker_has_custom_domain";
      }
      if (worker.routes !== undefined && worker.routes.length > 0) {
        return "core_worker_has_public_routes";
      }
      if (!workersDevIsPrivate(worker.workersDev)) {
        return "core_worker_has_workers_dev";
      }
      return undefined;
    },
  });

const assertCoreNotPublic = (inventory: StackInventory): string | undefined => {
  const worker = inventory.resources["Worker"];
  if (worker === undefined || worker.type !== "Cloudflare.Worker") {
    return "core_worker_missing";
  }
  return corePublicViolation(worker.declared);
};

export { assertCoreNotPublic };
