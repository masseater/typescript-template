import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { noWholeDataImportSubject } from "./no-whole-data-import-subject--assert-the-contract-member.ts";

const SPEC_FILE = "package-surface.test.ts";

const MANIFEST_IMPORT = 'import manifest from "../package.json" with { type: "json" };\n';

describe("dont-review-it/no-whole-data-import-subject--assert-the-contract-member", () => {
  testLintRule(noWholeDataImportSubject, {
    valid: [
      {
        name: "a member of the imported file names the part a spec keeps",
        documented: true,
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}test("is run and not imported", () => {\n  expect(manifest.exports).toStrictEqual({ "./package.json": "./package.json" });\n});`,
      },
      {
        name: "a fixture handing over a member of the imported file names the kept part",
        documented: true,
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}const it = test.extend("manifestExports", () => manifest.exports);\nit("is run and not imported", ({ manifestExports }) => {\n  expect(manifestExports).toStrictEqual({ "./package.json": "./package.json" });\n});`,
      },
      {
        name: "a whole binding the code under test produced is the subject other rules ask for",
        filename: SPEC_FILE,
        code: `const it = test.extend("report", () => summarise());\nit("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "a module import without the data attribute is code, not a data file",
        filename: SPEC_FILE,
        code: `import { defaults } from "./defaults.ts";\ntest("keeps the defaults", () => {\n  expect(defaults).toStrictEqual({ retries: 3 });\n});`,
      },
      {
        name: "an import attribute other than the data type leaves the module as code",
        filename: SPEC_FILE,
        code: `import styles from "./styles.css" with { type: "css" };\ntest("keeps the styles", () => {\n  expect(styles).toStrictEqual({});\n});`,
      },
      {
        name: "a local binding sharing the imported name shadows the data file",
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}test("keeps the summary", () => {\n  const manifest = summarise();\n  expect(manifest).toStrictEqual({ total: 2 });\n});`,
      },
      {
        name: "a test parameter bound to a fixture that hands over code output is left alone",
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}const it = test.extend("report", () => summarise(manifest));\nit("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "a binding no block of the spec receives reaches no fixture",
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}const it = test.extend("declaredManifest", () => manifest);\nexpect(declaredManifest).toStrictEqual({ name: "a" });`,
      },
      {
        name: "a spread handed to the assertion names no subject",
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}test("keeps the manifest", () => {\n  expect(...manifest).toStrictEqual({ name: "a" });\n});`,
      },
      {
        name: "an entry call handed nothing names no subject",
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}test("keeps the manifest", () => {\n  expect().toStrictEqual({ name: "a" });\n});`,
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "package-surface.ts",
        code: `${MANIFEST_IMPORT}test("keeps the manifest", () => {\n  expect(manifest).toStrictEqual({ name: "a" });\n});`,
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-spec.ts"] }],
        code: `${MANIFEST_IMPORT}test("keeps the manifest", () => {\n  expect(manifest).toStrictEqual({ name: "a" });\n});`,
      },
    ],
    invalid: [
      {
        name: "the whole imported file restates every field of it",
        documented: true,
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}test("is run and not imported", () => {\n  expect(manifest).toStrictEqual({ name: "a", bin: { a: "./cli.ts" }, exports: { "./package.json": "./package.json" } });\n});`,
        errors: [{ messageId: "wholeDataImport" }],
      },
      {
        name: "a fixture handing over the whole imported file carries every field into the assertion",
        documented: true,
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}const it = test.extend("declaredManifest", () => manifest);\nit("is run and not imported", ({ declaredManifest }) => {\n  expect(declaredManifest).toStrictEqual({ name: "a", exports: { "./package.json": "./package.json" } });\n});`,
        errors: [{ messageId: "wholeDataFixture" }],
      },
      {
        name: "a data file imported by its extension alone is a data file as well",
        filename: SPEC_FILE,
        code: `import manifest from "../package.json";\ntest("keeps the manifest", () => {\n  expect(manifest).toStrictEqual({ name: "a" });\n});`,
        errors: [{ messageId: "wholeDataImport" }],
      },
      {
        name: "a data attribute spelled as a string key marks the data file the same way",
        filename: SPEC_FILE,
        code: `import messages from "./messages" with { "type": "json" };\ntest("keeps the messages", () => {\n  expect(messages).toStrictEqual({ hello: "hi" });\n});`,
        errors: [{ messageId: "wholeDataImport" }],
      },
      {
        name: "a namespace import of a data file hands over the whole file",
        filename: SPEC_FILE,
        code: `import * as manifest from "../package.json" with { type: "json" };\ntest("keeps the manifest", () => {\n  expect(manifest).toStrictEqual({ default: { name: "a" } });\n});`,
        errors: [{ messageId: "wholeDataImport" }],
      },
      {
        name: "a snapshot of the whole imported file restates it just the same",
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}test("keeps the manifest", () => {\n  expect(manifest).toMatchSnapshot();\n});`,
        errors: [{ messageId: "wholeDataImport" }],
      },
      {
        name: "a fixture received under another name is traced back to its declaration",
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}const it = test.extend("declaredManifest", () => manifest);\nit("keeps the manifest", ({ declaredManifest: surface }) => {\n  expect(surface).toStrictEqual({ name: "a" });\n});`,
        errors: [{ messageId: "wholeDataFixture" }],
      },
      {
        name: "a fixture declared in the object form hands over the whole file the same way",
        filename: SPEC_FILE,
        code: `${MANIFEST_IMPORT}const it = test.extend({ declaredManifest: async ({}, use) => { await use(manifest); } });\nit("keeps the manifest", ({ declaredManifest }) => {\n  expect(declaredManifest).toStrictEqual({ name: "a" });\n});`,
        errors: [{ messageId: "wholeDataFixture" }],
      },
    ],
  });
});
