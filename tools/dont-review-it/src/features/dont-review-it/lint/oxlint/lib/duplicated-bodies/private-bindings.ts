import { groupBy, memoize, partition } from "es-toolkit";
import { parseSync } from "oxc-parser";

import { path } from "../../../../platform/path.ts";
import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import { repositoryModulePath } from "../canonical-values/import-route-resolution.ts";
import { realPathOf } from "../canonical-values/import-route-source-identity.ts";
import { isRelativeImportSpecifier } from "../canonical-values/import-specifier.ts";
import { nearestPackageDirectory, readTextFile } from "../canonical-values/source-files.ts";
import { toPosixPath } from "../posix-path.ts";
import { IMPORT_META_REFERENCE } from "./free-references.ts";

import type { IndexedFile } from "./body-index.ts";

type ImportedBinding = { readonly specifier: string; readonly importedName: string };

type ModuleBindings = {
  readonly imports: ReadonlyMap<string, ImportedBinding>;
  readonly reExports: ReadonlyMap<string, ImportedBinding>;
};

type Binding = { readonly bound: "privately" | "shared"; readonly target: string };

type BindingsByName = ReadonlyMap<string, Binding | null>;

const exportNameOf = (moduleExportName: unknown): string => {
  if (!isAstFields(moduleExportName)) return "";
  return moduleExportName[NODE_TYPE_FIELD] === "Identifier"
    ? String(moduleExportName.name)
    : String(moduleExportName.value);
};

const IMPORTED_NAME_BY_SPECIFIER_KIND: Readonly<Record<string, string>> = {
  ImportDefaultSpecifier: "default",
  ImportNamespaceSpecifier: "*",
};

const nodesIn = (syntaxField: unknown): readonly AstFields[] =>
  Array.isArray(syntaxField) ? syntaxField.filter(isAstFields) : [];

const specifierOf = (statement: AstFields): string =>
  isAstFields(statement.source) ? String(statement.source.value) : "";

const importsIn = (statement: AstFields): readonly (readonly [string, ImportedBinding])[] =>
  statement[NODE_TYPE_FIELD] === "ImportDeclaration"
    ? nodesIn(statement.specifiers).map((importSpecifier) => [
        exportNameOf(importSpecifier.local),
        {
          specifier: specifierOf(statement),
          importedName:
            IMPORTED_NAME_BY_SPECIFIER_KIND[String(importSpecifier[NODE_TYPE_FIELD])] ??
            exportNameOf(importSpecifier.imported),
        },
      ])
    : [];

const reExportsIn = (
  statement: AstFields,
  imports: ReadonlyMap<string, ImportedBinding>,
): readonly (readonly [string, ImportedBinding])[] => {
  if (statement[NODE_TYPE_FIELD] !== "ExportNamedDeclaration") return [];
  return nodesIn(statement.specifiers).flatMap((exportSpecifier) => {
    const localName = exportNameOf(exportSpecifier.local);
    const forwarded =
      statement.source === null
        ? imports.get(localName)
        : { specifier: specifierOf(statement), importedName: localName };
    return forwarded === undefined
      ? []
      : [[exportNameOf(exportSpecifier.exported), forwarded] as const];
  });
};

const moduleBindingsAt = memoize((absolutePath: string): ModuleBindings => {
  const source = readTextFile(absolutePath);
  if (source === null) return { imports: new Map(), reExports: new Map() };
  const statements = nodesIn(parseSync(absolutePath, source).program.body);
  const imports = new Map(statements.flatMap(importsIn));
  return {
    imports,
    reExports: new Map(statements.flatMap((statement) => reExportsIn(statement, imports))),
  };
});

type Place = { readonly repositoryRoot: string; readonly relativePath: string };

const isPackagePrivate = (specifier: string): boolean =>
  isRelativeImportSpecifier(specifier) || specifier.startsWith("#");

const unresolvedModuleOf = (place: Place, specifier: string): string => {
  if (isRelativeImportSpecifier(specifier)) {
    return toPosixPath(path.join(path.dirname(place.relativePath), specifier));
  }
  const packageDirectory =
    nearestPackageDirectory(
      path.dirname(path.join(place.repositoryRoot, place.relativePath)),
      place.repositoryRoot,
    ) ?? place.repositoryRoot;
  return `${toPosixPath(path.relative(place.repositoryRoot, packageDirectory))}${specifier}`;
};

const MAXIMUM_FORWARDING_HOPS = 16;

