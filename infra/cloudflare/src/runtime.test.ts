import { describe, expect, it } from "vite-plus/test";
import { stackNames } from "./stacks.ts";

const projects = import.meta.glob<string>(["../*/Pulumi.yaml", "../../bootstrap/Pulumi.yaml"], {
  eager: true,
  import: "default",
});

describe("pulumi runtime", () => {
  it("every Pulumi project is covered", () => {
    expect.hasAssertions();
    expect(new Set(Object.keys(projects))).toStrictEqual(
      new Set([
        "../../bootstrap/Pulumi.yaml",
        ...stackNames.map((stack) => `../${stack}/Pulumi.yaml`),
      ]),
    );
  });

  it.for(Object.entries(projects))(
    "%s disables Pulumi compiler loading and runs TypeScript with plain Node",
    ([, yaml]: readonly [string, string]) => {
      expect.hasAssertions();
      expect(yaml).toContain("typescript: false");
      expect(yaml).not.toContain("nodeargs");
    },
  );
});
