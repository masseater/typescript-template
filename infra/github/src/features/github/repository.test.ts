import { describe, expect, test } from "vite-plus/test";

import { repositorySlug, repositoryStage } from "./repository.ts";

describe("repositoryStage", () => {
  const it = test.extend("stage", () => repositoryStage({ owner: "Acme", repository: "Widgets" }));

  it("names the stage after the repository rather than a deployment", ({ stage }) => {
    expect(stage).toBe("acme-widgets");
  });
});

describe("repositorySlug", () => {
  const it = test.extend("slug", () => repositorySlug({ owner: "acme", repository: "widgets" }));

  it("joins owner and repository with a slash", ({ slug }) => {
    expect(slug).toBe("acme/widgets");
  });
});
