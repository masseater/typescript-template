import { assert, it } from "@effect/vitest";
import {
  backendUrl,
  bucketPolicyResources,
  parseBootstrapConfig,
  parseCredentials,
  selectObjectWritePermission,
} from "./config.ts";
import type { BootstrapFailure } from "./config.ts";
import { Effect } from "effect";

const HEX_ID_LENGTH = 32;
const SECRET_LENGTH = 64;

const input = { accountId: "a".repeat(HEX_ID_LENGTH), bucket: "template-state" };

function code<Value, Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  effect: Effect.Effect<Value, BootstrapFailure, Requirements>,
): Effect.Effect<BootstrapFailure["code"], Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map((failure) => failure.code),
  );
}

it.effect("state endpoint is private R2 with TLS and path-style S3 addressing", () =>
  Effect.gen(function* program() {
    const url = new URL(yield* backendUrl(input));
    assert.strictEqual(url.protocol, "s3:");
    assert.strictEqual(url.hostname, input.bucket);
    assert.strictEqual(
      url.searchParams.get("endpoint"),
      `${input.accountId}.r2.cloudflarestorage.com`,
    );
    assert.strictEqual(url.searchParams.get("s3ForcePathStyle"), "true");
    assert.isFalse(url.searchParams.has("disableSSL"));
  }),
);

it.effect("credentials are restricted to one bucket, not the account", () =>
  Effect.gen(function* program() {
    assert.deepStrictEqual(JSON.parse(yield* bucketPolicyResources(input)), {
      [`com.cloudflare.edge.r2.bucket.${input.accountId}_default_template-state`]: "*",
    });
    const permission = {
      id: "b".repeat(HEX_ID_LENGTH),
      name: "Workers R2 Storage Bucket Item Write",
      scopes: ["com.cloudflare.edge.r2.bucket"],
    };
    assert.strictEqual(yield* selectObjectWritePermission([permission]), permission.id);
    assert.strictEqual(
      yield* code(
        selectObjectWritePermission([{ ...permission, name: "Workers R2 Storage Write" }]),
      ),
      "r2_object_write_permission_unavailable",
    );
  }),
);

for (const bucket of ["../other", "UPPERCASE", "x", "bad?endpoint=other"]) {
  it.effect(`rejects unsafe bucket name ${bucket}`, () =>
    Effect.gen(function* program() {
      assert.strictEqual(
        yield* code(parseBootstrapConfig({ ...input, bucket })),
        "bootstrap_settings_invalid",
      );
    }),
  );
}

it.effect("validates credentials without exposing invalid key material", () =>
  Effect.gen(function* program() {
    const failure = yield* parseCredentials({
      ...input,
      accessKeyId: "secret",
      secretAccessKey: "private",
    }).pipe(Effect.flip);
    assert.strictEqual(failure.code, "state_credentials_invalid");
    assert.notInclude(JSON.stringify(failure), "private");
    const credentials = yield* parseCredentials({
      ...input,
      accessKeyId: "c".repeat(HEX_ID_LENGTH),
      secretAccessKey: "d".repeat(SECRET_LENGTH),
    });
    assert.strictEqual(credentials.bucket, input.bucket);
  }),
);
