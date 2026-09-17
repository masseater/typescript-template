import { expect, test } from "vitest";
import {
  backendUrl,
  bucketPolicyResources,
  parseBootstrapConfig,
  parseCredentials,
  selectObjectWritePermission,
} from "./config.ts";

const input = { accountId: "a".repeat(32), bucket: "template-state" };

test("state endpoint is private R2 with TLS and path-style S3 addressing", () => {
  const url = new URL(backendUrl(input));
  expect(url.protocol).toBe("s3:");
  expect(url.hostname).toBe(input.bucket);
  expect(url.searchParams.get("endpoint")).toBe(`${input.accountId}.r2.cloudflarestorage.com`);
  expect(url.searchParams.get("s3ForcePathStyle")).toBe("true");
  expect(url.searchParams.has("disableSSL")).toBe(false);
});

test("credentials are restricted to one bucket, not the account", () => {
  expect(JSON.parse(bucketPolicyResources(input))).toEqual({
    [`com.cloudflare.edge.r2.bucket.${input.accountId}_default_template-state`]: "*",
  });
  const permission = {
    id: "b".repeat(32),
    name: "Workers R2 Storage Bucket Item Write",
    scopes: ["com.cloudflare.edge.r2.bucket"],
  };
  expect(selectObjectWritePermission([permission])).toBe(permission.id);
  expect(() =>
    selectObjectWritePermission([{ ...permission, name: "Workers R2 Storage Write" }]),
  ).toThrow("r2_object_write_permission_unavailable");
});

test.each(["../other", "UPPERCASE", "x", "bad?endpoint=other"])(
  "rejects unsafe bucket name %s",
  (bucket) => {
    expect(() => parseBootstrapConfig({ ...input, bucket })).toThrow("bootstrap_settings_invalid");
  },
);

test("validates credentials without exposing invalid key material", () => {
  expect(() =>
    parseCredentials({ ...input, accessKeyId: "secret", secretAccessKey: "private" }),
  ).toThrow("state_credentials_invalid");
  expect(
    parseCredentials({ ...input, accessKeyId: "c".repeat(32), secretAccessKey: "d".repeat(64) })
      .bucket,
  ).toBe(input.bucket);
});
