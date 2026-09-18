import { describe, expect, it } from "vite-plus/test";

import { mailpitPort } from "@repo/config";

const files: Readonly<Record<string, string>> = import.meta.glob("../compose.yaml", {
  eager: true,
  import: "default",
});

describe("the local services", () => {
  it("publish Mailpit on the port the rest of the repository reads", () => {
    expect.hasAssertions();
    expect(files["../compose.yaml"]).toContain(`"127.0.0.1:${mailpitPort}:${mailpitPort}"`);
  });
});
