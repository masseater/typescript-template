import {
  backendUrl,
  bucketPolicyResources,
  parseBootstrapConfig,
  parseCredentials,
  selectObjectWritePermission,
} from "./config.ts";
import { describe, expect, it } from "vite-plus/test";

const HEX_32_LENGTH = 32;
const HEX_64_LENGTH = 64;

const input = { accountId: "a".repeat(HEX_32_LENGTH), bucket: "template-state" };

describe("bootstrap state configuration", () => {
  it("state endpoint is private R2 with TLS and path-style S3 addressing", () => {
    expect.hasAssertions();
    const url = new URL(backendUrl(input));
    expect(url.protocol).toBe("s3:");
    expect(url.hostname).toBe(input.bucket);
    expect(url.searchParams.get("endpoint")).toBe(`${input.accountId}.r2.cloudflarestorage.com`);
    expect(url.searchParams.get("s3ForcePathStyle")).toBe("true");
    expect(url.searchParams.get("disableSSL")).toBeNull();
  });

  it("credentials are restricted to one bucket, not the account", () => {
    expect.hasAssertions();
    expect(JSON.parse(bucketPolicyResources(input))).toStrictEqual({
      [`com.cloudflare.edge.r2.bucket.${input.accountId}_default_template-state`]: "*",
    });
    const permission = {
      id: "b".repeat(HEX_32_LENGTH),
      name: "Workers R2 Storage Bucket Item Write",
      scopes: ["com.cloudflare.edge.r2.bucket"],
    };
    expect(selectObjectWritePermission([permission])).toBe(permission.id);
    expect(() =>
      selectObjectWritePermission([{ ...permission, name: "Workers R2 Storage Write" }]),
    ).toThrow("r2_object_write_permission_unavailable");
  });
});

describe("bootstrap settings validation", () => {
  it.each(["../other", "UPPERCASE", "x", "bad?endpoint=other"])(
    "rejects unsafe bucket name %s",
    (bucket) => {
      expect.hasAssertions();
      expect(() => parseBootstrapConfig({ ...input, bucket })).toThrow(
        "bootstrap_settings_invalid",
      );
    },
  );

  it("validates credentials without exposing invalid key material", () => {
    expect.hasAssertions();
    expect(() =>
      parseCredentials({ ...input, accessKeyId: "secret", secretAccessKey: "private" }),
    ).toThrow("state_credentials_invalid");
    expect(
      parseCredentials({
        ...input,
        accessKeyId: "c".repeat(HEX_32_LENGTH),
        secretAccessKey: "d".repeat(HEX_64_LENGTH),
      }).bucket,
    ).toBe(input.bucket);
  });
});
