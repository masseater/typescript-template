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

    it("names nothing, leaving the annotated type out", ({ references }) => {
      expect(references).toStrictEqual([]);
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

    it("names nothing, since every name it reads is a type", ({ references }) => {
      expect(references).toStrictEqual([]);
    });
  });

  describe("a body annotating, asserting and instantiating with imported types", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration(
        "const read = <Held extends Base>(source: Input): Output<Held> => decode<Held>(source as Raw) satisfies Checked;",
      ));

    it("names only the value it calls", ({ references }) => {
      expect(references).toStrictEqual(["decode"]);
    });
  });

  describe("a body reading build-time settings through import.meta", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration("const verbose = () => import.meta.env.DEV && flag;"));

    it("names the outer value, leaving import.meta out", ({ references }) => {
      expect(references).toStrictEqual(["flag"]);
    });
  });

  describe("a body resolving and listing modules next to its own file", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration(
        'const around = () => [import.meta.dirname, import.meta.filename, import.meta.resolve("./a.ts"), import.meta.glob("./*.ts"), import.meta[key]];',
      ));

    it("names the module it was read from and the computed key", ({ references }) => {
      expect(references).toStrictEqual(["import.meta", "key"]);
    });
  });

  describe("a constructor reading the class it was called through", () => {
    const it = test.extend("references", () =>
      referencesOfTheOnlyDeclaration("function Built() {\n  return new.target === Built;\n}"));

    it("names nothing outside its own declaration", ({ references }) => {
      expect(references).toStrictEqual([]);
    });
  });
});
