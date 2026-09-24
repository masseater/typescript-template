import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, Encoding, FileSystem, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { pkcs8Key } from "./github-app-token.ts";
import { mergeQueueLabel, wikiDocsDirectory } from "./github-publication.ts";

const rsaModulusLength = 2048;
const pkcs1Offset = 26;
const octetStringOffset = 22;
const octetStringTag = 0x04;

const pem = (label: string, der: Uint8Array): string =>
  `-----BEGIN ${label}-----\n${Encoding.encodeBase64(der)}\n-----END ${label}-----\n`;

const repositoryFile = (relative: string) =>
  Effect.gen(function* repositoryPath() {
    const path = yield* Path.Path;
    return path.join(repositoryRoot, relative);
  });

describe("a GitHub App private key", () => {
  it("is used as PKCS#8 whether GitHub hands it out as PKCS#1 or PKCS#8", () =>
    Effect.runPromise(
      Effect.gen(function* convert() {
        expect.hasAssertions();
        const keys = yield* Effect.promise(() =>
          crypto.subtle.generateKey(
            {
              hash: "SHA-256",
              modulusLength: rsaModulusLength,
              name: "RSASSA-PKCS1-v1_5",
              publicExponent: Uint8Array.of(1, 0, 1),
            },
            true,
            ["sign", "verify"],
          ),
        );
        const pkcs8 = new Uint8Array(
          yield* Effect.promise(() => crypto.subtle.exportKey("pkcs8", keys.privateKey)),
        );
        expect(pkcs8[octetStringOffset]).toBe(octetStringTag);
        const pkcs1 = pkcs8.slice(pkcs1Offset);
        expect(yield* pkcs8Key(pem("RSA PRIVATE KEY", pkcs1))).toStrictEqual(pkcs8);
        expect(yield* pkcs8Key(pem("PRIVATE KEY", pkcs8))).toStrictEqual(pkcs8);
      }),
    ));
});

describe("a published wiki pull request", () => {
  it("carries the label the merge queue picks up", () =>
    Effect.runPromise(
      Effect.gen(function* mergifyLabel() {
        expect.hasAssertions();
        const fileSystem = yield* FileSystem.FileSystem;
        const mergify = yield* fileSystem.readFileString(yield* repositoryFile(".mergify.yml"));
        expect(mergify).toContain(`label = ${mergeQueueLabel}`);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("writes into the directory the wiki is built from", () =>
    Effect.runPromise(
      Effect.gen(function* docsDirectory() {
        expect.hasAssertions();
        const fileSystem = yield* FileSystem.FileSystem;
        expect(
          yield* fileSystem.exists(yield* repositoryFile(`${wikiDocsDirectory}/index.md`)),
        ).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});
