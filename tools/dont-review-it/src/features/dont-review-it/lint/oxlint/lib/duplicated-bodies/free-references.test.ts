import { describe, expect, test } from "vite-plus/test";

import { declarationsIn } from "./declarations.ts";

const referencesOfTheOnlyDeclaration = (source: string): readonly string[] =>
  declarationsIn(source).flatMap((declaration) => declaration.references);

describe("freeReferencesOf", () => {
  describe("a body calling an imported helper on its own parameter", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration(
        "const run = (value: number): number => helper(value) + limit;",
      ));

    it("names the helper and the outer value, leaving the parameter out", ({ references }) => {
      expect(references).toStrictEqual(["helper", "limit"]);
    });
  });

  describe("a body whose parameter shadows a name the module imports", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration(
        "const run = ({ helper }: Options): number => {\n  const [limit = 1] = helper;\n  return limit;\n};",
      ));

    it("names only the type it reads from outside", ({ references }) => {
      expect(references).toStrictEqual(["Options"]);
    });
  });

  describe("a body reading properties and building an object", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration(
        "const read = () => ({ title: source.title, [key]: source[field], shorthand });",
      ));

    it("names the objects and computed keys, not the property names", ({ references }) => {
      expect(references).toStrictEqual(["field", "key", "shorthand", "source"]);
    });
  });

  describe("a component rendering an element of its own module and an intrinsic one", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration(
        "function Screen() {\n  return <Frame title={heading}><span>{body}</span></Frame>;\n}",
      ));

    it("names the component and the values, leaving the intrinsic tag and attribute out", ({
      references,
    }) => {
      expect(references).toStrictEqual(["body", "Frame", "heading"]);
    });
  });

  describe("a body resolving a path next to its own file", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration(
        'const here = fileURLToPath(new URL("./plugin.ts", import.meta.url));',
      ));

    it("names the module it was read from as a reference of its own", ({ references }) => {
      expect(references).toStrictEqual(["fileURLToPath", "import.meta", "URL"]);
    });
  });

  describe("a type alias reading a type through a namespace", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration(
        "type Boxed<Held> = { readonly held: Held; readonly schema: Schema.Codec<Held> };",
      ));

    it("names the namespace, leaving its own name and type parameter out", ({ references }) => {
      expect(references).toStrictEqual(["Schema"]);
    });
  });
});
