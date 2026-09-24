import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { partsDirectory } from "./design-system-test-fixture.ts";
import {
  a11yRelaxations,
  storybookEndpointViolations,
  storylessParts,
  vendoredWorkerViolations,
} from "./part-stories-test-fixture.ts";
import { field } from "./record-field-test-fixture.ts";

const previews: Readonly<Record<string, unknown>> = import.meta.glob("./storybook/preview.tsx", {
  eager: true,
  import: "default",
});

const configs: Readonly<Record<string, unknown>> = import.meta.glob("../../vite.config.ts", {
  eager: true,
  import: "default",
});

const origins: Readonly<Record<string, unknown>> = import.meta.glob(
  "../config/src/features/config/applications.ts",
  { eager: true, import: "storybookOrigin" },
);

const composedParameters = (preview: unknown): unknown => {
  return typeof preview === "object" && preview !== null && "composed" in preview
    ? field(preview.composed, "parameters")
    : undefined;
};

const storybookProjects = (): unknown[] => {
  const projects: unknown = field(field(configs["../../vite.config.ts"], "test"), "projects");
  return Array.isArray(projects) ? projects : [];
};

const [
  storylessPartsReport,
  storylessComponentsReport,
  relaxations,
  endpointReport,
  vendoredWorkerReport,
] = await Effect.runPromise(
  Effect.all([
    storylessParts(partsDirectory()),
    storylessParts("libs/ui/src/features/ui"),
    a11yRelaxations(),
    storybookEndpointViolations(String(origins["../config/src/features/config/applications.ts"])),
    vendoredWorkerViolations(),
  ]).pipe(Effect.provide(NodeServices.layer)),
);

const acceptedA11yViolations = [
  {
    file: "libs/ui/src/features/ui/shared/ui/select-field.stories.tsx",
    rule: "aria-valid-attr-value",
    story: "Selects",
  },
  {
    file: "libs/ui/src/features/ui/shared/ui/toast-provider.stories.tsx",
    rule: "aria-hidden-focus",
    story: "Success",
  },
];

describe("part stories", () => {
  it("looks for stories in the parts directory components.json points at", () => {
    expect.hasAssertions();
    expect(partsDirectory()).toMatch(/libs\/ui\/src\/features\/ui\/shared\/ui$/u);
  });

  it("keeps a story next to every part", () => {
    expect.hasAssertions();
    expect(storylessPartsReport).toStrictEqual([]);
  });

  it("reports a directory whose components have no stories", () => {
    expect.hasAssertions();
    expect(storylessComponentsReport).not.toStrictEqual([]);
  });

  it("runs the stories as a test project of this repository", () => {
    expect.hasAssertions();
    expect(storybookProjects()).toContain("./libs/ui/storybook/vitest.config.ts");
  });

  it("fails a story on an accessibility violation", () => {
    expect.hasAssertions();
    const parameters = composedParameters(previews["./storybook/preview.tsx"]);
    expect(field(parameters, "a11y")).toStrictEqual({ test: "error" });
  });

  it("lets a story off only for the rules listed here", () => {
    expect.hasAssertions();
    expect(relaxations).toStrictEqual(acceptedA11yViolations);
  });

  it("points the agent configuration at the port this repository owns", () => {
    expect.hasAssertions();
    expect(endpointReport).toStrictEqual([]);
  });

  it("keeps the storybook service worker on the installed msw version", () => {
    expect.hasAssertions();
    expect(vendoredWorkerReport).toStrictEqual([]);
  });
});
