import { architectureKindOf } from "@repo/config";

import { filename, importVisitor, reportViolation, type LintContext, type Node } from "./lint-context.ts";
import { workspaceSource } from "./modular-layers.ts";

import type { Visitor } from "vite-plus/lint/plugins";

type ModularLocation =
  | { readonly kind: "app" | "shared" }
  | { readonly kind: "feature"; readonly slice: string }
  | { readonly kind: "other" };

const locationOf = (inside: string): ModularLocation => {
  const [layer, slice] = inside.split("/");
  if (layer === "app" || layer === "shared") {
    return { kind: layer };
  }
  if (layer === "features" && slice !== undefined && slice.length > 0) {
    return { kind: "feature", slice };
  }
  return { kind: "other" };
};

const resolveInside = (fromFile: string, specifier: string): string | undefined => {
  if (!specifier.startsWith(".")) {
    return undefined;
  }
  const source = workspaceSource(fromFile);
  if (source === undefined) {
    return undefined;
  }
  const fromDirectory = fromFile.slice(0, fromFile.lastIndexOf("/"));
  const segments = specifier.split("/");
  const stack = fromDirectory.split("/");
  for (const segment of segments) {
    if (segment === "." || segment === "") {
      continue;
    }
    if (segment === "..") {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  const resolved = stack.join("/");
  const marker = `/${source.workspacePath}/src/`;
  const index = resolved.lastIndexOf(marker);
  if (index < 0) {
    return undefined;
  }
  return resolved.slice(index + marker.length);
};

const isFeaturePublicApi = (inside: string, slice: string): boolean => {
  const prefix = `features/${slice}`;
  if (inside === prefix) {
    return true;
  }
  if (!inside.startsWith(`${prefix}/`)) {
    return false;
  }
  return /^(?:index(?:\.[^./]+)?)$/u.test(inside.slice(prefix.length + 1));
};

const crossesFeatureBoundary = (from: ModularLocation, target: ModularLocation): boolean => {
  if (target.kind !== "feature") {
    return false;
  }
  if (from.kind === "app") {
    return true;
  }
  return from.kind === "feature" && from.slice !== target.slice;
};

const modularImportsVisitor = (inspection: LintContext): Visitor => {
  const fromFile = filename(inspection);
  const source = workspaceSource(fromFile);
  if (source === undefined || architectureKindOf(source.workspacePath) !== "modular") {
    return {};
  }
  const from = locationOf(source.inside);
  return importVisitor((node: Node) => {
    if (node.type !== "Literal" || typeof node.value !== "string") {
      return;
    }
    const targetInside = resolveInside(fromFile, node.value);
    if (targetInside === undefined) {
      return;
    }
    const target = locationOf(targetInside);
    if (from.kind === "shared" && (target.kind === "feature" || target.kind === "app")) {
      reportViolation(inspection, node);
      return;
    }
    if (
      crossesFeatureBoundary(from, target) &&
      target.kind === "feature" &&
      !isFeaturePublicApi(targetInside, target.slice)
    ) {
      reportViolation(inspection, node);
    }
  });
};

export { modularImportsVisitor };
