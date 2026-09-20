import { testLintRule } from "@repo/dont-review-it/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noInterfaceDeclaration } from "./no-interface-declaration--write-a-type-alias.ts";

describe("dont-review-it/no-interface-declaration--write-a-type-alias", () => {
  testLintRule(noInterfaceDeclaration, {
    valid: [
      {
        name: "an object type written as a type alias passes",
        documented: true,
        code: "type User = { readonly name: string };",
      },
      {
        name: "an interface merged into a module it augments stays",
        documented: true,
        code: 'declare module "@tanstack/react-router" {\n  interface Register {\n    router: AppRouter;\n  }\n}',
      },
      {
        name: "an interface merged into the global scope stays",
        code: "declare global {\n  interface Window {\n    ready: boolean;\n  }\n}",
      },
      {
        name: "an interface merged into an ambient namespace stays",
        code: "declare namespace Cloudflare {\n  interface Env {\n    DB: D1Database;\n  }\n}",
      },
      {
        name: "an interface nested deeper inside an ambient module stays",
        code: 'declare module "outer" {\n  namespace Inner {\n    interface Options {\n      depth: number;\n    }\n  }\n}',
      },
    ],
    invalid: [
      {
        name: "a top level interface is reported",
        documented: true,
        code: "interface User {\n  readonly name: string;\n}",
        errors: [{ messageId: "interfaceDeclaration" }],
      },
      {
        name: "an exported interface is reported",
        code: "export interface User {\n  readonly name: string;\n}",
        errors: [{ messageId: "interfaceDeclaration" }],
      },
      {
        name: "an interface inside a namespace that is not ambient is reported",
        code: "namespace Local {\n  export interface User {\n    readonly name: string;\n  }\n}",
        errors: [{ messageId: "interfaceDeclaration" }],
      },
      {
        name: "an interface inside a function body is reported",
        code: "const build = () => {\n  interface Local {\n    value: number;\n  }\n  return null;\n};",
        errors: [{ messageId: "interfaceDeclaration" }],
      },
    ],
  });
});
