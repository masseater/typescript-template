import {
  appStylesheetViolations,
  designSystemComponents,
  designSystemProbe,
  smarthrTokens,
  stylesheetPath,
  stylesheetSource,
  tokenViolations,
  untouchedTokens,
} from "./design-system.ts";
import { describe, expect, it } from "vite-plus/test";
import { field, workspaceManifests } from "./dependencies.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { plugin } from "@shadcn/lint";

const configs: Readonly<Record<string, unknown>> = import.meta.glob("../../vite.config.ts", {
  eager: true,
  import: "default",
});

const lint = field(configs["../../vite.config.ts"], "lint");

const restyled = [
  ["no-restyle", "bg-destructive"],
  ["no-raw-colors", "text-red-500"],
  ["no-arbitrary-values", "text-[13px]"],
  ["no-unknown-classes", "shadow-xs"],
] as const;

function runDirectly(_text: string, run: () => void): void {
  run();
}

RuleTester.describe = runDirectly;
RuleTester.it = runDirectly;

const tester = new RuleTester({});

type RuleName = (typeof restyled)[number][0];

function reports(rule: RuleName, className: string): boolean {
  try {
    tester.run(rule, plugin.rules[rule], {
      invalid: [],
      valid: [
        {
          code: `import { Button } from "@template/ui/ui";\nexport const Probe = () => <Button type="button" className="${className}" />;\n`,
          filename: designSystemProbe,
          options: [{ allow: ["layout", "spacing"] }],
        },
      ],
    });
  } catch {
    return true;
  }
  return false;
}

describe("smarthr-ui token port", () => {
  it("reads the stylesheet the linter resolves from components.json", () => {
    expect.hasAssertions();
    expect(stylesheetPath()).toMatch(/libs\/ui\/src\/styles\.css$/u);
  });

  it("keeps every ported token at the smarthr-ui value", () => {
    expect.hasAssertions();
    expect(tokenViolations(stylesheetSource())).toStrictEqual([]);
  });

  it.for(Object.keys(smarthrTokens))("reports %s when it drifts from smarthr-ui", (token) => {
    expect.hasAssertions();
    expect(tokenViolations(`:root { ${token}: rebeccapurple; }`)).toContainEqual(
      expect.stringContaining(token),
    );
  });

  it.for(untouchedTokens)("reports %s when it is redefined", (token) => {
    expect.hasAssertions();
    expect(tokenViolations(`@theme { ${token}: 8px; }`)).toContainEqual(
      expect.stringContaining(token),
    );
  });
});

const designSystemApps = workspaceManifests
  .filter(({ area, manifest }) => {
    const dependencies = field(manifest, "dependencies");
    return (
      area === "apps" &&
      typeof dependencies === "object" &&
      dependencies !== null &&
      Object.hasOwn(dependencies, "@template/ui")
    );
  })
  .map(({ file }) => file.replace("/package.json", ""));

describe("app stylesheet ownership", () => {
  it("covers every app that depends on the parts", () => {
    expect.hasAssertions();
    expect(designSystemApps).toStrictEqual(
      expect.arrayContaining(["apps/admin", "apps/user", "apps/wiki"]),
    );
  });

  it("lets each app declare its own sources", () => {
    expect.hasAssertions();
    expect(appStylesheetViolations(designSystemApps)).toStrictEqual([]);
  });

  it("reports an app without a stylesheet of its own", () => {
    expect.hasAssertions();
    expect(appStylesheetViolations(["apps/missing"])).toHaveLength(1);
  });
});

describe("design system lint", () => {
  it("resolves the parts directory through components.json", () => {
    expect.hasAssertions();
    expect(designSystemComponents()).toStrictEqual(
      expect.arrayContaining(["Button", "Field", "Status", "Table"]),
    );
  });

  it("enables every design system rule", () => {
    expect.hasAssertions();
    expect(field(lint, "jsPlugins")).toStrictEqual(expect.arrayContaining(["@shadcn/lint"]));
    expect(field(lint, "rules")).toMatchObject({
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-raw-colors": "error",
      "shadcn/no-restyle": ["error", { allow: ["layout", "spacing"] }],
      "shadcn/no-unknown-classes": "error",
    });
  });

  it.for(restyled)("%s reports a screen that restyles a part", ([rule, className]) => {
    expect.hasAssertions();
    expect(reports(rule, className)).toBe(true);
  });
});
