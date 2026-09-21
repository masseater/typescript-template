import { AssertionError } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import { plugin } from "@shadcn/lint";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, expect, it } from "vite-plus/test";

import {
  linkComponents,
  uiA11yComponents,
} from "../../tools/dont-review-it/src/repository/ui-lint-settings.ts";
import {
  appStylesheetViolations,
  coverageViolations,
  declarations,
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
import { field } from "./record-field.ts";
import { Heading } from "./src/shared/ui/heading.tsx";

const appManifests: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../apps/*/package.json",
  { eager: true, import: "default" },
);

const restyled = [
  ["no-restyle", "bg-destructive"],
  ["no-raw-colors", "text-red-500"],
  ["no-arbitrary-values", "text-[13px]"],
  ["no-unknown-classes", "flooblenorf-999"],
] as const;

const runDirectly = (_text: string, run: () => void): void => {
  run();
};

RuleTester.describe = runDirectly;
RuleTester.it = runDirectly;

const tester = new RuleTester({});

type RuleName = (typeof restyled)[number][0];

const restyleProbe = "libs/ui/src/shared/ui/button.tsx";

const reports = (rule: RuleName, className: string): boolean => {
  try {
    tester.run(rule, plugin.rules[rule], {
      invalid: [],
      valid: [
        {
          code: `import { Button } from "@repo/ui";\nexport const Probe = () => <Button type="button" className="${className}" />;\n`,
          filename: restyleProbe,
          options: [{ allow: ["layout", "spacing"], componentImports: ["^@repo/ui(/|$)"] }],
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
      expect.arrayContaining([
        "apps/service-admin",
        "apps/service-member",
        "apps/internal-dashboard",
      ]),
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
      sourceViolations(
        "apps/internal-dashboard",
        "apps/internal-dashboard/src/app/auth.css",
        '@source "./nonexistent";',
      ),
    ).toHaveLength(1);
  });

  it("reports a @source that scans outside the app", () => {
    expect.hasAssertions();
    expect(
      sourceViolations(
        "apps/internal-dashboard",
        "apps/internal-dashboard/src/app/auth.css",
        '@source "../../../libs/ui";',
      ),
    ).toHaveLength(1);
  });

  it("reports a stylesheet with no @source at all", () => {
    expect.hasAssertions();
    expect(
      sourceViolations(
        "apps/internal-dashboard",
        "apps/internal-dashboard/src/app/auth.css",
        '@import "tailwindcss";',
      ),
    ).toHaveLength(1);
  });

  it("reports a stylesheet the app never links", () => {
    expect.hasAssertions();
    expect(
      linkViolations("apps/internal-dashboard", "apps/internal-dashboard/src/app/unlinked.css"),
    ).toHaveLength(1);
  });
});

describe("app stylesheet coverage", () => {
  it("reports a @source narrowed past the screens it has to cover", () => {
    expect.hasAssertions();
    expect(
      coverageViolations("apps/internal-dashboard", ["apps/internal-dashboard/src/app"]),
    ).toContainEqual(
      expect.stringContaining("apps/internal-dashboard/src/pages/consent/ui/consent-actions.tsx"),
    );
  });

  it("accepts a @source that covers every styled file of the app", () => {
    expect.hasAssertions();
    expect(
      coverageViolations("apps/internal-dashboard", ["apps/internal-dashboard/src"]),
    ).toStrictEqual([]);
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

const rootPx = 16;
const retiredPagePx = 24;
const landingPx = 48;

const retiredBodyFont =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, "Helvetica Neue", Arial, sans-serif';

const fontFacePattern = /@font-face\s*\{(?<body>[^}]*)\}/gu;
const variablePattern = /^var\((?<name>--[\w-]+)\)$/u;
const primaryRole = /^--(?:color-)?(?:primary|main)$/u;

type LoadedFace = {
  readonly family: string;
  readonly file: string;
  readonly weight: string;
};

const loadedFaces = (css: string): LoadedFace[] => {
  const faces: LoadedFace[] = [];
  for (const match of css.matchAll(fontFacePattern)) {
    const body = match.groups?.body ?? "";
    const family = /font-family:\s*"(?<family>[^"]+)"/u.exec(body)?.groups?.family;
    const src = /url\("(?<src>[^"]+)"\)/u.exec(body)?.groups?.src;
    const weight = /font-weight:\s*(?<weight>[^;]+)/u.exec(body)?.groups?.weight?.trim();
    if (family === undefined || src === undefined || weight === undefined) {
      continue;
    }
    faces.push({
      family,
      file: path.join(path.dirname(stylesheetPath()), src),
      weight,
    });
  }
  return faces;
};

const weightCovers = (declared: string, weight: number): boolean => {
  const parts = declared.split(/\s+/u).map(Number);
  const start = parts[0];
  const end = parts[1];
  if (start === undefined || Number.isNaN(start)) {
    return false;
  }
  return end === undefined || Number.isNaN(end)
    ? start === weight
    : weight >= start && weight <= end;
};

const resolvedValue = (
  declared: ReadonlyMap<string, string>,
  name: string,
  depth = 8,
): string | undefined => {
  const value = declared.get(name);
  const reference = value === undefined ? undefined : variablePattern.exec(value)?.groups?.name;
  return reference === undefined || depth === 0
    ? value
    : resolvedValue(declared, reference, depth - 1);
};

const firstFamily = (stack: string): string => {
  return (
    /^"(?<family>[^"]+)"/u.exec(stack.trim())?.groups?.family ?? stack.split(",")[0]?.trim() ?? ""
  );
};

const ruleBody = (css: string, selector: string): string => {
  return (
    new RegExp(String.raw`${selector}\s*\{(?<body>[^}]*)\}`, "u").exec(css)?.groups?.body ?? ""
  );
};

const declaredFont = (css: string, selector: string): string => {
  return (
    /font-family:\s*(?<value>[^;]+)/u.exec(ruleBody(css, selector))?.groups?.value?.trim() ?? ""
  );
};

const remPx = (value: string | undefined): number => {
  return Number.parseFloat(value ?? "") * rootPx;
};

const textSizeEntries = (declared: ReadonlyMap<string, string>): ReadonlyMap<string, string> => {
  const sizes = new Map<string, string>();
  for (const [name, value] of declared) {
    if (name.startsWith("--text-") && !name.endsWith("--line-height")) {
      sizes.set(name.slice("--text-".length), value);
    }
  }
  return sizes;
};

const headingClassName = (size: "block" | "page" | "section"): string => {
  const markup = renderToStaticMarkup(
    createElement(Heading, { as: "h1", children: "見出し", size }),
  );
  return /class="(?<className>[^"]*)"/u.exec(markup)?.groups?.className ?? "";
};

const classWeight = (className: string): number => {
  if (className.includes("font-medium")) {
    return 500;
  }
  if (className.includes("font-bold")) {
    return 700;
  }
  return 400;
};

describe("one type system", () => {
  it("applies a loaded text face and a different loaded display face", () => {
    expect.hasAssertions();
    const css = stylesheetSource();
    const declared = declarations(css);
    const faces = loadedFaces(css);
    expect(faces).toHaveLength(css.match(/@font-face/gu)?.length ?? 0);
    const textStack = resolvedValue(declared, "--font-sans") ?? "";
    const displayStack = resolvedValue(declared, "--font-display") ?? "";
    const textFace = firstFamily(textStack);
    const displayFace = firstFamily(displayStack);
    expect(textStack).not.toBe("system-ui, sans-serif");
    expect(textStack).not.toBe(retiredBodyFont);
    expect(textStack).not.toContain("system-ui");
    expect(textFace).not.toBe("Hiragino Sans");
    expect(displayFace).not.toBe(textFace);
    expect(declaredFont(css, "body")).toBe("var(--font-sans)");
    expect(declaredFont(css, "html")).toBe("var(--font-sans)");
    for (const family of [textFace, displayFace]) {
      const familyFaces = faces.filter((face) => face.family === family);
      expect(familyFaces.length).toBeGreaterThan(0);
      for (const face of familyFaces) {
        expect(readFileSync(face.file).subarray(0, 4).toString("ascii")).toBe("wOF2");
      }
    }
    expect(faces.some((face) => face.family === textFace && weightCovers(face.weight, 400))).toBe(
      true,
    );
    expect(faces.some((face) => face.family === textFace && weightCovers(face.weight, 700))).toBe(
      true,
    );
    const pageClass = headingClassName("page");
    expect(pageClass.split(/\s+/u)).toContain("font-display");
    expect(
      faces.some(
        (face) => face.family === displayFace && weightCovers(face.weight, classWeight(pageClass)),
      ),
    ).toBe(true);
    expect(headingClassName("section").split(/\s+/u)).toContain("font-sans");
  });

  it("keeps the accent on primary actions", () => {
    expect.hasAssertions();
    const declared = declarations(stylesheetSource());
    const accent = resolvedValue(declared, "--main");
    const holders = [...declared.keys()].filter((name) => resolvedValue(declared, name) === accent);
    expect(accent).toMatch(/^#[\da-f]{6}$/u);
    expect(holders).toStrictEqual(expect.arrayContaining(["--main", "--primary"]));
    expect(holders.filter((name) => !primaryRole.test(name))).toStrictEqual([]);
  });

  it("carries a dense step, a page heading above 24px, and a landing headline", () => {
    expect.hasAssertions();
    const sizes = textSizeEntries(declarations(stylesheetSource()));
    const pageClass = headingClassName("page");
    const pageStep = [...sizes.keys()].find((step) =>
      pageClass.split(/\s+/u).includes(`text-${step}`),
    );
    const pagePx = remPx(pageStep === undefined ? undefined : sizes.get(pageStep));
    const steps = [...sizes.values()].map((value) => remPx(value));
    expect(pagePx).toBeGreaterThan(retiredPagePx);
    expect(Math.min(...steps)).toBeLessThan(rootPx);
    expect(Math.max(...steps)).toBeGreaterThanOrEqual(landingPx);
    expect(Math.max(...steps)).toBeGreaterThan(pagePx);
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
