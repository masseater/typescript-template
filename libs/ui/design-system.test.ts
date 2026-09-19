import { AssertionError } from "node:assert";

import { plugin } from "@shadcn/lint";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, expect, it } from "vite-plus/test";

import {
  appStylesheetViolations,
  coverageViolations,
  designSystemComponents,
  designSystemProbe,
  designTokens,
  indexedComponents,
  linkParts,
  linkViolations,
  sourceViolations,
  stylesheetPath,
  stylesheetSource,
  tokenViolations,
  untouchedTokens,
} from "./design-system.ts";
import { hoverViolations } from "./hover-colors.ts";
import { linkComponents, uiA11yComponents } from "./lint-settings.ts";
import { field } from "./record-field.ts";

const appManifests: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../apps/*/package.json",
  { eager: true, import: "default" },
);

const restyled = [
  ["no-restyle", "bg-destructive"],
  ["no-raw-colors", "text-red-500"],
  ["no-arbitrary-values", "text-[13px]"],
  ["no-unknown-classes", "shadow-xs"],
] as const;

const runDirectly = (_text: string, run: () => void): void => {
  run();
};

RuleTester.describe = runDirectly;
RuleTester.it = runDirectly;

const tester = new RuleTester({});

type RuleName = (typeof restyled)[number][0];

const restyleProbe = "apps/wiki/src/pages/consent/ui/consent-actions.tsx";

const reports = (rule: RuleName, className: string): boolean => {
  try {
    tester.run(rule, plugin.rules[rule], {
      invalid: [],
      valid: [
        {
          code: `import { Button } from "@repo/ui";\nexport const Probe = () => <Button type="button" className="${className}" />;\n`,
          filename: restyleProbe,
          options: [{ allow: ["layout", "spacing"] }],
        },
      ],
    });
  } catch (error) {
    if (error instanceof AssertionError) {
      return true;
    }
    throw error;
  }
  return false;
};

describe("design token table", () => {
  it("reads the stylesheet the linter resolves from components.json", () => {
    expect.hasAssertions();
    expect(stylesheetPath()).toMatch(/libs\/ui\/src\/styles\.css$/u);
  });

  it("keeps every ported token at the design token table value", () => {
    expect.hasAssertions();
    expect(tokenViolations(stylesheetSource())).toStrictEqual([]);
  });

  it.for(Object.keys(designTokens))(
    "reports %s when it drifts from the design token table",
    (token) => {
      expect.hasAssertions();
      expect(tokenViolations(`:root { ${token}: rebeccapurple; }`)).toContainEqual(
        expect.stringContaining(token),
      );
    },
  );

  it("keeps every hover colour darker than the colour it replaces", () => {
    expect.hasAssertions();
    expect(hoverViolations(stylesheetSource())).toStrictEqual([]);
  });

  it("reports a hover colour that is lighter than the colour it replaces", () => {
    expect.hasAssertions();
    expect(
      hoverViolations(":root { --danger: #e01e5a; --x: var(--danger); --x-hover: #ffffff; }"),
    ).toHaveLength(1);
  });

  it("reports a hover colour it cannot resolve to a colour", () => {
    expect.hasAssertions();
    expect(hoverViolations(":root { --x: red; --x-hover: blue; }")).toHaveLength(1);
  });

  it.for(untouchedTokens)("reports %s when it is redefined", (token) => {
    expect.hasAssertions();
    expect(tokenViolations(`@theme { ${token}: 8px; }`)).toContainEqual(
      expect.stringContaining(token),
    );
  });
});

const designSystemApps = Object.entries(appManifests)
  .filter(([, manifest]) => {
    const dependencies = field(manifest, "dependencies");
    return (
      typeof dependencies === "object" &&
      dependencies !== null &&
      Object.hasOwn(dependencies, "@repo/ui")
    );
  })
  .map(([key]) => key.replace(/^(?:\.\.\/)+/u, "").replace(/\/package\.json$/u, ""));

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

  it("reports a @source that scans a directory which does not exist", () => {
    expect.hasAssertions();
    expect(
      sourceViolations("apps/wiki", "apps/wiki/src/app/auth.css", '@source "./nonexistent";'),
    ).toHaveLength(1);
  });

  it("reports a @source that scans outside the app", () => {
    expect.hasAssertions();
    expect(
      sourceViolations("apps/wiki", "apps/wiki/src/app/auth.css", '@source "../../../libs/ui";'),
    ).toHaveLength(1);
  });

  it("reports a stylesheet with no @source at all", () => {
    expect.hasAssertions();
    expect(
      sourceViolations("apps/wiki", "apps/wiki/src/app/auth.css", '@import "tailwindcss";'),
    ).toHaveLength(1);
  });

  it("reports a stylesheet the app never links", () => {
    expect.hasAssertions();
    expect(linkViolations("apps/wiki", "apps/wiki/src/app/unlinked.css")).toHaveLength(1);
  });
});

describe("app stylesheet coverage", () => {
  it("reports a @source narrowed past the screens it has to cover", () => {
    expect.hasAssertions();
    expect(coverageViolations("apps/wiki", ["apps/wiki/src/app"])).toContainEqual(
      expect.stringContaining("apps/wiki/src/pages/consent/ui/consent-actions.tsx"),
    );
  });

  it("accepts a @source that covers every styled file of the app", () => {
    expect.hasAssertions();
    expect(coverageViolations("apps/wiki", ["apps/wiki/src"])).toStrictEqual([]);
  });
});

describe("design system lint", () => {
  it("resolves the parts directory through components.json", () => {
    expect.hasAssertions();
    expect(designSystemComponents()).toStrictEqual(
      expect.arrayContaining(["Button", "Field", "StatusMessage", "Table"]),
    );
  });

  it("leaves the story exports out of the part names it reports", () => {
    expect.hasAssertions();
    expect(designSystemComponents()).not.toContain("Default");
  });

  it("still sees the story exports in the upstream index", () => {
    expect.hasAssertions();
    expect(indexedComponents()).toContain("Default");
  });

  it.for(restyled)("%s reports a screen that restyles a part", ([rule, className]) => {
    expect.hasAssertions();
    expect(reports(rule, className)).toBe(true);
  });
});

describe("router link parts owned by ui", () => {
  it("finds the router link parts", () => {
    expect.hasAssertions();
    expect(linkParts()).toStrictEqual(expect.arrayContaining(["DropdownMenuLinkItem", "TextLink"]));
  });

  it.for([...linkComponents])("declares %s in ui lint settings", (name) => {
    expect.hasAssertions();
    expect(uiA11yComponents).toHaveProperty(name, "a");
  });

  it.for(linkParts())("lists %s among the discovered createLink parts", (name) => {
    expect.hasAssertions();
    expect(linkParts()).toContain(name);
  });
});
