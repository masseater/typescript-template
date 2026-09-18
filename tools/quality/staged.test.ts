import { describe, expect, it } from "vite-plus/test";

import { blobContents } from "./staged.ts";

function batch(blobs: readonly (readonly [string, string])[]): Buffer {
  return Buffer.concat(
    blobs.map(([object, content]: readonly [string, string]) =>
      Buffer.from(`${object} blob ${String(Buffer.byteLength(content))}\n${content}\n`),
    ),
  );
}

const blobs = [
  ["1111111111111111111111111111111111111111", "hello\n"],
  ["2222222222222222222222222222222222222222", "ユニコード\n"],
  ["3333333333333333333333333333333333333333", ""],
  ["4444444444444444444444444444444444444444", "null \0 byte\0"],
  ["5555555555555555555555555555555555555555", "tail without newline"],
] as const;

describe("git cat-file batch output", () => {
  it("frames every blob by its byte length", () => {
    expect.assertions(1);
    const objects = blobs.map(([object]: readonly [string, string]) => object);
    expect([...blobContents(batch(blobs), objects).values()]).toStrictEqual(
      blobs.map(([, content]: readonly [string, string]) => content),
    );
  });

  it("rejects output that does not answer the requested object", () => {
    expect.hasAssertions();
    expect(() => blobContents(batch(blobs), ["6666666666666666666666666666666666666666"])).toThrow(
      "did not return the blob",
    );
    expect(() => blobContents(Buffer.from("truncated"), [blobs[0][0]])).toThrow(
      "did not return the blob",
    );
  });
});
