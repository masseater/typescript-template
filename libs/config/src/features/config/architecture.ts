import { applications } from "./applications.ts";

export const architectureKinds = ["fsd", "modular"] as const;
export type ArchitectureKind = (typeof architectureKinds)[number];

export const fsdPackages = applications;

export const modularLayers = ["app", "features", "shared"] as const;
export type ModularLayer = (typeof modularLayers)[number];

export const fsdLayers = ["app", "pages", "widgets", "features", "entities", "shared"] as const;
export type FsdLayer = (typeof fsdLayers)[number];

export const modularBudgets = {
  app: 400,
  shared: 800,
} as const;

const fsdPackageSet: ReadonlySet<string> = new Set(fsdPackages);

export const architectureKindOf = (workspacePath: string): ArchitectureKind | undefined => {
  const matched = /^(?<area>apps|libs|tools|infra)\/(?<name>[^/]+)$/u.exec(workspacePath)?.groups;
  if (matched === undefined) {
    return undefined;
  }
  if (matched["area"] === "apps" && fsdPackageSet.has(matched["name"] ?? "")) {
    return "fsd";
  }
  return "modular";
};
