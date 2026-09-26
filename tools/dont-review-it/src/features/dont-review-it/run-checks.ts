import { Effect, type FileSystem, type PlatformError, Schema } from "effect";

import { runCanonicalLiteralTypeChecks } from "./canonical-literal-types/run-canonical-literal-type-checks.ts";
import { adoptedBundlesIn } from "./configs/bundles/adopted-bundles.ts";
import { LINT_BUNDLE, LINT_BUNDLE_NAMES, type LintBundle } from "./configs/bundles/bundle-names.ts";
import { defaultDependencyCatalogChecksConfig } from "./dependency-catalog/config.ts";
import { formatDependencyCatalogProblem } from "./dependency-catalog/problem.ts";
import { runDependencyCatalogChecks } from "./dependency-catalog/run-dependency-catalog-checks.ts";
import { defaultEntryCompositionConfig } from "./entry-composition/config.ts";
import { entryCompositionProblems } from "./entry-composition/entry-composition-problems.ts";
import { defaultIntentSkillsConfig } from "./intent-skills/config.ts";
import { shippedSkillsProblems } from "./intent-skills/shipped-skills.ts";
import {
  formatLintRuleProblem,
  lintRuleDocProblems,
  lintRuleIndexProblems,
} from "./lint-rule-authoring/index.ts";
import { listRepositoryFiles } from "./lint/oxlint/lib/canonical-values/source-files.ts";
import {
  findEquivalentConcepts,
  formatCanonicalValuesProblem,
  formatEquivalentConceptGroup,
  inspectCanonicalValues,
} from "./lint/oxlint/lib/canonical-values/verify.ts";
import { duplicatedClustersIn } from "./lint/oxlint/lib/duplicated-bodies/body-index.ts";
import { buildRepositoryBodyIndex } from "./lint/oxlint/lib/duplicated-bodies/builder.ts";
import { formatDuplicatedCluster } from "./lint/oxlint/lib/duplicated-bodies/site-report.ts";
import { textOrNull } from "./platform/file-system.ts";
import { path } from "./platform/path.ts";
import { defaultPresetAdoptionConfig } from "./preset-adoption/config.ts";
import {
  runPresetAdoptionChecks,
  type PresetAdoptionReport,
} from "./preset-adoption/run-preset-adoption-checks.ts";
import { formatRepositoryProblem } from "./problem.ts";
import { defaultRequiredFileFormConfig } from "./required-file-form/config.ts";
import { runRequiredFileFormChecks } from "./required-file-form/run-required-file-form-checks.ts";
import { defaultShippablePackagesConfig } from "./shippable-packages/config.ts";
import { shippablePackagesProblems } from "./shippable-packages/shippable-packages.ts";
import { defaultTelemetryWiringConfig } from "./telemetry-wiring/config.ts";
import { runTelemetryWiringChecks } from "./telemetry-wiring/run-telemetry-wiring-checks.ts";
import { defaultWorkflowChecksConfig } from "./workflows/config.ts";
import { workflowOutcomesOf, type WorkflowOutcomes } from "./workflows/workflow-outcomes.ts";

import type { ManifestReadFailure } from "./dependency-catalog/manifest-files.ts";
import type { DependencyCatalogReport } from "./dependency-catalog/problem.ts";
import type { EntryCompositionReport } from "./entry-composition/entry-composition-problems.ts";
import type { LintRuleCheckReport } from "./lint-rule-authoring/lint-rule-problem.ts";
import type { LintRuleWorkspaceFailure } from "./lint-rule-authoring/rule-index/lint-rule-workspaces.ts";
import type { CheckOutcome, ScannedProblems } from "./repository-checks/index.ts";

export type CheckReport = {
  readonly outcomes: readonly CheckOutcome[];
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
};

type ScanFailure = LintRuleWorkspaceFailure | ManifestReadFailure;

class RepositoryUnreadable extends Schema.TaggedError<RepositoryUnreadable>()(
  "RepositoryUnreadable",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    const reason = this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `The repository checks stopped before reporting, because what they scan could not be read: ${reason}`;
  }
}

