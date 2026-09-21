import type { StackInventory } from "./inventory.ts";

const workersDevIsPrivate = (workersDev: unknown): boolean => {
  if (workersDev === false) {
    return true;
  }
  if (typeof workersDev !== "object" || workersDev === null) {
    return false;
  }
  const declared = workersDev as { readonly enabled?: unknown; readonly previewsEnabled?: unknown };
  return declared.enabled === false && declared.previewsEnabled !== true;
};

const corePublicViolation = (declared: unknown): string | undefined => {
  if (typeof declared !== "object" || declared === null) {
    return "core_worker_declaration_unreadable";
  }
  const worker = declared as {
    readonly domain?: unknown;
    readonly routes?: readonly unknown[];
    readonly workersDev?: unknown;
  };
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
};

const assertCoreNotPublic = (inventory: StackInventory): string | undefined => {
  const worker = inventory.resources["Worker"];
  if (worker === undefined || worker.type !== "Cloudflare.Worker") {
    return "core_worker_missing";
  }
  return corePublicViolation(worker.declared);
};

export { assertCoreNotPublic, corePublicViolation };
