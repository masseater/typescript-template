import { originVisitor } from "./alias-visitor.ts";
import { filename, type LintContext } from "./lint-context.ts";

import type { Context, Visitor } from "vite-plus/lint/plugins";
import type { Origin } from "./references.ts";

type OptionedLintContext = LintContext & Readonly<Pick<Context, "options">>;

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

const isBuiltinModuleLoader = (origin: Origin): boolean =>
  processMember(origin) === "getBuiltinModule";

const isProcessBoundary = (origin: Origin): boolean => {
  return (
    isProcessOutput(origin) ||
    processMember(origin) === "exitCode" ||
    isRuntimeEntry(origin) ||
    isBuiltinModuleLoader(origin)
  );
};

const isProcessBoundaryBesideExitCode = (origin: Origin): boolean =>
  isProcessOutput(origin) || isRuntimeEntry(origin) || isBuiltinModuleLoader(origin);

const builtinLoaderOnly = (inspection: OptionedLintContext): boolean => {
  const [setting] = inspection.options;
  return (
    typeof setting === "object" &&
    setting !== null &&
    "builtinLoaderOnly" in setting &&
    setting.builtinLoaderOnly === true
  );
};

const processBoundaryVisitor = (inspection: OptionedLintContext): Visitor => {
  const inspected = filename(inspection);
  if (inspected.endsWith(`/${cliImplementation}`) || builtinLoaderOnly(inspection)) {
    return originVisitor(inspection, isBuiltinModuleLoader);
  }
  if (inspected.endsWith(`/${exitCodeImplementation}`)) {
    return originVisitor(inspection, isProcessBoundaryBesideExitCode);
  }
  return originVisitor(inspection, isProcessBoundary);
};

export { cliImplementation, exitCodeImplementation, processBoundaryVisitor, processMember };
export type { OptionedLintContext };
