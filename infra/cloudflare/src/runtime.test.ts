import { describe, expect, it } from "vite-plus/test";

const projects = import.meta.glob<string>(["../*/Pulumi.yaml", "../../bootstrap/Pulumi.yaml"], {
  eager: true,
  import: "default",
});

describe("pulumi runtime", () => {
  it("every Pulumi project is covered", () => {
    expect.hasAssertions();
    expect(Object.keys(projects).toSorted()).toStrictEqual([
      "../../bootstrap/Pulumi.yaml",
      "../admin/Pulumi.yaml",
      "../shared/Pulumi.yaml",
      "../user/Pulumi.yaml",
      "../wiki/Pulumi.yaml",
    ]);
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
