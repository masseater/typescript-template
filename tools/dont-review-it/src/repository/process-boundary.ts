import { originVisitor } from "./alias-visitor.ts";
import { filename, type LintContext } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";
import type { Origin } from "./references.ts";

const cliImplementation = "libs/cli/src/cli.ts";

const processMember = (origin: Origin): string | undefined => {
  const [source, ...members] = origin;
  if (source === "node:process" || source === "process" || source === "import.meta") {
    return members[0];
  }
  return source === "global" && members[0] === "process" ? members[1] : undefined;
};

const isProcessOutput = (origin: Origin): boolean => {
  const member = processMember(origin);
  return member === "stdout" || member === "stderr";
};

const isRuntimeEntry = (origin: Origin): boolean => {
  const [source, ...members] = origin;
  if (source === "@effect/platform-node") {
    return members[0] === "NodeRuntime" && members[1] === "runMain";
  }
  return source === "@effect/platform-node/NodeRuntime" && members[0] === "runMain";
};

const isProcessBoundary = (origin: Origin): boolean => {
  return isProcessOutput(origin) || processMember(origin) === "exitCode" || isRuntimeEntry(origin);
};

const processBoundaryVisitor = (inspection: LintContext): Visitor => {
  if (filename(inspection).endsWith(`/${cliImplementation}`)) {
    return {};
  }
  return originVisitor(inspection, isProcessBoundary);
};

export { cliImplementation, processBoundaryVisitor, processMember };
