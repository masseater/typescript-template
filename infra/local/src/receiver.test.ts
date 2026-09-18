import { describe, expect, it } from "vite-plus/test";

import { receiverPorts } from "./receiver.ts";

const files: Readonly<Record<string, string>> = import.meta.glob("../compose.yaml", {
  eager: true,
  import: "default",
});

const published = /^\s+- "127\.0\.0\.1:(?<host>\d+):(?<container>\d+)"$/gmu;

describe("local services", () => {
  it("publish the receiver ports that the local tools query", () => {
    expect.hasAssertions();
    const compose = files["../compose.yaml"];
    expect(compose).toBeTypeOf("string");
    const ports = Array.from(
      String(compose).matchAll(published),
      ({ groups }) => `${groups?.["host"]}:${groups?.["container"]}`,
    );
    expect(ports).toStrictEqual(
      expect.arrayContaining(Object.values(receiverPorts).map((port) => `${port}:${port}`)),
    );
  });
});
