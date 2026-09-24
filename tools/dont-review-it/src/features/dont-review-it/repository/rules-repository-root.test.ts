import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness-test-fixture.ts";
import { repositoryRootOwner } from "./repository-root-path.ts";

const productionFile = "/project/tools/dev/src/features/dev/probe.ts";

const countedRoots = [
  ["a URL beside the module", 'export const root = new URL("../../../../../", import.meta.url);'],
  [
    "a URL to a file under the root",
    'export const manifest = new URL("../../../../../package.json", import.meta.url);',
  ],
  [
    "a template with a placeholder",
    "export const vars = (app: string) => new URL(`../../../../../apps/${app}/.dev.vars`, import.meta.url);",
  ],
  [
    "a join from the module directory",
    'import { join } from "node:path"; export const root = join(import.meta.dirname, "../../../../..");',
  ],
  [
    "a path split into segments",
    'import { resolve } from "node:path"; export const root = resolve(import.meta.dirname, "..", "..", "..", "..");',
  ],
  [
    "a location nested inside another argument",
    'import { dirname, resolve } from "node:path"; export const root = resolve(dirname(import.meta.filename), "../../../../../../");',
  ],
] as const;

const allowedPaths = [
  ["a sibling of the module", 'export const sibling = new URL("./sibling.json", import.meta.url);'],
  [
    "a path inside the same workspace",
    'export const config = new URL("../../../vite.config.ts", import.meta.url);',
  ],
  [
    "a module import",
    'import preview from "../../../../../.storybook/preview.tsx"; export { preview };',
  ],
  [
    "a glob pattern",
    'export const manifests = import.meta.glob("../../../../../*/package.json", { eager: true });',
  ],
  [
    "a deep path that is not taken from the module location",
    'import { join } from "node:path"; export const rebased = join("/base", "../../../../x");',
  ],
] as const;

describe("repository root computed from the module location", () => {
  it.for(countedRoots)("rejects %s", ([_label, code]) => {
    expect.assertions(1);
    expect(reported("repository-root", { code, filename: productionFile })).toBe(true);
  });

  it.for(allowedPaths)("allows %s", ([_label, code]) => {
    expect.assertions(1);
    expect(reported("repository-root", { code, filename: productionFile })).toBe(false);
  });

  it("leaves the owner of the repository root alone", () => {
    expect.assertions(1);
    const code =
      'import { join } from "node:path"; export const root = join(import.meta.dirname, "../../../../..");';
    expect(reported("repository-root", { code, filename: `/project/${repositoryRootOwner}` })).toBe(
      false,
    );
  });
});
