import * as v from "valibot";

const settingsSchema = v.object({
  accountId: v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/)),
  bucket: v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)),
});

export function parseBootstrapConfig(input: unknown) {
  const result = v.safeParse(settingsSchema, input);
  if (!result.success) throw new Error("bootstrap_settings_invalid");
  return result.output;
}

export function backendUrl(input: unknown): string {
  const config = parseBootstrapConfig(input);
  const query = new URLSearchParams({
    endpoint: `${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    awssdk: "v2",
    s3ForcePathStyle: "true",
  });
  return `s3://${config.bucket}?${query.toString()}`;
}

export function selectObjectWritePermission(
  groups: readonly { id: string; name: string; scopes: string[] }[],
): string {
  const matches = groups.filter(
    (group) =>
      group.name === "Workers R2 Storage Bucket Item Write" &&
      group.scopes.includes("com.cloudflare.edge.r2.bucket"),
  );
  if (matches.length !== 1 || !/^[a-f0-9]{32}$/.test(matches[0]!.id))
    throw new Error("r2_object_write_permission_unavailable");
  return matches[0]!.id;
}

export function bucketPolicyResources(input: unknown): string {
  const config = parseBootstrapConfig(input);
  return JSON.stringify({
    [`com.cloudflare.edge.r2.bucket.${config.accountId}_default_${config.bucket}`]: "*",
  });
}

export function parseCredentials(input: unknown) {
  const result = v.safeParse(
    v.object({
      accountId: v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/)),
      bucket: settingsSchema.entries.bucket,
      accessKeyId: v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/)),
      secretAccessKey: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
    }),
    input,
  );
  if (!result.success) throw new Error("state_credentials_invalid");
  return result.output;
}
