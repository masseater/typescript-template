import { expect, test } from "vite-plus/test";

const projects = import.meta.glob<string>(["../*/Pulumi.yaml", "../../bootstrap/Pulumi.yaml"], {
  eager: true,
  import: "default",
});

test("every Pulumi project is covered", () => {
  expect(Object.keys(projects).sort()).toEqual([
    "../../bootstrap/Pulumi.yaml",
    "../admin/Pulumi.yaml",
    "../shared/Pulumi.yaml",
    "../user/Pulumi.yaml",
    "../wiki/Pulumi.yaml",
  ]);
});

test.for(Object.entries(projects))(
  "%s disables Pulumi compiler loading and runs TypeScript with plain Node",
  ([, yaml]) => {
    expect(yaml).toContain("typescript: false");
    expect(yaml).not.toContain("nodeargs");
  },
);
