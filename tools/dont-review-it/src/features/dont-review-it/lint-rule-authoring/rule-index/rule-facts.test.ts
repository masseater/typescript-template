import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { lintRuleFactsIn } from "./rule-facts.ts";

layer(NodeServices.layer)("lintRuleFactsIn", (it) => {
  describe("a factory call carrying name, description, options, and notices", () => {
    const factsFixture = Effect.gen(function* facts() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/full.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `import { createRule } from "./create-rule.ts";
export const full = createRule({
  name: "no-full--stop-doing-it",
  meta: {
    type: "problem",
    docs: { description: "Disallow the thing" },
    messages: { report: "The thing must not be done. Stop." },
    schema: [{ type: "object" }],
    fixable: "code",
    hasSuggestions: true,
  },
  create: () => ({}),
});
`,
      );
      return yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath });
    });

    it.effect("is read in full", () =>
      Effect.gen(function* program() {
        const facts = yield* factsFixture;
        expect(facts).toStrictEqual([
          {
            name: "no-full--stop-doing-it",
            relatedGuidelines: [],
            unreadableGuidelines: 0,
            description: "Disallow the thing",
            sourcePath: "src/rules/full.ts",
            fixable: true,
            hasSuggestions: true,
            configurable: true,
            shipped: true,
            messages: [{ messageId: "report", template: "The thing must not be done. Stop." }],
          },
        ]);
      }),
    );
  });

  describe("a rule spelled as a bare object", () => {
    const factsFixture = Effect.gen(function* facts() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/bare.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const bare = {
  name: "no-bare--wrap-it",
  meta: {
    docs: { description: "Disallow bare spelling" },
    messages: { report: "It is forbidden." },
    schema: [],
    hasSuggestions: false,
  },
  create: () => ({}),
};
`,
      );
      return yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath });
    });

    it.effect("is read the same way as a factory call", () =>
      Effect.gen(function* program() {
        const facts = yield* factsFixture;
        expect(facts).toStrictEqual([
          {
            name: "no-bare--wrap-it",
            relatedGuidelines: [],
            unreadableGuidelines: 0,
            description: "Disallow bare spelling",
            sourcePath: "src/rules/bare.ts",
            fixable: false,
            hasSuggestions: false,
            configurable: false,
            shipped: true,
            messages: [{ messageId: "report", template: "It is forbidden." }],
          },
        ]);
      }),
    );
  });

  describe("a rule handed out by an arrow creator", () => {
    const ruleNamesFromArrowCreatorFixture = Effect.gen(function* ruleNamesFromArrowCreator() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/created.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `import { createRule } from "./create-rule.ts";
export const createRuleWithDeps = ({ load }: { load: () => void }) =>
  createRule({
    name: "no-created--inline-it",
    meta: { docs: { description: "Disallow creation" }, messages: { report: "No." } },
    create: () => ({}),
  });
export const makeNothing = () => {
  return {};
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map((rule) => rule.name);
    });

    it.effect("is still found", () =>
      Effect.gen(function* program() {
        const ruleNamesFromArrowCreator = yield* ruleNamesFromArrowCreatorFixture;
        expect(ruleNamesFromArrowCreator).toStrictEqual(["no-created--inline-it"]);
      }),
    );
  });

  describe("a description assembled from pieces", () => {
    const descriptionsFixture = Effect.gen(function* descriptions() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/assembled.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `const TAIL = " and never let it back" + ".";
export const assembled = {
  name: "no-assembled--flatten-it",
  meta: {
    docs: { description: "Disallow the part" + TAIL },
    messages: { report: \`It is forbidden.\` },
  },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map(
        (rule) => rule.description,
      );
    });

    it.effect("is resolved before it is read", () =>
      Effect.gen(function* program() {
        const descriptions = yield* descriptionsFixture;
        expect(descriptions).toStrictEqual(["Disallow the part and never let it back."]);
      }),
    );
  });

  describe("a description written as a plain template", () => {
    const descriptionsFixture = Effect.gen(function* descriptions() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/templated.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const templated = {
  name: "no-templated--spell-it-out",
  meta: { docs: { description: \`Disallow templates\` }, messages: { report: "No." } },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map(
        (rule) => rule.description,
      );
    });

    it.effect("keeps its text", () =>
      Effect.gen(function* program() {
        const descriptions = yield* descriptionsFixture;
        expect(descriptions).toStrictEqual(["Disallow templates"]);
      }),
    );
  });

  describe("descriptions the source does not spell statically", () => {
    const descriptionsFixture = Effect.gen(function* descriptions() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/opaque.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `import { described } from "./elsewhere.ts";
const spun = "a" + described;
const loops = other;
const other = loops;
export const computed = {
  name: "no-computed--write-it-down",
  meta: { docs: { description: describe() }, messages: { report: "No." } },
  create: () => ({}),
};
export const imported = {
  name: "no-imported--own-it",
  meta: { docs: { description: described }, messages: { report: "No." } },
  create: () => ({}),
};
export const numbered = {
  name: "no-numbered--name-it",
  meta: { docs: { description: 7 }, messages: { report: "No." } },
  create: () => ({}),
};
export const interpolated = {
  name: "no-interpolated--freeze-it",
  meta: { docs: { description: \`grows \${spun}\` }, messages: { report: "No." } },
  create: () => ({}),
};
export const circular = {
  name: "no-circular--break-it",
  meta: { docs: { description: loops }, messages: { report: "No." } },
  create: () => ({}),
};
export const headless = {
  name: "no-headless--anchor-it",
  meta: { docs: { description: describe() + " tail" }, messages: { report: "No." } },
  create: () => ({}),
};
export const tailless = {
  name: "no-tailless--anchor-it",
  meta: { docs: { description: "head " + describe() }, messages: { report: "No." } },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map(
        (rule) => rule.description,
      );
    });

    it.effect("fall back to silence", () =>
      Effect.gen(function* program() {
        const descriptions = yield* descriptionsFixture;
        expect(descriptions).toStrictEqual(["", "", "", "", "", "", ""]);
      }),
    );
  });

  describe("a rule without a name", () => {
    const ruleNamesFromUnnamedRuleFixture = Effect.gen(function* ruleNamesFromUnnamedRule() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/named-after-file.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const anonymous = {
  meta: { docs: { description: "Disallow anonymity" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map((rule) => rule.name);
    });

    it.effect("is called after its file", () =>
      Effect.gen(function* program() {
        const ruleNamesFromUnnamedRule = yield* ruleNamesFromUnnamedRuleFixture;
        expect(ruleNamesFromUnnamedRule).toStrictEqual(["named-after-file"]);
      }),
    );
  });

  describe("a rule in a file with a generic stem", () => {
    const ruleNamesFromIndexFileFixture = Effect.gen(function* ruleNamesFromIndexFile() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/no-generic--house-it/index.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const generic = {
  meta: { docs: { description: "Disallow generic stems" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map((rule) => rule.name);
    });

    it.effect("is called after its directory", () =>
      Effect.gen(function* program() {
        const ruleNamesFromIndexFile = yield* ruleNamesFromIndexFileFixture;
        expect(ruleNamesFromIndexFile).toStrictEqual(["no-generic--house-it"]);
      }),
    );
  });

  describe("a name the source does not spell statically", () => {
    const ruleNamesFromDynamicNameFixture = Effect.gen(function* ruleNamesFromDynamicName() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/fallback.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const dynamic = {
  name: pickName(),
  meta: { docs: { description: "Disallow dynamic names" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map((rule) => rule.name);
    });

    it.effect("falls back to the file", () =>
      Effect.gen(function* program() {
        const ruleNamesFromDynamicName = yield* ruleNamesFromDynamicNameFixture;
        expect(ruleNamesFromDynamicName).toStrictEqual(["fallback"]);
      }),
    );
  });

  describe("a name spelled with a quoted key", () => {
    const ruleNamesFromQuotedKeyFixture = Effect.gen(function* ruleNamesFromQuotedKey() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/quoted.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const quoted = {
  "name": "no-quoted--unquote-it",
  meta: {
    1: "stray",
    docs: { description: "Disallow quoted keys" },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map((rule) => rule.name);
    });

    it.effect("is still a name", () =>
      Effect.gen(function* program() {
        const ruleNamesFromQuotedKey = yield* ruleNamesFromQuotedKeyFixture;
        expect(ruleNamesFromQuotedKey).toStrictEqual(["no-quoted--unquote-it"]);
      }),
    );
  });

  describe("a file whose exports mostly define no rule", () => {
    const ruleNamesFromMixedExportsFixture = Effect.gen(function* ruleNamesFromMixedExports() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/mixed.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `import { base, otherMeta, sharedMessages } from "./shared.ts";
export type Shape = { readonly name: string };
export const budget = 42;
export const settings = { level: "high" };
export const detached = { meta: otherMeta, create: () => ({}) };
export const borrowed = { meta: { docs: {}, messages: sharedMessages }, create: () => ({}) };
export const undocumented = { meta: { messages: { report: "No." } }, create: () => ({}) };
export const spread = { ...base, meta: { docs: { description: "kept" }, messages: { report: "No." } } };
export const called = pickRule("no-object-argument");
export function helper(): void {}
export { budget as sharedBudget };
let uninitialised;
const [first] = [1];
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map((rule) => rule.name);
    });

    it.effect("passes over the exports that define no rule", () =>
      Effect.gen(function* program() {
        const ruleNamesFromMixedExports = yield* ruleNamesFromMixedExportsFixture;
        expect(ruleNamesFromMixedExports).toStrictEqual(["mixed", "mixed"]);
      }),
    );
  });

  describe("a docs field that is not an object literal", () => {
    const factsFixture = Effect.gen(function* facts() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/borrowed-docs.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `import { docsElsewhere, schemaElsewhere } from "./shared.ts";
export const borrowedDocs = {
  name: "no-borrowed-docs--inline-them",
  meta: { docs: docsElsewhere, messages: { report: "No." }, schema: schemaElsewhere },
  create: () => ({}),
};
`,
      );
      return yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath });
    });

    it.effect("reads as no description, and a schema it cannot open still declares options", () =>
      Effect.gen(function* program() {
        const facts = yield* factsFixture;
        expect(facts).toStrictEqual([
          {
            name: "no-borrowed-docs--inline-them",
            relatedGuidelines: [],
            unreadableGuidelines: 0,
            description: "",
            sourcePath: "src/rules/borrowed-docs.ts",
            fixable: false,
            hasSuggestions: false,
            configurable: true,
            shipped: true,
            messages: [{ messageId: "report", template: "No." }],
          },
        ]);
      }),
    );
  });

  describe("a schema named by a constant of the same file", () => {
    const factsFixture = Effect.gen(function* facts() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/named-schema.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `const EMPTY_SCHEMA = [];
export const namedSchema = {
  name: "no-named-schema--read-it",
  meta: { messages: { report: "No." }, schema: EMPTY_SCHEMA },
  create: () => ({}),
};
`,
      );
      return yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath });
    });

    it.effect("takes the constant it names as the schema it declares", () =>
      Effect.gen(function* program() {
        const facts = yield* factsFixture;
        expect(facts).toStrictEqual([
          {
            name: "no-named-schema--read-it",
            relatedGuidelines: [],
            unreadableGuidelines: 0,
            description: "",
            sourcePath: "src/rules/named-schema.ts",
            fixable: false,
            hasSuggestions: false,
            configurable: false,
            shipped: true,
            messages: [{ messageId: "report", template: "No." }],
          },
        ]);
      }),
    );
  });

  describe("rules that say whether the shipped preset carries them", () => {
    const shippedFlagsFixture = Effect.gen(function* shippedFlags() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/delivery.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const withheld = {
  name: "no-withheld--name-it-yourself",
  meta: {
    docs: { description: "Disallow withholding", shipped: false },
    messages: { report: "No." },
  },
  create: () => ({}),
};
export const declared = {
  name: "no-declared--keep-it",
  meta: {
    docs: { description: "Disallow declaring", shipped: true },
    messages: { report: "No." },
  },
  create: () => ({}),
};
export const silent = {
  name: "no-silent--keep-it",
  meta: { docs: { description: "Disallow silence" }, messages: { report: "No." } },
  create: () => ({}),
};
export const opaque = {
  name: "no-opaque--spell-it-out",
  meta: {
    docs: { description: "Disallow opacity", shipped: decide() },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map(
        (rule) => rule.shipped,
      );
    });

    it.effect("counts as withheld only the one that spells the refusal out", () =>
      Effect.gen(function* program() {
        const shippedFlags = yield* shippedFlagsFixture;
        expect(shippedFlags).toStrictEqual([false, true, true, true]);
      }),
    );
  });

  describe("a file exporting more than one rule", () => {
    const ruleNamesFromPairedExportsFixture = Effect.gen(function* ruleNamesFromPairedExports() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/pair.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const first = {
  name: "no-first--merge-them",
  meta: { docs: { description: "Disallow firsts" }, messages: { report: "No." } },
  create: () => ({}),
};
export const second = {
  name: "no-second--merge-them",
  meta: { docs: { description: "Disallow seconds" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).map((rule) => rule.name);
    });

    it.effect("makes every rule it exports appear once", () =>
      Effect.gen(function* program() {
        const ruleNamesFromPairedExports = yield* ruleNamesFromPairedExportsFixture;
        expect(ruleNamesFromPairedExports).toStrictEqual([
          "no-first--merge-them",
          "no-second--merge-them",
        ]);
      }),
    );
  });

  describe("messages whose name or whose text is settled while the program runs", () => {
    const readMessagesFixture = Effect.gen(function* readMessages() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/settled.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const settled = {
  name: "no-settled--write-it-out",
  meta: {
    docs: { description: "Disallow settling at run time" },
    messages: { 1: "No.", report: phrase(), spelled: "It is forbidden. Write it out." },
  },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).flatMap(
        (rule) => rule.messages,
      );
    });

    it.effect("keeps the one written out and passes over the two it cannot read", () =>
      Effect.gen(function* program() {
        const readMessages = yield* readMessagesFixture;
        expect(readMessages).toStrictEqual([
          { messageId: "spelled", template: "It is forbidden. Write it out." },
        ]);
      }),
    );
  });

  describe("grounds that are not written out as a list of paths", () => {
    const readGroundsFixture = Effect.gen(function* readGrounds() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/named-grounds.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const named = {
  name: "no-named-grounds--write-them-out",
  meta: {
    docs: { description: "Disallow naming grounds by a constant", relatedGuidelines: GROUNDS },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).flatMap(
        (rule) => rule.relatedGuidelines,
      );
    });

    it.effect("reads none of them", () =>
      Effect.gen(function* program() {
        const readGrounds = yield* readGroundsFixture;
        expect(readGrounds).toStrictEqual([]);
      }),
    );
  });

  describe("grounds holding a path settled while the program runs", () => {
    const readGroundsFixture = Effect.gen(function* readGrounds() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/settled-grounds.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const settled = {
  name: "no-settled-grounds--write-them-out",
  meta: {
    docs: {
      description: "Disallow settling grounds at run time",
      relatedGuidelines: [pathOf(), "docs/guidelines/tests.md"],
    },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).flatMap(
        (rule) => rule.relatedGuidelines,
      );
    });

    it.effect("keeps the one written out and passes over the one it cannot read", () =>
      Effect.gen(function* program() {
        const readGrounds = yield* readGroundsFixture;
        expect(readGrounds).toStrictEqual(["docs/guidelines/tests.md"]);
      }),
    );
  });

  describe("a rule declaring no grounds at all", () => {
    const readGroundsFixture = Effect.gen(function* readGrounds() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/no-grounds.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `export const bare = {
  name: "no-grounds--declare-them",
  meta: {
    docs: { description: "Disallow going without grounds" },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).flatMap(
        (rule) => rule.relatedGuidelines,
      );
    });

    it.effect("reads an empty list", () =>
      Effect.gen(function* program() {
        const readGrounds = yield* readGroundsFixture;
        expect(readGrounds).toStrictEqual([]);
      }),
    );
  });

  describe("grounds held by a constant of the same file", () => {
    const readGroundsFixture = Effect.gen(function* readGrounds() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-facts-" });

      const sourcePath = "src/rules/held-grounds.ts";
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, sourcePath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, sourcePath),
        `const GROUNDS = ["docs/guidelines/tests.md", "AGENTS.md"];

export const held = {
  name: "no-held-grounds--read-them",
  meta: {
    docs: { description: "Disallow holding grounds unread", relatedGuidelines: GROUNDS },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`,
      );
      return (yield* lintRuleFactsIn({ workspaceRoot: root, sourcePath })).flatMap(
        (rule) => rule.relatedGuidelines,
      );
    });

    it.effect("follows the constant and reads both paths", () =>
      Effect.gen(function* program() {
        const readGrounds = yield* readGroundsFixture;
        expect(readGrounds).toStrictEqual(["docs/guidelines/tests.md", "AGENTS.md"]);
      }),
    );
  });
});
