import { originVisitor } from "./alias-visitor.ts";
import { filename, type LintContext } from "./lint-context.ts";

import type { Visitor } from "vite-plus/lint/plugins";
import type { Origin } from "./references.ts";

const cliImplementation = "libs/cli/src/features/cli/cli.ts";

const exitCodeImplementation = "libs/cli/src/features/cli/exit-code.ts";

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

const isProcessBoundaryBesideExitCode = (origin: Origin): boolean =>
  isProcessOutput(origin) || isRuntimeEntry(origin);

const processBoundaryVisitor = (inspection: LintContext): Visitor => {
  const inspected = filename(inspection);
  if (inspected.endsWith(`/${cliImplementation}`)) {
    return {};
  }
  if (inspected.endsWith(`/${exitCodeImplementation}`)) {
    return originVisitor(inspection, isProcessBoundaryBesideExitCode);
  }
  return originVisitor(inspection, isProcessBoundary);
};

export { cliImplementation, exitCodeImplementation, processBoundaryVisitor, processMember };