const adoptedBundlesFor = (
  repositoryRoot: string,
): Effect.Effect<readonly LintBundle[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* adoptedBundlesFor() {
    const { toolchainConfigFileName } = defaultPresetAdoptionConfig;
    const source = yield* textOrNull(path.join(repositoryRoot, toolchainConfigFileName));
    const declared = source === null ? null : adoptedBundlesIn({ source, toolchainConfigFileName });
    return declared ?? LINT_BUNDLE_NAMES;
  });

const NOT_SCANNED: LintRuleCheckReport = { problems: [], scanned: 0 };

type LintRuleOutcomes = {
  readonly index: LintRuleCheckReport;
  readonly docs: LintRuleCheckReport;
};

const lintRuleOutcomesOf = ({
  repositoryRoot,
  unreadable,
}: {
  readonly repositoryRoot: string;
  readonly unreadable: boolean;
}): Effect.Effect<LintRuleOutcomes, ScanFailure, FileSystem.FileSystem> =>
  Effect.gen(function* lintRuleOutcomesOf() {
    if (unreadable) return { index: NOT_SCANNED, docs: NOT_SCANNED };
    return {
      index: yield* lintRuleIndexProblems({ repositoryRoot, write: false }),
      docs: yield* lintRuleDocProblems({ repositoryRoot, write: false }),
    };
  });

type ScannedReports = {
  readonly repositoryRoot: string;
  readonly adopted: readonly LintBundle[];
  readonly dependencyCatalog: DependencyCatalogReport;
  readonly entryComposition: EntryCompositionReport;
  readonly workflows: WorkflowOutcomes;
  readonly presetAdoption: PresetAdoptionReport;
  readonly requiredFileForm: ScannedProblems;
  readonly telemetryWiring: ScannedProblems;
  readonly lintRules: LintRuleOutcomes;
};

const scannedReportsOf = (
  repositoryRoot: string,
): Effect.Effect<ScannedReports, ScanFailure, FileSystem.FileSystem> =>
  Effect.gen(function* scannedReportsOf() {
    const dependencyCatalog = yield* runDependencyCatalogChecks({
      repositoryRoot,
      config: defaultDependencyCatalogChecksConfig,
    });
    return {
      repositoryRoot,
      adopted: yield* adoptedBundlesFor(repositoryRoot),
      dependencyCatalog,
      entryComposition: yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      }),
      workflows: yield* workflowOutcomesOf({ repositoryRoot, config: defaultWorkflowChecksConfig }),
      presetAdoption: yield* runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      }),
      requiredFileForm: yield* runRequiredFileFormChecks({
        repositoryRoot,
        config: defaultRequiredFileFormConfig,
      }),
      telemetryWiring: yield* runTelemetryWiringChecks({
        repositoryRoot,
        config: defaultTelemetryWiringConfig,
      }),
      lintRules: yield* lintRuleOutcomesOf({
        repositoryRoot,
        unreadable: dependencyCatalog.definitionUnreadable,
      }),
    };
  });

const BUNDLE_NOT_ADOPTED = "bundle not adopted";

const unrunCheck = ({
  check,
  unit,
}: {
  readonly check: string;
  readonly unit: string;
}): CheckOutcome => ({
  check,
  unit,
  count: 0,
  skippedReason: BUNDLE_NOT_ADOPTED,
  problems: [],
  warnings: [],
});

const SOURCE_SCAN_CHECKS: readonly { readonly check: string; readonly unit: string }[] = [
  { check: "canonical-values", unit: "source file" },
  { check: "equivalent-concepts", unit: "concept" },
  { check: "canonical-literal-types", unit: "declaration source" },
  { check: "duplicated-bodies", unit: "declaration source" },
];

