import { relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

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

export const repeatedBodyVisitor = ({
  inspection,
  loadIndex,
  messageId,
  sitesOf,
}: {
  readonly inspection: Pick<Context, "cwd" | "filename" | "report">;
  readonly loadIndex: BodyIndexLoader;
  readonly messageId: string;
  readonly sitesOf: (
    index: BodyIndex,
    writtenBody: { readonly fingerprint: string; readonly name: string },
  ) => readonly BodySite[];
}): { readonly Program: (node: ESTree.Program) => void } => {
  const repositoryRootOf = memoize((): string => findWorkspaceRoot(inspection.cwd));
  return {
    Program(node) {
      const repositoryRoot = repositoryRootOf();
      const relativePath = toPosixPath(relative(repositoryRoot, resolve(inspection.filename)));
      const index = loadIndex({ repositoryRoot });
      for (const writtenBody of index.bodiesByPath.get(relativePath) ?? []) {
        const elsewhere = sitesOf(index, writtenBody).filter(
          (site) => site.relativePath !== relativePath || site.line !== writtenBody.line,
        );
        if (elsewhere.length > 0) {
          inspection.report({
            node: statementCovering(node.body, writtenBody.line) ?? node,
            messageId,
            data: { sites: spellSites(elsewhere) },
          });
        }
      }
    },
  };
};
