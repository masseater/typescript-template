#!/usr/bin/env node
import { resolve } from "node:path";

import { listRepositoryFiles } from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { inspectCanonicalValues } from "../lint/oxlint/lib/canonical-values/verify.ts";
import { formatRepositoryProblem } from "../problem.ts";
import { EXIT_PROBLEMS_FOUND, measureCheck } from "../repository-checks/index.ts";
import { runCanonicalLiteralTypeChecks } from "./run-canonical-literal-type-checks.ts";

const repositoryRoot = resolve(process.argv[2] ?? process.cwd());

await measureCheck(() => {
  const { catalog } = inspectCanonicalValues({ repositoryRoot });
  const { declarationSources } = listRepositoryFiles(repositoryRoot);
  const { problems } = runCanonicalLiteralTypeChecks({
    catalog,
    declarationSources,
    repositoryRoot,
  });
  if (problems.length === 0) return;
  process.stdout.write(problems.map((problem) => `${formatRepositoryProblem(problem)}\n`).join(""));
  process.exitCode = EXIT_PROBLEMS_FOUND;
});
