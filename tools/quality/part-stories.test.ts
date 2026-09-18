import {
  a11yRelaxations,
  storybookEndpointViolations,
  storylessParts,
  vendoredWorkerViolations,
} from "./part-stories.ts";
import { describe, expect, it } from "vite-plus/test";
import { field } from "./dependencies.ts";
import { partsDirectory } from "./design-system.ts";

const previews: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../libs/ui/.storybook/preview.tsx",
  { eager: true, import: "default" },
);

const configs: Readonly<Record<string, unknown>> = import.meta.glob("../../vite.config.ts", {
  eager: true,
  import: "default",
});

const ports: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../libs/config/src/applications.ts",
  { eager: true, import: "storybookPort" },
);

function composedParameters(preview: unknown): unknown {
  return typeof preview === "object" && preview !== null && "composed" in preview
    ? field(preview.composed, "parameters")
    : undefined;
}

function storybookProjects(): unknown[] {
  const projects: unknown = field(field(configs["../../vite.config.ts"], "test"), "projects");
  return Array.isArray(projects)
    ? projects.map((project: unknown) =>
        typeof project === "string" ? project : field(project, "extends"),
      )
    : [];
}

const acceptedA11yViolations = [
  {
    file: "libs/ui/src/shared/ui/toast-item.stories.tsx",
    rule: "aria-hidden-focus",
    story: "Failure",
  },
];

describe("part stories", () => {
  it("looks for stories in the parts directory components.json points at", () => {
    expect.hasAssertions();
    expect(partsDirectory()).toMatch(/libs\/ui\/src\/shared\/ui$/u);
  });

  it("keeps a story next to every part", () => {
    expect.hasAssertions();
    expect(storylessParts(partsDirectory())).toStrictEqual([]);
  });

  it("reports a directory whose components have no stories", () => {
    expect.hasAssertions();
    expect(storylessParts("libs/ui/src")).not.toStrictEqual([]);
  });

  it("runs the stories as a test project of this repository", () => {
    expect.hasAssertions();
    expect(storybookProjects()).toContain("./libs/ui/.storybook/vitest.config.ts");
  });

  it("fails a story on an accessibility violation", () => {
    expect.hasAssertions();
    const parameters = composedParameters(previews["../../libs/ui/.storybook/preview.tsx"]);
    expect(field(parameters, "a11y")).toStrictEqual({ test: "error" });
  });

  it("lets a story off only for the rules listed here", () => {
    expect.hasAssertions();
    expect(a11yRelaxations()).toStrictEqual(acceptedA11yViolations);
  });

  it("points the agent configuration at the port this repository owns", () => {
    expect.hasAssertions();
    expect(
      storybookEndpointViolations(Number(ports["../../libs/config/src/applications.ts"])),
    ).toStrictEqual([]);
  });

  it("keeps the vendored service worker at the installed msw version", () => {
    expect.hasAssertions();
    expect(vendoredWorkerViolations()).toStrictEqual([]);
  });
});