const sourceScanOutcomes = (repositoryRoot: string): readonly CheckOutcome[] => {
  const repositoryFiles = listRepositoryFiles(path.resolve(repositoryRoot));
  const canonicalValues = inspectCanonicalValues({ repositoryRoot });
  const canonicalLiteralTypes =
    canonicalValues.problems.length === 0
      ? runCanonicalLiteralTypeChecks({
          catalog: canonicalValues.catalog,
          declarationSources: repositoryFiles.declarationSources,
          repositoryRoot,
        })
      : { problems: [], scanned: repositoryFiles.declarationSources.length };

  return [
    {
      check: "canonical-values",
      unit: "source file",
      count: repositoryFiles.commentSources.length,
      skippedReason: null,
      problems: canonicalValues.problems.map(formatCanonicalValuesProblem).toSorted(),
      warnings: [],
    },
    {
      check: "equivalent-concepts",
      unit: "concept",
      count: canonicalValues.catalog.entries.length,
      skippedReason: null,
      problems: [],
      warnings:
        canonicalValues.problems.length === 0
          ? findEquivalentConcepts(canonicalValues.catalog.entries)
              .map(formatEquivalentConceptGroup)
              .toSorted()
          : [],
    },
    {
      check: "canonical-literal-types",
      unit: "declaration source",
      count: canonicalLiteralTypes.scanned,
      skippedReason: null,
      problems: canonicalLiteralTypes.problems.map(formatRepositoryProblem).toSorted(),
      warnings: [],
    },
    {
      check: "duplicated-bodies",
      unit: "declaration source",
      count: repositoryFiles.declarationSources.length,
      skippedReason: null,
      problems: duplicatedClustersIn(buildRepositoryBodyIndex({ repositoryRoot }))
        .map(formatDuplicatedCluster)
        .toSorted(),
      warnings: [],
    },
  ];
};

const manifestScanOutcomes = (
  repositoryRoot: string,
): Effect.Effect<readonly CheckOutcome[], ScanFailure, FileSystem.FileSystem> =>
  Effect.gen(function* manifestScanOutcomes() {
    const shippablePackages = yield* shippablePackagesProblems({
      repositoryRoot,
      config: defaultShippablePackagesConfig,
    });
    const skills = yield* shippedSkillsProblems({
      repositoryRoot,
      config: defaultIntentSkillsConfig,
    });

    return [
      {
        check: "shippable-packages",
        unit: "manifest",
        count: shippablePackages.scanned,
        skippedReason: null,
        problems: shippablePackages.problems.map(formatRepositoryProblem).toSorted(),
        warnings: [],
      },
      {
        check: "intent-skills",
        unit: "manifest",
        count: skills.scanned,
        skippedReason: null,
        problems: skills.problems.map(formatRepositoryProblem).toSorted(),
        warnings: [],
      },
    ];
  });

const NO_WORKFLOW_DEFINITION = "no workflow definition";

const UNREADABLE_WORKSPACE_DEFINITION = "workspace definition does not parse";

const NO_WORKSPACE_DEFINITION = "no workspace definition";

const NO_TOOLCHAIN_CONFIG = "no toolchain configuration";

const outcomesOf = ({
  repositoryRoot,
  adopted,
  dependencyCatalog,
  entryComposition,
  workflows,
  presetAdoption,
  requiredFileForm,
  telemetryWiring,
  lintRules,
  manifestScans,
}: ScannedReports & {
  readonly manifestScans: readonly CheckOutcome[];
}): readonly CheckOutcome[] => [
  {
    check: "entry-composition",
    unit: "manifest",
    count: entryComposition.scanned,
    skippedReason: null,
    problems: entryComposition.problems.map(formatRepositoryProblem).toSorted(),
    warnings: [],
  },
  ...(adopted.includes(LINT_BUNDLE.singleOwnership)
    ? sourceScanOutcomes(repositoryRoot)
    : SOURCE_SCAN_CHECKS.map(unrunCheck)),
  {
    check: "workflow-definitions",
    unit: "definition",
    count: workflows.definitions.scanned,
    skippedReason: null,
    problems: workflows.definitions.problems.map(formatRepositoryProblem).toSorted(),
    warnings: [],
  },
  {
    check: "action-updates",
    unit: "update configuration",
    count: workflows.updates.scanned,
    skippedReason: workflows.definitions.scanned === 0 ? NO_WORKFLOW_DEFINITION : null,
    problems: workflows.updates.problems.map(formatRepositoryProblem).toSorted(),
    warnings: [],
  },
  {
    check: "lint-rule-index",
    unit: "workspace",
    count: lintRules.index.scanned,
    skippedReason: dependencyCatalog.definitionUnreadable ? UNREADABLE_WORKSPACE_DEFINITION : null,
    problems: lintRules.index.problems.map(formatLintRuleProblem).toSorted(),
    warnings: [],
  },
  {
    check: "lint-rule-docs",
    unit: "rule",
    count: lintRules.docs.scanned,
    skippedReason: dependencyCatalog.definitionUnreadable ? UNREADABLE_WORKSPACE_DEFINITION : null,
    problems: lintRules.docs.problems.map(formatLintRuleProblem).toSorted(),
    warnings: [],
  },
  {
    check: "dependency-declarations",
    unit: "manifest",
    count: dependencyCatalog.scanned,
    skippedReason: dependencyCatalog.definitionMissing ? NO_WORKSPACE_DEFINITION : null,
    problems: dependencyCatalog.problems.map(formatDependencyCatalogProblem).toSorted(),
    warnings: dependencyCatalog.warnings.map(formatDependencyCatalogProblem).toSorted(),
  },
  {
    check: "required-file-form",
    unit: "package root",
    count: requiredFileForm.scanned,
    skippedReason: null,
    problems: requiredFileForm.problems.map(formatRepositoryProblem).toSorted(),
    warnings: [],
  },
  {
    check: "preset-adoption",
    unit: "workspace",
    count: presetAdoption.scanned,
    skippedReason: presetAdoption.configMissing ? NO_TOOLCHAIN_CONFIG : null,
    problems: [],
    warnings: presetAdoption.warnings.map(formatRepositoryProblem).toSorted(),
  },
  {
    check: "telemetry-wiring",
    unit: "package root",
    count: telemetryWiring.scanned,
    skippedReason: null,
    problems: telemetryWiring.problems.map(formatRepositoryProblem).toSorted(),
    warnings: [],
  },
  ...manifestScans,
];

