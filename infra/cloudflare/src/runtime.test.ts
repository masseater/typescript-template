import { expect, test } from "vite-plus/test";
import { applyPlan } from "./stacks.ts";

const projects = import.meta.glob<string>(["../*/Pulumi.yaml", "../../bootstrap/Pulumi.yaml"], {
  eager: true,
  import: "default",
});

test("every Pulumi project is covered", () => {
  expect(new Set(Object.keys(projects))).toEqual(
    new Set([
      "../../bootstrap/Pulumi.yaml",
      ...applyPlan().map(({ stack }) => `../${stack}/Pulumi.yaml`),
    ]),
  );
});

test.for(Object.entries(projects))(
  "%s disables Pulumi compiler loading and runs TypeScript with plain Node",
  ([, yaml]) => {
    expect(yaml).toContain("typescript: false");
    expect(yaml).not.toContain("nodeargs");
  },
);
