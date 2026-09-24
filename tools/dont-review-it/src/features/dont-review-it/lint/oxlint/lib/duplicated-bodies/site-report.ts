import { memoize } from "es-toolkit";

import { path } from "../../../../platform/path.ts";
import { findWorkspaceRoot } from "../canonical-values/workspace-root.ts";
import { toPosixPath } from "../posix-path.ts";

import type { Context, ESTree } from "@oxlint/plugins";
import type { BodyIndex, BodyIndexLoader, BodySite } from "./body-index.ts";

export const spellSites = (sites: readonly BodySite[]): string =>
  sites.map((site) => `${site.relativePath}:${site.line} (${site.name})`).join(", ");

export const formatDuplicatedCluster = (sites: readonly BodySite[]): string =>
  `${spellSites(sites)} A body must not be spelled the same way in more than one declaration, because a fix applied to one of them leaves the others behind. Keep one of these declarations, and import it at the places that repeat it.`;

export const statementCovering = (
  statements: ESTree.Program["body"],
  line: number,
): ESTree.Node | null => {
  for (const statement of statements) {
    if (statement.loc.start.line <= line && line <= statement.loc.end.line) return statement;
  }
  return null;
};

type RepeatedSites = (
  index: BodyIndex,
  writtenBody: NonNullable<ReturnType<BodyIndex["bodiesByPath"]["get"]>>[number],
) => readonly BodySite[];

const repeatedBodyReports = ({
  index,
  relativePath,
  sitesOf,
}: {
  readonly index: BodyIndex;
  readonly relativePath: string;
  readonly sitesOf: RepeatedSites;
}): readonly { readonly line: number; readonly sites: string }[] =>
  (index.bodiesByPath.get(relativePath) ?? []).flatMap((writtenBody) => {
    const elsewhere = sitesOf(index, writtenBody).filter(
      (site) => site.relativePath !== relativePath || site.line !== writtenBody.line,
    );
    return elsewhere.length === 0 ? [] : [{ line: writtenBody.line, sites: spellSites(elsewhere) }];
  });

export const repeatedBodyVisitor = ({
  inspection,
  loadIndex,
  messageId,
  sitesOf,
}: {
  readonly inspection: Pick<Context, "cwd" | "filename" | "report">;
  readonly loadIndex: BodyIndexLoader;
  readonly messageId: string;
  readonly sitesOf: RepeatedSites;
}): { readonly Program: (node: ESTree.Program) => void } => {
  const repositoryRootOf = memoize((): string => findWorkspaceRoot(inspection.cwd));
  return {
    Program(node) {
      const repositoryRoot = repositoryRootOf();
      const reports = repeatedBodyReports({
        index: loadIndex({ repositoryRoot }),
        relativePath: toPosixPath(path.relative(repositoryRoot, path.resolve(inspection.filename))),
        sitesOf,
      });
      for (const report of reports) {
        inspection.report({
          node: statementCovering(node.body, report.line) ?? node,
          messageId,
          data: { sites: report.sites },
        });
      }
    },
  };
};
export type { RepeatedSites };