const CHECK_BUNDLES: Readonly<Record<string, LintBundle>> = {
  "entry-composition": LINT_BUNDLE.publishing,
  "canonical-values": LINT_BUNDLE.singleOwnership,
  "equivalent-concepts": LINT_BUNDLE.singleOwnership,
  "canonical-literal-types": LINT_BUNDLE.singleOwnership,
  "duplicated-bodies": LINT_BUNDLE.singleOwnership,
  "workflow-definitions": LINT_BUNDLE.ci,
  "action-updates": LINT_BUNDLE.ci,
  "lint-rule-index": LINT_BUNDLE.toolchain,
  "lint-rule-docs": LINT_BUNDLE.toolchain,
  "dependency-declarations": LINT_BUNDLE.toolchain,
  "required-file-form": LINT_BUNDLE.toolchain,
  "preset-adoption": LINT_BUNDLE.toolchain,
  "telemetry-wiring": LINT_BUNDLE.toolchain,
  "shippable-packages": LINT_BUNDLE.publishing,
  "intent-skills": LINT_BUNDLE.publishing,
};

const withinAdoption = ({
  outcomes,
  adopted,
}: {
  readonly outcomes: readonly CheckOutcome[];
  readonly adopted: readonly LintBundle[];
}): readonly CheckOutcome[] =>
  outcomes.map((ranCheck) => {
    const bundle = CHECK_BUNDLES[ranCheck.check];
    if (bundle === undefined || adopted.includes(bundle)) return ranCheck;
    return {
      ...ranCheck,
      count: 0,
      skippedReason: BUNDLE_NOT_ADOPTED,
      problems: [],
      warnings: [],
    };
  });

export const runChecks = (
  repositoryRoot: string,
): Effect.Effect<CheckReport, RepositoryUnreadable, FileSystem.FileSystem> =>
  Effect.gen(function* runChecks() {
    const reports = yield* scannedReportsOf(repositoryRoot);
    const manifestScans = yield* manifestScanOutcomes(repositoryRoot);
    const { adopted, entryComposition } = reports;
    const carried = withinAdoption({
      outcomes: outcomesOf({ ...reports, manifestScans }),
      adopted,
    });

    return {
      outcomes: carried,
      problems: carried.flatMap((ranCheck) => ranCheck.problems).toSorted(),
      warnings: carried.flatMap((ranCheck) => ranCheck.warnings).toSorted(),
      failures: adopted.includes(LINT_BUNDLE.publishing)
        ? entryComposition.failures.toSorted()
        : [],
    };
  }).pipe(Effect.mapError((unread) => RepositoryUnreadable.make({ cause: unread })));
export type { RepositoryUnreadable };
