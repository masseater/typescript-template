---
description: "Disallow handing an assertion a whole imported data file, so a spec states the part of that file it keeps rather than restating the file and failing on every unrelated edit"
---

# no-whole-data-import-subject--assert-the-contract-member

<!-- BEGIN GENERATED rule-header -->

Disallow handing an assertion a whole imported data file, so a spec states the part of that file it keeps rather than restating the file and failing on every unrelated edit

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`no-whole-data-import-subject--assert-the-contract-member.ts`](../../src/features/dont-review-it/lint/oxlint/rules/testing/no-whole-data-import-subject--assert-the-contract-member.ts)

<!-- END GENERATED rule-header -->

## Violation

A whole imported data file handed to `expect(...)` in a spec file, with wrappers peeled first. A data file is an import whose specifier ends in `.json` or that carries the `type: "json"` attribute. The subject is reported when it is the import binding itself, or a test parameter bound to a fixture whose factory hands that binding back.

A data file is written by hand in this repository, so asserting all of it restates the file. That assertion fails on every edit to a field no spec keeps, and the usual repair is to copy the new content into the expected value, which checks nothing. The part of the file a spec keeps, such as the `exports` of a package manifest, is what the spec states.

The detection reads the binding by name. A data file reached through a local `const`, or a value derived from it, is not traced.

## Fix

Hand the assertion the member that states the contract, read straight off the import, such as `manifest.exports`. When a fixture carries the value, make the fixture hand over that member and name the fixture after it.

`no-expect-projected-subject--use-tostrictequal-on-subject` and `no-fixture-forward-subject--yield-sut-output` let a member of a data file through for this reason.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// the whole imported file restates every field of it
// in package-surface.test.ts
import manifest from "../package.json" with { type: "json" };
test("is run and not imported", () => {
  expect(manifest).toStrictEqual({ name: "a", bin: { a: "./cli.ts" }, exports: { "./package.json": "./package.json" } });
});
```

```ts
// a fixture handing over the whole imported file carries every field into the assertion
// in package-surface.test.ts
import manifest from "../package.json" with { type: "json" };
const it = test.extend("declaredManifest", () => manifest);
it("is run and not imported", ({ declaredManifest }) => {
  expect(declaredManifest).toStrictEqual({ name: "a", exports: { "./package.json": "./package.json" } });
});
```

Code this rule accepts.

```ts
// a member of the imported file names the part a spec keeps
// in package-surface.test.ts
import manifest from "../package.json" with { type: "json" };
test("is run and not imported", () => {
  expect(manifest.exports).toStrictEqual({ "./package.json": "./package.json" });
});
```

```ts
// a fixture handing over a member of the imported file names the kept part
// in package-surface.test.ts
import manifest from "../package.json" with { type: "json" };
const it = test.extend("manifestExports", () => manifest.exports);
it("is run and not imported", ({ manifestExports }) => {
  expect(manifestExports).toStrictEqual({ "./package.json": "./package.json" });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Copying the file into a local `const` before the assertion. The whole file is still what the spec restates
- Reading every member in turn, one assertion per field. The file is still restated field by field
- Replacing the equality with a snapshot. A snapshot of the whole file restates it just the same

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `wholeDataImport` | The subject of an assertion must not be a whole imported data file. Pass the member of \`{{subject}}\` that states the contract, such as \`{{subject}}.exports\`, to the assertion. |
| `wholeDataFixture` | The subject of an assertion must not be a fixture that hands over a whole imported data file. Narrow the fixture \`{{fixture}}\` to the member that states the contract, and name the fixture after that member. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