const bindingThrough = (
  place: Place,
  imported: ImportedBinding & { readonly hops: number },
): Binding => {
  if (!isPackagePrivate(imported.specifier)) {
    return { bound: "shared", target: `${imported.specifier}#${imported.importedName}` };
  }
  const resolvedPath = repositoryModulePath({
    importedName: imported.importedName,
    specifier: imported.specifier,
    filename: place.relativePath,
    repositoryRoot: place.repositoryRoot,
  });
  if (resolvedPath === null) {
    return {
      bound: "privately",
      target: `${unresolvedModuleOf(place, imported.specifier)}#${imported.importedName}`,
    };
  }
  const relativePath = toPosixPath(path.relative(realPathOf(place.repositoryRoot), resolvedPath));
  const forwarded =
    imported.hops > 0 ? moduleBindingsAt(resolvedPath).reExports.get(imported.importedName) : null;
  return forwarded === undefined || forwarded === null
    ? { bound: "privately", target: `${relativePath}#${imported.importedName}` }
    : bindingThrough(
        { repositoryRoot: place.repositoryRoot, relativePath },
        { ...forwarded, hops: imported.hops - 1 },
      );
};

const bindingOf = (place: Place, name: string): Binding | null => {
  if (name === IMPORT_META_REFERENCE) return { bound: "privately", target: place.relativePath };
  const imported = moduleBindingsAt(
    path.join(place.repositoryRoot, place.relativePath),
  ).imports.get(name);
  return imported === undefined
    ? null
    : bindingThrough(place, { ...imported, hops: MAXIMUM_FORWARDING_HOPS });
};

const bindApart = (left: BindingsByName, right: BindingsByName): boolean => {
  const candidates = [...new Set([...left.keys(), ...right.keys()])].filter(
    (name) => left.get(name)?.bound === "privately" || right.get(name)?.bound === "privately",
  );
  return (
    candidates.length > 0 &&
    candidates.every((name) => {
      const leftBinding = left.get(name) ?? null;
      const rightBinding = right.get(name) ?? null;
      return (
        leftBinding !== null && rightBinding !== null && leftBinding.target !== rightBinding.target
      );
    })
  );
};

export type ReferencingBody = IndexedFile["bodies"][number] & {
  readonly references: readonly string[];
};

export type ReferencingFile = {
  readonly relativePath: string;
  readonly bodies: readonly ReferencingBody[];
};

type PlacedBody = ReferencingBody & { readonly relativePath: string; readonly order: number };

const connectedGroupsOf = (
  members: readonly PlacedBody[],
  joined: (left: PlacedBody, right: PlacedBody) => boolean,
): readonly (readonly PlacedBody[])[] =>
  members
    .reduce<readonly (readonly PlacedBody[])[]>((groups, member) => {
      const [touching, apart] = partition(groups, (group) =>
        group.some((other) => joined(member, other)),
      );
      return [...apart, [...touching.flat(), member]];
    }, [])
    .toSorted(
      (left, right) =>
        Math.min(...left.map((member) => member.order)) -
        Math.min(...right.map((member) => member.order)),
    );

const siteKeyOf = (
  relativePath: string,
  site: { readonly name: string; readonly line: number },
): string => JSON.stringify([relativePath, site.line, site.name]);

const separatedFingerprints = (
  repositoryRoot: string,
  sameFingerprint: readonly PlacedBody[],
): readonly (readonly [string, string])[] => {
  const bindingsOf = memoize(
    (member: PlacedBody): BindingsByName =>
      new Map(
        member.references.map((name) => [
          name,
          bindingOf({ repositoryRoot, relativePath: member.relativePath }, name),
        ]),
      ),
  );
  return connectedGroupsOf(
    sameFingerprint,
    (left, right) => !bindApart(bindingsOf(left), bindingsOf(right)),
  ).flatMap((group, groupOrder) =>
    group.map((member) => [
      siteKeyOf(member.relativePath, member),
      groupOrder === 0 ? member.fingerprint : `${member.fingerprint}\0${String(groupOrder)}`,
    ]),
  );
};

export const separatedByPrivateBindings = ({
  repositoryRoot,
  files,
}: {
  readonly repositoryRoot: string;
  readonly files: readonly ReferencingFile[];
}): readonly IndexedFile[] => {
  const placed = files
    .flatMap((file) =>
      file.bodies.map((writtenBody) => ({ ...writtenBody, relativePath: file.relativePath })),
    )
    .map((writtenBody, order) => ({ ...writtenBody, order }));
  const refined = new Map(
    Object.values(groupBy(placed, (writtenBody) => writtenBody.fingerprint))
      .filter((sameFingerprint) => sameFingerprint.length > 1)
      .flatMap((sameFingerprint) => separatedFingerprints(repositoryRoot, sameFingerprint)),
  );
  return files.map((file) => ({
    relativePath: file.relativePath,
    bodies: file.bodies.map(({ name, line, fingerprint, nodeCount }) => ({
      name,
      line,
      fingerprint: refined.get(siteKeyOf(file.relativePath, { name, line })) ?? fingerprint,
      nodeCount,
    })),
  }));
};
